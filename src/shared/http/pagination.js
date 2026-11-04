const { invalid } = require('./validate');
function parsePagination(query = {}) {
  const parse = (name, fallback, max) => {
    const value = query[name] === undefined ? fallback : query[name];
    if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > max) invalid(name);
    return Number(value);
  };
  const page = parse('page', 1, 1000000), pageSize = parse('pageSize', 20, 100);
  if (query.sort !== undefined && !['id', '-id'].includes(query.sort)) invalid('sort');
  if (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 100)) invalid('q');
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
module.exports = { parsePagination };
