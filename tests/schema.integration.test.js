const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma, fixtures } = require('./helpers/fixtures');
let f;
beforeEach(async () => { f = await fixtures(); });
after(() => prisma.$disconnect());
test('database rejects duplicate normalized email', async () => {
  await assert.rejects(prisma.tusuarios.update({ where: { id: f.users[2].id }, data: { correo: f.users[1].correo } }));
});
test('database rejects negative inventory and nonpositive cart quantity', async () => {
  await assert.rejects(prisma.tinventario.update({ where: { id: f.inventory.id }, data: { cantidad: -1 } }));
  await assert.rejects(prisma.tpedido.create({ data: { usuario: f.users[1].id, inventario: f.inventory.id, cantidad: 0, subtotal: 0 } }));
});
test('database protects payment and image foreign keys', async () => {
  await assert.rejects(prisma.tpagos.create({ data: { usuario: 99999 } }));
  await assert.rejects(prisma.tproducto_imagenes.create({ data: { producto: 99999, ruta: 'test' } }));
});
test('money uses exact decimals and cart rows are unique per owner/inventory', async () => {
  const product = await prisma.tproductos.update({ where: { id: f.product.id }, data: { precioVenta: '0.10' } });
  assert.equal(product.precioVenta.toFixed(2), '0.10');
  const data = { usuario: f.users[1].id, inventario: f.inventory.id, cantidad: 1, subtotal: '0.10' };
  await prisma.tpedido.create({ data });
  await assert.rejects(prisma.tpedido.create({ data }));
});
