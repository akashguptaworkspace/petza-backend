import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Bundled India states + cities (37 states/UTs, ~3.8k cities) — extracted
 * from the MIT-licensed `countries-states-cities` npm package and stripped
 * of diacritics (the source data transliterates long vowels, e.g.
 * "Āgra" → normalized to "Agra"). No network call, no API key, no billing.
 *
 * This module owns the dataset for the whole backend. It started life
 * inside `places.service.js` serving only the location picker's
 * autocomplete; the catalogue now needs the same knowledge to answer "which
 * state is this city in", so the data and the alias table live here and the
 * places service reads them from one place rather than each caller loading
 * its own copy.
 */
export const PLACES = JSON.parse(readFileSync(path.join(__dirname, '../data/india-locations.json'), 'utf8'));

/**
 * Colloquial/former names people still type that don't match the current
 * official name in the dataset (e.g. Bengaluru was Bangalore). Maps an
 * alias to the canonical name it should match against.
 */
export const CITY_ALIASES = {
  bangalore: 'Bengaluru',
  bombay: 'Mumbai',
  calcutta: 'Kolkata',
  madras: 'Chennai',
  poona: 'Pune',
  baroda: 'Vadodara',
  cochin: 'Kochi',
  trivandrum: 'Thiruvananthapuram',
  mysore: 'Mysuru',
  gurgaon: 'Gurugram',
  allahabad: 'Prayagraj',
  bangaluru: 'Bengaluru',
};

function key(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

/**
 * city (lowercased, aliases resolved) → every state that has a city of that
 * name. Usually one; 94 names (Aurangabad, Amarpur, Banda…) genuinely exist
 * in two or three states at once, which is why this is a Set rather than a
 * single value — a map of one value silently answered with whichever row
 * happened to load last.
 */
const STATES_BY_CITY = new Map();
/** state (lowercased) → its canonical spelling, and every city in it. */
const STATE_CANONICAL = new Map();
const CITIES_BY_STATE = new Map();

for (const entry of PLACES) {
  if (entry.kind === 'state') {
    STATE_CANONICAL.set(key(entry.name), entry.name);
    continue;
  }

  const cityKey = key(entry.name);
  const states = STATES_BY_CITY.get(cityKey);
  if (states) states.add(entry.state);
  else STATES_BY_CITY.set(cityKey, new Set([entry.state]));

  STATE_CANONICAL.set(key(entry.state), entry.state);

  const bucket = CITIES_BY_STATE.get(key(entry.state));
  if (bucket) bucket.push(entry.name);
  else CITIES_BY_STATE.set(key(entry.state), [entry.name]);
}

// An alias resolves to whatever its canonical city resolves to, so
// "Bangalore" answers Karnataka exactly as "Bengaluru" does — the two names
// are in live use side by side (the app's own `normalizeLocation` even
// rewrites Bengaluru → Bangalore for display), and a listing saved under
// either spelling has to be findable from the other.
for (const [alias, canonical] of Object.entries(CITY_ALIASES)) {
  const states = STATES_BY_CITY.get(key(canonical));
  if (states) STATES_BY_CITY.set(alias, states);
}

/**
 * Which state a city is in, or null when the name isn't one we know — or
 * is one that several states share.
 *
 * This is what lets the catalogue answer a `state=Bihar` query with a
 * listing that only ever recorded "Darbhanga" — see
 * `petListing.repository.js`'s state filter and `locationOf` in
 * `petListing.service.js`.
 *
 * Deliberately refuses to answer for an ambiguous name rather than picking
 * one: this value gets written to a column and printed on a card, and
 * "Aurangabad, Maharashtra" on a shop that is actually in Bihar is worse
 * than no state at all. `citiesInState` below is the lenient half of the
 * pair — an ambiguous city still *appears* under every state that has one,
 * because for a discovery filter a possibly-relevant pet beats a hidden one.
 */
export function stateOfCity(city) {
  if (!city) return null;
  const states = STATES_BY_CITY.get(key(city));
  return states?.size === 1 ? [...states][0] : null;
}

/** The dataset's own spelling of a state, so "bihar" and "BIHAR" both store as "Bihar". */
export function canonicalStateName(state) {
  if (!state) return null;
  return STATE_CANONICAL.get(key(state)) ?? String(state).trim() ?? null;
}

/**
 * Every city name inside a state, plus the aliases of those cities.
 *
 * Used to widen a `state=` filter over rows whose own `state` column was
 * never filled in — a partner store that only recorded "Bengaluru", or a
 * listing created before the app started sending a state alongside the
 * city. Empty for an unknown state, which the caller reads as "nothing to
 * widen with" rather than "match nothing".
 */
export function citiesInState(state) {
  if (!state) return [];
  const cities = CITIES_BY_STATE.get(key(state)) ?? [];
  if (!cities.length) return [];

  const inState = new Set(cities.map((city) => key(city)));
  const aliases = Object.entries(CITY_ALIASES)
    .filter(([, canonical]) => inState.has(key(canonical)))
    .map(([alias]) => alias);

  return [...cities, ...aliases];
}
