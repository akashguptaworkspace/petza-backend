import { CITY_ALIASES, PLACES } from '../../utils/indiaLocations.js';

/**
 * The location picker's autocomplete, over the bundled India states/cities
 * dataset — no network call, no API key, no billing (this replaced a Google
 * Places (New) integration that required a billed Google Cloud project; see
 * the git history of this file and the removed integrations/places/ and
 * config/places.js).
 *
 * The dataset and its alias table now live in `utils/indiaLocations.js`,
 * because the pet catalogue needs the same city→state knowledge to widen a
 * `state=` filter over listings that only recorded a city.
 */
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
