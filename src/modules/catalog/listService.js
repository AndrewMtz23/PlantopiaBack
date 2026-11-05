const prisma = require('../../config/prisma');
const { parsePagination } = require('../../shared/http/pagination');
const { invalid } = require('../../shared/http/validate');
const userSelect = Object.fromEntries(['id', 'estatus', 'tipo', 'nombre', 'fechaNacimiento', 'genero', 'telefono', 'correo', 'domicilio', 'ciudad', 'estadoDireccion', 'codigoPostal', 'referenciasDomicilio', 'latitud', 'longitud', 'fotoPerfil'].map(key => [key, true]));
const definitions = {
  users: { model: 'tusuarios', select: userSelect, search: 'nombre' },
  products: { model: 'tproductos', search: 'nombre' },
  inventory: { model: 'tinventario', include: { tproductos: true, tproveedores: true, tsucursales: true } },
  catalog: { model: 'tinventario', include: { tproductos: true, tsucursales: true }, where: { estatus: 1, cantidad: { gt: 0 }, tproductos: { estatus: 1 } } },
  payments: { model: 'tpagos' },
  logs: { model: 'tlogs', search: 'descripcion' },
};
async function list(kind, query = {}, ownerId) {
  const { page, pageSize, skip, take } = parsePagination(query);
  for (const key of Object.keys(query)) if (!['page', 'pageSize', 'sort', 'q', ...(kind === 'logs' ? ['modulo', 'nivel', 'accion', 'limit'] : [])].includes(key)) invalid(key);
  const definition = definitions[kind];
  const where = { ...definition.where };
  if (kind === 'payments' && ownerId) where.usuario = ownerId;
  if (query.q) {
    if (definition.search) where[definition.search] = { contains: query.q, mode: 'insensitive' };
    else if (['catalog', 'inventory'].includes(kind)) where.tproductos = { ...where.tproductos, nombre: { contains: query.q, mode: 'insensitive' } };
    else invalid('q');
  }
  if (kind === 'logs') {
    for (const key of ['modulo', 'nivel', 'accion']) if (query[key]) {
      if (typeof query[key] !== 'string' || query[key].length > 50) invalid(key);
      where[key] = query[key];
    }
  }
  const args = { where, skip, take, orderBy: { id: query.sort === '-id' ? 'desc' : 'asc' }, ...(definition.select ? { select: definition.select } : {}), ...(definition.include ? { include: definition.include } : {}) };
  const [rows, total] = await prisma.$transaction([prisma[definition.model].findMany(args), prisma[definition.model].count({ where })], { isolationLevel: 'RepeatableRead' });
  let items = rows;
  if (kind === 'catalog') items = rows.map(row => require('../../services/ProductService').formatCatalogItem(row));
  if (kind === 'payments') {
    const enriched = await require('../../services/CommerceService').attachPaymentRelations(rows, { includeSales: true });
    items = ownerId ? enriched.map(require('../../utils/paymentDto').customerPayment) : enriched.map(row => ({ ...row, usuario_nombre: row.tusuarios?.nombre, usuario_correo: row.tusuarios?.correo, productos: row.tventas?.length, unidades: row.tventas?.reduce((n, sale) => n + sale.cantidad, 0) }));
  }
  if (kind === 'logs') items = await require('../../services/MetricService').attachUsers(rows);
  return { items, page, pageSize, total };
}
async function smallLegacyList(kind, query = {}, ownerId) {
  const result = await list(kind, { ...query, page: 1, pageSize: 100 }, ownerId);
  if (result.total > 100) throw new (require('../../utils/AppError'))(409, 'PAGINATION_REQUIRED', 'Esta lista requiere paginacion. Actualiza el cliente.');
  return result.items;
}
module.exports = { list, smallLegacyList };
