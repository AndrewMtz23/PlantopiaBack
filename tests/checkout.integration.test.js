const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma, fixtures } = require('./helpers/fixtures');
const request = require('supertest');
const { app } = require('../src/app');
let f;
beforeEach(async () => { f = await fixtures(); });
after(() => prisma.$disconnect());
const as = (method, url, index = 1) => request(app)[method](url).set('Authorization', `Bearer ${f.tokens[index]}`);
const address = { nombre: 'Alice', telefono: '4421234567', domicilio: 'Calle Prueba 123', ciudad: 'Queretaro', estadoDireccion: 'Queretaro', codigoPostal: '76000' };
async function cart(index = 1) {
  const add = await as('post', '/crearCarrito', index).send({ inventario: f.inventory.id, cantidad: 1, subtotal: 0.01 });
  assert.equal(add.status, 200);
  const quote = await as('get', '/carrito/cotizacion', index);
  assert.equal(quote.status, 200);
  return quote.body;
}
const buy = (quote, key, index = 1, extra = {}) => as('post', '/procesarCompra', index).set('Idempotency-Key', key).send({ quoteHash: quote.quoteHash, metodo: 'efectivo', direccionEntrega: address, ...extra });
test('cart ignores forged subtotal and rejects invalid quantities', async () => {
  for (const cantidad of [-1, 0, 1.5, null, 'bad']) assert.equal((await as('post', '/crearCarrito').send({ inventario: f.inventory.id, cantidad, subtotal: 1 })).status, 400);
  const quote = await cart();
  assert.equal(quote.total, '166.00');
  assert.equal(quote.items[0].subtotal, '100.00');
});
test('cash checkout is pending and idempotent, identity comes from token', async () => {
  const quote = await cart();
  const payload = { usuario: f.users[2].id };
  const first = await buy(quote, 'same-request-0001', 1, payload);
  assert.equal(first.status, 200);
  assert.equal(first.body.estado, 'pendiente');
  const again = await buy(quote, 'same-request-0001', 1, payload);
  assert.equal(again.status, 200); assert.equal(again.body.pagoId, first.body.pagoId);
  assert.equal(await prisma.tpagos.count(), 1);
  assert.equal((await prisma.tpagos.findFirst()).usuario, f.users[1].id);
  assert.equal((await prisma.tinventario.findFirst()).cantidad, 4);
  assert.equal((await buy(quote, 'same-request-0001', 1, { direccionEntrega: { ...address, domicilio: 'Otra direccion 123' } })).status, 409);
});
test('one last unit has only one winner under concurrent checkout', async () => {
  await prisma.tinventario.update({ where: { id: f.inventory.id }, data: { cantidad: 1 } });
  const a = await cart(1), b = await cart(2);
  const responses = await Promise.all([buy(a, 'concurrent-alice', 1), buy(b, 'concurrent-bob', 2)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  assert.equal(await prisma.tpagos.count(), 1);
  assert.equal(await prisma.tventas.count(), 1);
  assert.equal((await prisma.tinventario.findFirst()).cantidad, 0);
});
test('duplicate concurrent request produces a single purchase', async () => {
  const quote = await cart();
  const responses = await Promise.all([buy(quote, 'duplicate-request'), buy(quote, 'duplicate-request')]);
  assert.deepEqual(responses.map(r => r.status), [200, 200]);
  assert.equal(responses[0].body.pagoId, responses[1].body.pagoId);
  assert.equal(await prisma.tventas.count(), 1);
});
test('changed price or inactive product invalidates checkout', async () => {
  const quote = await cart();
  await prisma.tproductos.update({ where: { id: f.product.id }, data: { precioVenta: 120 } });
  assert.equal((await buy(quote, 'changed-price')).status, 409);
  await prisma.tproductos.update({ where: { id: f.product.id }, data: { estatus: 0 } });
  assert.equal((await buy(quote, 'inactive-product')).status, 409);
  assert.equal(await prisma.tpagos.count(), 0);
});
test('unverified PayPal and incomplete delivery address are rejected', async () => {
  const quote = await cart();
  assert.equal((await buy(quote, 'fake-paypal-key', 1, { metodo: 'paypal', referencia: 'fake' })).status, 400);
  assert.equal((await buy(quote, 'invalid-address', 1, { direccionEntrega: {} })).status, 400);
  assert.equal(await prisma.tpagos.count(), 0);
  assert.equal((await prisma.tinventario.findFirst()).cantidad, 5);
});
test('database error during sale insertion rolls back payment, stock and cart', async () => {
  const quote = await cart();
  await prisma.$executeRawUnsafe(`CREATE FUNCTION fail_test_sale() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe('CREATE TRIGGER fail_test_sale BEFORE INSERT ON tventas FOR EACH ROW EXECUTE FUNCTION fail_test_sale()');
  try {
    assert.equal((await buy(quote, 'rollback-request')).status, 500);
    assert.equal(await prisma.tpagos.count(), 0);
    assert.equal(await prisma.tpedido.count(), 1);
    assert.equal((await prisma.tinventario.findFirst()).cantidad, 5);
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER fail_test_sale ON tventas');
    await prisma.$executeRawUnsafe('DROP FUNCTION fail_test_sale()');
  }
});
