const { withTransaction } = require('../../infrastructure/db/transaction');
const { appendAudit } = require('../audit/auditService');
const { lockInventory } = require('./inventoryRepository');
const { integer, reason: validateReason } = require('./inventoryValidation');
const AppError = require('../../utils/AppError');

async function authorize(tx, actorId) {
  const actor = await tx.tusuarios.findUnique({ where: { id: integer(actorId, 'actor', 1) } });
  if (!actor || actor.estatus !== 1 || ![1, 3].includes(actor.tipo)) throw new AppError(403, 'FORBIDDEN', 'No tienes permisos para ajustar inventario.');
}

async function changeStockTx(tx, { inventoryId, delta, sourceType, sourceId = null, actorId, reason = 'Movimiento de pedido', requestId, expectedVersion, status, supplier }) {
  const stock = await lockInventory(tx, integer(inventoryId, 'inventario', 1));
  if (expectedVersion !== undefined && stock.version !== expectedVersion) throw new AppError(409, 'STOCK_CHANGED', 'El inventario cambio. Recarga antes de guardar.');
  if (sourceType === 'checkout' && stock.estatus !== 1) throw new AppError(409, 'OUT_OF_STOCK', 'Inventario no disponible.');
  const next = stock.cantidad + delta;
  if (!Number.isInteger(delta) || !Number.isInteger(next) || next < 0 || next > 2147483647) throw new AppError(409, 'OUT_OF_STOCK', 'Cantidad de inventario no disponible.');
  const updated = await tx.tinventario.update({ where: { id: stock.id }, data: { cantidad: next, version: { increment: 1 }, ...(status === undefined ? {} : { estatus: status }), ...(supplier === undefined ? {} : { proveedor: supplier }) } });
  await tx.inventoryMovement.create({ data: { inventoryId: stock.id, before: stock.cantidad, after: next, delta, reason, actorId, sourceType, sourceId } });
  await appendAudit(tx, { actorId, action: 'ajustar_inventario', entity: 'tinventario', entityId: stock.id, requestId, metadata: { before: stock.cantidad, after: next, delta, reason, version: updated.version, previousSupplier: stock.proveedor, supplier: updated.proveedor } });
  return updated;
}

async function adjustStock(input) {
  const inventoryId = integer(input.inventoryId, 'inventario', 1);
  if (!['add', 'remove', 'set'].includes(input.operation)) throw new AppError(400, 'INVALID_INPUT', 'Operacion de inventario invalida.');
  const quantity = integer(input.quantity, 'cantidad', input.operation === 'set' ? 0 : 1);
  const reason = validateReason(input.reason);
  const expectedVersion = input.operation === 'set' ? integer(input.expectedVersion, 'version') : undefined;
  return withTransaction(async tx => {
    await authorize(tx, input.actorId);
    const stock = await lockInventory(tx, inventoryId);
    const delta = input.operation === 'set' ? quantity - stock.cantidad : quantity * (input.operation === 'remove' ? -1 : 1);
    return changeStockTx(tx, { inventoryId, delta, sourceType: 'manual', actorId: input.actorId, reason, expectedVersion, requestId: input.requestId });
  });
}

async function editInventory(id, payload, actorId) {
  return withTransaction(async tx => {
    await authorize(tx, actorId);
    const stock = await lockInventory(tx, integer(id, 'inventario', 1));
    for (const key of ['producto', 'sucursal']) {
      if (payload[key] !== undefined && integer(payload[key], key, 1) !== stock[key]) throw new AppError(409, 'IMMUTABLE_INVENTORY', 'Crea un inventario nuevo para cambiar producto o sucursal.');
    }
    const expectedVersion = integer(payload.expectedVersion, 'version');
    const next = payload.cantidad === undefined ? stock.cantidad : integer(payload.cantidad, 'cantidad');
    const status = payload.estatus === undefined ? stock.estatus : integer(payload.estatus, 'estatus');
    if (![0, 1].includes(status)) throw new AppError(400, 'INVALID_INPUT', 'Estatus invalido.');
    return changeStockTx(tx, { inventoryId: stock.id, delta: next - stock.cantidad, sourceType: 'manual', actorId, reason: validateReason(payload.reason), expectedVersion, status, supplier: payload.proveedor === undefined ? stock.proveedor : integer(payload.proveedor, 'proveedor', 1) });
  });
}
async function createInventory(payload, actorId) {
  const data = {};
  for (const key of ['producto', 'sucursal', 'proveedor']) data[key] = integer(payload[key], key, 1);
  data.cantidad = integer(payload.cantidad, 'cantidad');
  data.estatus = payload.estatus === undefined ? 1 : integer(payload.estatus, 'estatus');
  if (![0, 1].includes(data.estatus)) throw new AppError(400, 'INVALID_INPUT', 'Estatus invalido.');
  return withTransaction(async tx => {
    await authorize(tx, actorId);
    const stock = await tx.tinventario.create({ data });
    await tx.inventoryMovement.create({ data: { inventoryId: stock.id, before: 0, after: stock.cantidad, delta: stock.cantidad, reason: 'Saldo inicial declarado', actorId, sourceType: 'opening', sourceId: stock.id } });
    await appendAudit(tx, { actorId, action: 'crear_inventario', entity: 'tinventario', entityId: stock.id, metadata: { after: stock.cantidad } });
    return stock;
  });
}
async function deactivateInventory(id, actorId) {
  return withTransaction(async tx => {
    await authorize(tx, actorId);
    const stock = await lockInventory(tx, integer(id, 'inventario', 1));
    const updated = await tx.tinventario.update({ where: { id: stock.id }, data: { estatus: 0, version: { increment: 1 } } });
    await appendAudit(tx, { actorId, action: 'desactivar_inventario', entity: 'tinventario', entityId: stock.id });
    return updated;
  });
}
module.exports = { adjustStock, changeStockTx, editInventory, createInventory, deactivateInventory };
