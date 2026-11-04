const AppError = require('../../utils/AppError');
async function lockInventory(tx, id) {
  await tx.$queryRaw`SELECT id FROM tinventario WHERE id = ${id} FOR UPDATE`;
  const row = await tx.tinventario.findUnique({ where: { id } });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Inventario no encontrado.');
  return row;
}
module.exports = { lockInventory };
