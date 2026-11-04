const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma, fixtures } = require('./helpers/fixtures');
const request = require('supertest');
const { app } = require('../src/app');
const ProductService = require('../src/services/ProductService');
let f;
beforeEach(async () => { f = await fixtures(); });
after(() => prisma.$disconnect());
const admin = (url, body) => request(app).put(url).set('Authorization', `Bearer ${f.tokens[0]}`).send(body);
test('legacy inventory edits require a version and stale replacements return 409', async () => {
  const payload = { id: f.inventory.id, cantidad: 8, reason: 'Conteo fisico' };
  assert.equal((await admin('/editarInventario', payload)).status, 400);
  assert.equal((await admin('/editarInventario', { ...payload, expectedVersion: 0 })).status, 200);
  assert.equal((await admin('/editarInventario', { ...payload, cantidad: 99, expectedVersion: 0 })).status, 409);
  const stock = await prisma.tinventario.findUnique({ where: { id: f.inventory.id } });
  assert.equal(stock.cantidad, 8); assert.equal(stock.version, 1);
});
test('simultaneous delta changes preserve both effects and create movements', async () => {
  const { adjustStock } = require('../src/modules/inventory/inventoryService');
  await Promise.all([
    adjustStock({ inventoryId: f.inventory.id, operation: 'remove', quantity: 1, actorId: f.users[0].id, reason: 'Salida manual' }),
    adjustStock({ inventoryId: f.inventory.id, operation: 'add', quantity: 2, actorId: f.users[0].id, reason: 'Entrada manual' }),
  ]);
  const stock = await prisma.tinventario.findUnique({ where: { id: f.inventory.id } });
  assert.equal(stock.cantidad, 6); assert.equal(stock.version, 2);
  assert.equal(await prisma.inventoryMovement.count(), 2);
});
test('negative stock, fractional quantity and missing reason are rejected without mutation', async () => {
  const { adjustStock } = require('../src/modules/inventory/inventoryService');
  const input = { inventoryId: f.inventory.id, operation: 'remove', quantity: 6, actorId: f.users[0].id, reason: 'Salida manual' };
  await assert.rejects(adjustStock(input), error => error.code === 'OUT_OF_STOCK');
  await assert.rejects(adjustStock({ ...input, quantity: 1.5 }));
  await assert.rejects(adjustStock({ ...input, quantity: 1, reason: '' }));
  assert.equal((await prisma.tinventario.findFirst()).cantidad, 5);
  assert.equal(await prisma.inventoryMovement.count(), 0);
});
test('catalog references cannot be silently reassigned on an existing inventory', async () => {
  await assert.rejects(ProductService.updateInventory(f.inventory.id, { producto: f.product.id + 1, expectedVersion: 0 }, null, f.users[0].id), error => error.code === 'IMMUTABLE_INVENTORY');
});

test('checkout racing an adjustment preserves stock and cancellation restores it once', async () => {
  const { adjustStock } = require('../src/modules/inventory/inventoryService');
  const { checkout, getQuote } = require('../src/services/CheckoutService');
  const { updateDelivery } = require('../src/services/PaymentStateService');
  await prisma.tpedido.create({ data: { usuario: f.users[1].id, inventario: f.inventory.id, cantidad: 1, subtotal: 100 } });
  const quote = await getQuote(f.users[1].id);
  const [payment] = await Promise.all([
    checkout({ userId: f.users[1].id, payload: { quoteHash: quote.quoteHash, metodo: 'efectivo', direccionEntrega: { nombre: 'Alice', telefono: '4421234567', domicilio: 'Calle Prueba 123', ciudad: 'Queretaro', estadoDireccion: 'Queretaro', codigoPostal: '76000' } }, idempotencyKey: 'stock-race-request' }),
    adjustStock({ inventoryId: f.inventory.id, operation: 'add', quantity: 2, reason: 'Entrada manual', actorId: f.users[0].id }),
  ]);
  assert.equal((await prisma.tinventario.findFirst()).cantidad, 6);
  const cancel = () => updateDelivery({ paymentId: payment.pagoId, status: 'cancelado', actorId: f.users[0].id, actorRole: 1 });
  await Promise.all([cancel(), cancel()]);
  assert.equal((await prisma.tinventario.findFirst()).cantidad, 7);
  assert.equal(await prisma.inventoryMovement.count(), 3);
});

test('movement or audit insertion failure rolls back the whole manual adjustment', async () => {
  const { adjustStock } = require('../src/modules/inventory/inventoryService');
  for (const table of ['inventory_movements', 'tlogs']) {
    await prisma.$executeRawUnsafe("CREATE FUNCTION test_stock_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$");
    await prisma.$executeRawUnsafe(`CREATE TRIGGER test_stock_failure BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION test_stock_failure()`);
    try {
      await assert.rejects(adjustStock({ inventoryId: f.inventory.id, operation: 'add', quantity: 2, reason: 'Entrada manual', actorId: f.users[0].id }));
      const stock = await prisma.tinventario.findFirst();
      assert.equal(stock.cantidad, 5); assert.equal(stock.version, 0);
      assert.equal(await prisma.inventoryMovement.count(), 0);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER test_stock_failure ON ${table}`);
      await prisma.$executeRawUnsafe('DROP FUNCTION test_stock_failure()');
    }
  }
});
