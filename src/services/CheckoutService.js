const crypto = require('node:crypto');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { calculateTotals, quantity, money } = require('./PricingService');
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function transaction(work) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await prisma.$transaction(work, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 15000 }); }
    catch (error) {
      if (error.code !== 'P2034' && error.code !== 'P2002') throw error;
      if (attempt === 2) throw new AppError(409, 'CONCURRENT_CHANGE', 'La operacion cambio. Intenta de nuevo.');
    }
  }
}
const lockCart = (tx, userId) => tx.$queryRaw`SELECT id FROM tusuarios WHERE id = ${Number(userId)} FOR UPDATE`;
async function quoteFor(tx, userId) {
  const rows = await tx.tpedido.findMany({ where: { usuario: Number(userId) }, orderBy: { inventario: 'asc' },
    include: { tinventario: { include: { tproductos: true } } } });
  const items = rows.map(row => {
    const stock = row.tinventario, product = stock.tproductos;
    if (stock.estatus !== 1 || product.estatus !== 1 || stock.cantidad < row.cantidad) throw new AppError(409, 'UNAVAILABLE', 'Un producto ya no esta disponible.');
    quantity(row.cantidad);
    return { id: row.id, inventario: row.inventario, producto: stock.producto, sucursal: stock.sucursal,
      cantidad: row.cantidad, precioVenta: money(product.precioVenta).toFixed(2),
      subtotal: money(money(product.precioVenta).times(row.cantidad)).toFixed(2) };
  });
  const totals = calculateTotals(items.map(item => ({ quantity: item.cantidad, unitPrice: item.precioVenta })), { shipping: items.length ? '50.00' : '0.00' });
  return { items, ...totals, quoteHash: hash({ items, totals }), rows };
}
async function getQuote(userId) {
  const { rows, ...quote } = await quoteFor(prisma, userId);
  return quote;
}
function deliveryAddress(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError(400, 'INVALID_ADDRESS', 'Completa la direccion de entrega.');
  const result = {};
  const limits = { nombre: 100, telefono: 10, domicilio: 450, ciudad: 120, estadoDireccion: 120, codigoPostal: 5, referenciasDomicilio: 500 };
  for (const [field, max] of Object.entries(limits)) {
    const text = typeof value[field] === 'string' ? value[field].trim() : '';
    if (text.length > max || (field !== 'referenciasDomicilio' && !text)) throw new AppError(400, 'INVALID_ADDRESS', 'Completa una direccion de entrega valida.');
    result[field] = text;
  }
  if (!/^\d{10}$/.test(result.telefono) || !/^\d{5}$/.test(result.codigoPostal)) throw new AppError(400, 'INVALID_ADDRESS', 'Telefono o codigo postal invalido.');
  for (const [field, bound] of [['latitud', 90], ['longitud', 180]]) {
    if (value[field] !== undefined && value[field] !== null && value[field] !== '') {
      const n = Number(value[field]);
      if (!Number.isFinite(n) || Math.abs(n) > bound) throw new AppError(400, 'INVALID_ADDRESS', 'Coordenadas invalidas.');
      result[field] = n;
    }
  }
  if (('latitud' in result) !== ('longitud' in result)) throw new AppError(400, 'INVALID_ADDRESS', 'Completa ambas coordenadas.');
  return result;
}
async function checkout({ userId, idempotencyKey, payload }) {
  if (payload.metodo !== 'efectivo') throw new AppError(400, 'PAYMENT_METHOD_DISABLED', 'Solo se admiten pedidos en efectivo pendientes de cobro.');
  if (typeof idempotencyKey !== 'string' || !/^[\w-]{8,120}$/.test(idempotencyKey)) throw new AppError(400, 'INVALID_KEY', 'Clave de operacion requerida.');
  if (typeof payload.quoteHash !== 'string') throw new AppError(400, 'QUOTE_REQUIRED', 'Actualiza la cotizacion antes de comprar.');
  const address = deliveryAddress(payload.direccionEntrega);
  const requestHash = hash({ quoteHash: payload.quoteHash, metodo: payload.metodo, address });
  return transaction(async tx => {
    await lockCart(tx, userId);
    const previous = await tx.tpagos.findUnique({ where: { usuario_idempotencyKey: { usuario: Number(userId), idempotencyKey } } });
    if (previous) {
      if (previous.requestHash !== requestHash) throw new AppError(409, 'KEY_REUSED', 'Esta clave pertenece a otra operacion.');
      return { pagoId: previous.id, total: previous.total.toFixed(2), estado: previous.estado };
    }
    const quote = await quoteFor(tx, userId);
    if (!quote.items.length) throw new AppError(409, 'EMPTY_CART', 'El carrito esta vacio.');
    if (quote.quoteHash !== payload.quoteHash) throw new AppError(409, 'QUOTE_CHANGED', 'El carrito o sus precios cambiaron. Revisa el nuevo total.');
    const payment = await tx.tpagos.create({ data: { usuario: Number(userId), metodo: 'efectivo', estado: 'pendiente',
      subtotal: quote.subtotal, iva: quote.iva, envio: quote.envio, total: quote.total,
      idempotencyKey, requestHash, direccionEntrega: address } });
    for (const [index, item] of quote.items.entries()) {
      const updated = await tx.tinventario.updateMany({ where: { id: item.inventario, estatus: 1, cantidad: { gte: item.cantidad } }, data: { cantidad: { decrement: item.cantidad } } });
      if (updated.count !== 1) throw new AppError(409, 'OUT_OF_STOCK', 'Stock insuficiente.');
      await tx.tventas.create({ data: { usuario: Number(userId), pago: payment.id, producto: item.producto, inventario: item.inventario, sucursal: item.sucursal,
        cantidad: item.cantidad, total: item.subtotal, precioUnitario: item.precioVenta,
        costoUnitario: quote.rows[index].tinventario.tproductos.precioCompra } });
    }
    await tx.tpedido.deleteMany({ where: { usuario: Number(userId) } });
    await tx.tlogs.create({ data: { usuario: Number(userId), modulo: 'pedidos', accion: 'crear_pedido', descripcion: 'Pedido pendiente de cobro', entidad: 'tpagos', entidadId: payment.id } });
    return { pagoId: payment.id, total: payment.total.toFixed(2), estado: payment.estado };
  });
}
module.exports = { checkout, getQuote, transaction, lockCart };
