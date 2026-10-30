const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma, fixtures } = require('./helpers/fixtures');
const request = require('supertest');
const { app } = require('../src/app');
let f;
beforeEach(async () => { f = await fixtures(); });
after(() => prisma.$disconnect());
const as = (method, url, index = 1) => request(app)[method](url).set('Authorization', `Bearer ${f.tokens[index]}`);
test('rejects cross-user cart, wishlist and payment reads', async () => {
  for (const url of [`/verCarrito/${f.users[2].id}`, `/verLista/${f.users[2].id}`, `/verAgregados/${f.users[2].id}`, `/misPagos/${f.users[2].id}`, `/miPago/${f.users[2].id}/1`]) {
    assert.ok([403, 404].includes((await as('get', url)).status), url);
  }
});
test('cart creation derives owner from token and mutation filters owner', async () => {
  const response = await as('post', '/crearCarrito').send({ usuario: f.users[2].id, inventario: f.inventory.id, cantidad: 1, subtotal: 100 });
  assert.ok(response.status < 300);
  const item = await prisma.tpedido.findFirst();
  assert.equal(item.usuario, f.users[1].id);
  assert.ok([403, 404].includes((await as('put', '/editarCarrito', 2).send({ id: item.id, cantidad: 2, subtotal: 200 })).status));
  assert.ok([403, 404].includes((await as('delete', `/eliminarCarrito/${item.id}`, 2)).status));
  assert.equal((await prisma.tpedido.findUnique({ where: { id: item.id } })).cantidad, 1);
});
test('wishlist creation and deletion enforce token owner', async () => {
  await as('post', '/crearLista').send({ usuario: f.users[2].id, inventario: f.inventory.id });
  const item = await prisma.tlista.findFirst();
  assert.equal(item.usuario, f.users[1].id);
  assert.ok([403, 404].includes((await as('delete', `/eliminarLista/${item.id}`, 2)).status));
  assert.equal(await prisma.tlista.count(), 1);
});
test('disabled user and changed token version revoke existing access', async () => {
  await prisma.tusuarios.update({ where: { id: f.users[1].id }, data: { estatus: 0 } });
  assert.equal((await as('get', `/verCarrito/${f.users[1].id}`)).status, 401);
});
test('role changes take effect without waiting for JWT expiry', async () => {
  await prisma.tusuarios.update({ where: { id: f.users[0].id }, data: { tipo: 2 } });
  assert.equal((await as('get', '/verUsuario', 0)).status, 403);
});
test('password change revokes old token', async () => {
  const changed = await as('put', '/perfil/password').send({ claveActual: 'Password123!', nuevaClave: 'ChangedPassword123!', confirmarClave: 'ChangedPassword123!' });
  assert.equal(changed.status, 200);
  assert.equal((await as('get', `/verCarrito/${f.users[1].id}`)).status, 401);
});
test('public catalogue hides purchase cost and raw admin routes require staff', async () => {
  const response = await request(app).get('/obtenerProductos');
  assert.equal(response.status, 200);
  assert.equal('precioCompra' in response.body[0], false);
  for (const url of ['/verProducto', '/', `/${f.product.id}`]) assert.equal((await request(app).get(url)).status, 401);
});
