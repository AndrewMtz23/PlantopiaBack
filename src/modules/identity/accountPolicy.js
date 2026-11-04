const AppError = require('../../utils/AppError');
const { appendAudit } = require('../audit/auditService');
const { integer } = require('../inventory/inventoryValidation');

async function changeAccountAccess(tx, { targetId, actorId, role, status, requestId }) {
  targetId = integer(targetId, 'usuario', 1);
  actorId = integer(actorId, 'administrador', 1);
  // Serialize all administrator membership changes, including cross-demotions.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(72614001)`;
  const actor = await tx.tusuarios.findUnique({ where: { id: actorId } });
  if (!actor || actor.estatus !== 1 || actor.tipo !== 1) throw new AppError(403, 'FORBIDDEN', 'Accion exclusiva del administrador.');
  const user = await tx.tusuarios.findUnique({ where: { id: targetId } });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'Usuario no encontrado.');
  role = role === undefined ? user.tipo : integer(role, 'rol', 1);
  status = status === undefined ? user.estatus : integer(status, 'estatus');
  if (![1, 2, 3, 4].includes(role) || ![0, 1].includes(status)) throw new AppError(400, 'INVALID_INPUT', 'Rol o estatus invalido.');
  if (user.tipo === 1 && user.estatus === 1 && (role !== 1 || status !== 1)) {
    const admins = await tx.tusuarios.count({ where: { tipo: 1, estatus: 1 } });
    if (admins <= 1) throw new AppError(409, 'LAST_ADMIN', 'Debe permanecer al menos un administrador activo.');
  }
  if (targetId === actorId && status === 0) throw new AppError(409, 'SELF_DEACTIVATION', 'No puedes desactivar tu propia cuenta.');
  if (role === user.tipo && status === user.estatus) return user;
  const updated = await tx.tusuarios.update({ where: { id: targetId }, data: { tipo: role, estatus: status, tokenVersion: { increment: 1 } } });
  await appendAudit(tx, { actorId, action: 'cambiar_acceso', entity: 'tusuarios', entityId: targetId, requestId, metadata: { previousRole: user.tipo, role, previousStatus: user.estatus, status } });
  return updated;
}
module.exports = { changeAccountAccess };
