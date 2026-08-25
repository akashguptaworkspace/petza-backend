import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Bundled India states + cities (37 states/UTs, ~3.8k cities) — extracted
 * from the MIT-licensed `countries-states-cities` npm package and stripped
 * of diacritics (the source data transliterates long vowels, e.g.
 * "Āgra" → normalized to "Agra"). No network call, no API key, no billing:
 * this replaced a Google Places (New) integration that required a billed
 * Google Cloud project (see git history of this file, and the removed
 * integrations/places/ and config/places.js).
 */
const PLACES = JSON.parse(readFileSync(path.join(__dirname, '../../data/india-locations.json'), 'utf8'));

/**
 * Colloquial/former names people still type that don't match the current
 * official name in the dataset (e.g. Bengaluru was Bangalore). Maps an
 * alias to the canonical name it should match against.
 */
const CITY_ALIASES = {
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

const MAX_RESULTS = 20;

function matchRank(entry, query) {
  const name = entry.name.toLowerCase();
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 3;

  const alias = Object.keys(CITY_ALIASES).find(
    (key) => CITY_ALIASES[key] === entry.name && (key === query || key.startsWith(query))
  );
  if (alias) return alias === query ? 0 : 2;

  return -1;
}

export const placesService = {
  async searchPlaces(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const ranked = [];
    for (const entry of PLACES) {
      const rank = matchRank(entry, q);
      if (rank === -1) continue;
      ranked.push({ entry, rank });
    }

    ranked.sort((a, b) => a.rank - b.rank || a.entry.name.localeCompare(b.entry.name));

    return ranked.slice(0, MAX_RESULTS).map(({ entry }) => ({
      kind: entry.kind,
      name: entry.name,
      state: entry.state,
      placeId: `${entry.kind}:${entry.name}:${entry.state}`,
    }));
  },
};
