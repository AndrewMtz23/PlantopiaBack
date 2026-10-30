const AppError = require('../utils/AppError');
const { withTransaction: transaction } = require('../infrastructure/db/transaction');
const { appendAudit } = require('../modules/audit/auditService');
const notFound = () => new AppError(404, 'NOT_FOUND', 'Pedido no encontrado.');
const conflict = () => new AppError(409, 'INVALID_TRANSITION', 'El pedido no admite esta operacion.');
async function lock(tx, id) { await tx.$queryRaw`SELECT id FROM tpagos WHERE id = ${Number(id)} FOR UPDATE`; }
async function log(tx, actor, id, action) {
  await appendAudit(tx, { actorId: actor, action, entity: 'tpagos', entityId: id });
}
async function confirmCashPayment({ paymentId, actorId }) {
  return transaction(async tx => {
    const actor = await tx.tusuarios.findUnique({ where: { id: Number(actorId) } });
    if (!actor || actor.estatus !== 1 || actor.tipo !== 1) throw new AppError(403, 'FORBIDDEN', 'Accion exclusiva del administrador.');
    await lock(tx, paymentId);
    const payment = await tx.tpagos.findUnique({ where: { id: Number(paymentId) } });
    if (!payment) throw notFound();
    if (payment.metodo !== 'efectivo' || payment.estadoEntrega === 'cancelado') throw conflict();
    if (payment.estado === 'pagado') return payment;
    if (payment.estado !== 'pendiente') throw conflict();
    const result = await tx.tpagos.update({ where: { id: payment.id }, data: { estado: 'pagado', cobradoPor: actor.id, fechaCobro: new Date() } });
    await log(tx, actor.id, payment.id, 'confirmar_cobro');
    return result;
  });
}
async function updateDelivery({ paymentId, status, actorId, actorRole, tracking }) {
  return transaction(async tx => {
    await lock(tx, paymentId);
    const payment = await tx.tpagos.findUnique({ where: { id: Number(paymentId) } });
    if (!payment) throw notFound();
    if (actorRole === 4) {
      if (payment.repartidorId !== actorId || payment.estadoEntrega !== 'enviado' || status !== 'entregado') throw new AppError(403, 'FORBIDDEN', 'Solo puedes confirmar tu entrega asignada.');
    } else if (![1, 3].includes(actorRole)) throw new AppError(403, 'FORBIDDEN', 'Sin permisos.');
    else if (status === 'cancelado') {
      if (payment.estado === 'cancelado' && payment.estadoEntrega === 'cancelado') return payment;
      if (payment.metodo !== 'efectivo' || payment.estado !== 'pendiente' || !['preparando', 'listo'].includes(payment.estadoEntrega)) throw conflict();
      const sales = await tx.tventas.findMany({ where: { pago: payment.id } });
      if (!sales.length || sales.some(sale => !sale.inventario)) throw new AppError(409, 'LEGACY_ORDER', 'Pedido historico: requiere conciliacion manual.');
      for (const sale of sales) await tx.tinventario.update({ where: { id: sale.inventario }, data: { cantidad: { increment: sale.cantidad } } });
      const result = await tx.tpagos.update({ where: { id: payment.id }, data: { estado: 'cancelado', estadoEntrega: 'cancelado' } });
      await log(tx, actorId, payment.id, 'cancelar_pedido');
      return result;
    } else {
      const transitions = { preparando: ['listo'], listo: ['preparando'] };
      if (!(transitions[payment.estadoEntrega] || []).includes(status) && !(tracking && actorRole === 1 && status === payment.estadoEntrega)) throw conflict();
    }
    const extra = {};
    if (tracking && actorRole === 1) {
      for (const [field, max] of [['guiaEntrega', 120], ['notasEntrega', 500]]) {
        if (tracking[field] !== undefined) {
          if (typeof tracking[field] !== 'string' || tracking[field].length > max) throw new AppError(400, 'INVALID_TRACKING', 'Datos de seguimiento invalidos.');
          extra[field] = tracking[field] || null;
        }
      }
      if (tracking.fechaEstimadaEntrega !== undefined) {
        const value = tracking.fechaEstimadaEntrega;
        if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new AppError(400, 'INVALID_DATE', 'Fecha invalida.');
        extra.fechaEstimadaEntrega = value ? new Date(value) : null;
      }
    }
    const result = await tx.tpagos.update({ where: { id: payment.id }, data: { estadoEntrega: status, ...extra } });
    await log(tx, actorId, payment.id, 'actualizar_entrega');
    return result;
  });
}
async function assignDelivery(paymentId, actorId) {
  return transaction(async tx => {
    const result = await tx.tpagos.updateMany({ where: { id: Number(paymentId), repartidorId: null, estadoEntrega: 'listo', estado: { in: ['pendiente', 'pagado'] } }, data: { repartidorId: Number(actorId), estadoEntrega: 'enviado' } });
    if (result.count !== 1) throw conflict();
    await log(tx, Number(actorId), Number(paymentId), 'asignar_repartidor');
    return tx.tpagos.findUnique({ where: { id: Number(paymentId) } });
  });
}
module.exports = { confirmCashPayment, updateDelivery, assignDelivery };
