const prisma = require('../../config/prisma');
const allowedMetadata = {
  ajustar_inventario: ['delta', 'before', 'after', 'reason', 'version'],
  crear_inventario: ['after'],
  cambiar_acceso: ['previousRole', 'role', 'previousStatus', 'status'],
};
async function appendAudit(tx, { actorId = null, action, entity, entityId, requestId, metadata = {} }) {
  if (!tx?.tlogs || tx === prisma) throw new Error('Audit requires an active transaction');
  const safe = {};
  for (const key of allowedMetadata[action] || []) {
    const value = metadata[key];
    if (typeof value === 'number' && Number.isFinite(value)) safe[key] = value;
    else if (key === 'reason' && typeof value === 'string') safe[key] = value.slice(0, 250);
  }
  if (typeof requestId === 'string' && /^[\w-]{1,64}$/.test(requestId)) safe.requestId = requestId;
  return tx.tlogs.create({ data: { usuario: actorId, modulo: entity || 'sistema', accion: action, descripcion: action,
    entidad: entity || null, entidadId: entityId || null, metadata: safe, nivel: 'info' } });
}
module.exports = { appendAudit };
