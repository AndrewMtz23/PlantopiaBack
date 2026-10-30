const prisma = require('../config/prisma');
const { appendAudit } = require('../modules/audit/auditService');
const { writeTechnicalLog } = require('../infrastructure/logging/logger');
const getRequestIp = req => req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || null;

async function writeActivityLog(executor, payload) {
  if (!payload.modulo || !payload.accion || !payload.descripcion) return;
  const entry = { actorId: payload.usuario || null, action: payload.accion, entity: payload.entidad || payload.modulo,
    entityId: payload.entidadId, requestId: payload.requestId, metadata: payload.metadata };
  if (executor) return appendAudit(executor, entry);
  // Transitional best-effort logging for non-migrated legacy CRUD/login callers.
  // Sensitive mutations use appendAudit in their owning transaction instead.
  try { await prisma.$transaction(tx => appendAudit(tx, entry)); }
  catch { writeTechnicalLog({ level: 'error', event: 'legacy_audit_failed', requestId: payload.requestId }); }
}
module.exports = { getRequestIp, writeActivityLog };
