const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Reads ?page/&limit off a validated query object and returns Sequelize's { limit, offset } plus the raw page/limit. */
export function getPagination(query = {}) {
  const page = Math.max(Number(query.page) || DEFAULT_PAGE, 1);
  const limit = Math.min(Math.max(Number(query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/** Wraps a Sequelize `findAndCountAll` result into the { data, meta } shape every list endpoint returns. */
export function buildPaginationMeta({ page, limit, total }) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) || 0 };
}
