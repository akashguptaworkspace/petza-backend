import { canonicalStateName, citiesInState, stateOfCity } from '../src/utils/indiaLocations.js';

/**
 * The city→state lookup the pet catalogue leans on.
 *
 * A `state=` query is the only geography the browse feed has: the app never
 * sends a city (see petza-app's `pets.service.ts` — "discovery should cover
 * every city in the user's state"). Plenty of rows have a city and a blank
 * `state`, so these two functions are what decides whether someone browsing
 * Bihar sees a pet listed in Darbhanga.
 */
describe('stateOfCity', () => {
  it('answers for cities across one state, whichever one the user picked', () => {
    // The exact case that prompted this: every Bihar city has to lead back
    // to Bihar, so picking any of them shows the same state-wide feed.
    expect(stateOfCity('Patna')).toBe('Bihar');
    expect(stateOfCity('Darbhanga')).toBe('Bihar');
    expect(stateOfCity('Madhubani')).toBe('Bihar');
    expect(stateOfCity('Muzaffarpur')).toBe('Bihar');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(stateOfCity('  pATNA ')).toBe('Bihar');
  });

  it('resolves a colloquial name to the same state as the official one', () => {
    // Both spellings are in live use — the app's own normalizeLocation even
    // rewrites Bengaluru to Bangalore for display.
    expect(stateOfCity('Bengaluru')).toBe('Karnataka');
    expect(stateOfCity('Bangalore')).toBe('Karnataka');
  });

  it('refuses to guess when several states share the city name', () => {
    // Aurangabad exists in Maharashtra and in Bihar. This value gets written
    // to a column and printed on a card, so no answer beats a wrong one.
    expect(stateOfCity('Aurangabad')).toBeNull();
  });

  it('returns null for an unknown or empty name rather than throwing', () => {
    expect(stateOfCity('Darbhange')).toBeNull(); // a typo is not a city
    expect(stateOfCity(null)).toBeNull();
    expect(stateOfCity('')).toBeNull();
  });
});

describe('citiesInState', () => {
  it('lists the cities a state filter should widen over', () => {
    const bihar = citiesInState('Bihar');
    expect(bihar).toEqual(expect.arrayContaining(['Patna', 'Darbhanga', 'Madhubani', 'Muzaffarpur']));
  });

  it('includes city aliases, so a row saved under either spelling matches', () => {
    const karnataka = citiesInState('Karnataka').map((city) => city.toLowerCase());
    expect(karnataka).toEqual(expect.arrayContaining(['bengaluru', 'bangalore']));
  });

  it('is the lenient half of the pair: an ambiguous city appears under every state that has one', () => {
    // stateOfCity refuses to name a state for Aurangabad; the filter still
    // has to show that listing to someone browsing either state, because a
    // possibly-relevant pet beats a hidden one.
    const lower = (state) => citiesInState(state).map((city) => city.toLowerCase());
    expect(lower('Maharashtra')).toContain('aurangabad');
    expect(lower('Bihar')).toContain('aurangabad');
  });

  it('returns nothing to widen with for an unknown state, rather than matching everything', () => {
    expect(citiesInState('Atlantis')).toEqual([]);
    expect(citiesInState(null)).toEqual([]);
  });
});

describe('canonicalStateName', () => {
  it('settles the spelling so one state is one value in the column', () => {
    expect(canonicalStateName('bihar')).toBe('Bihar');
    expect(canonicalStateName('KARNATAKA')).toBe('Karnataka');
  });

  it('passes an unrecognised state through instead of dropping it', () => {
    expect(canonicalStateName('Somewhere Else')).toBe('Somewhere Else');
    expect(canonicalStateName(null)).toBeNull();
  });
});
