const { test, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { prisma, fixtures } = require('./helpers/fixtures');
const { writeActivityLog } = require('../src/utils/activityLog');
let f;
beforeEach(async () => { f = await fixtures(); });
after(() => prisma.$disconnect());
test('legacy audit helper honors a caller transaction rollback', async () => {
  await assert.rejects(prisma.$transaction(async tx => {
    await writeActivityLog(tx, { usuario: f.users[0].id, modulo: 'test', accion: 'rollback_probe', descripcion: 'Test' });
    throw new Error('rollback probe');
  }), /rollback probe/);
  assert.equal(await prisma.tlogs.count(), 0);
});
test('audit stores only allowed metadata and refuses an absent transaction', async () => {
  const { appendAudit } = require('../src/modules/audit/auditService');
  await assert.rejects(appendAudit(null, { action: 'confirmar_cobro' }), /transaction/);
  await prisma.$transaction(tx => appendAudit(tx, { actorId: f.users[0].id, action: 'confirmar_cobro', entity: 'tpagos', entityId: 1, requestId: 'request-test', metadata: { clave: 'secret', token: 'token', direccionEntrega: 'private address', arbitrary: 'value' } }));
  const log = await prisma.tlogs.findFirst();
  assert.deepEqual(log.metadata, { requestId: 'request-test' });
});
test('shared transactions retry serialization conflicts but not validation or unique constraints', async () => {
  const { withTransaction } = require('../src/infrastructure/db/transaction');
  for (const code of ['P2002', 'INVALID_INPUT']) {
    let calls = 0;
    await assert.rejects(withTransaction(async () => {}, { client: { $transaction: async () => { calls++; throw Object.assign(new Error('failure'), { code }); } } }));
    assert.equal(calls, 1);
  }
  let calls = 0;
  const value = await withTransaction(async () => {}, { client: { $transaction: async () => { if (++calls < 3) throw Object.assign(new Error('retry'), { code: 'P2034' }); return 42; } } });
  assert.equal(value, 42); assert.equal(calls, 3);
});
test('a database audit failure rolls back cash collection and cancellation stock restoration', async () => {
  const { confirmCashPayment, updateDelivery } = require('../src/services/PaymentStateService');
  const payment = await prisma.tpagos.create({ data: { usuario: f.users[1].id, metodo: 'efectivo', estado: 'pendiente', estadoEntrega: 'preparando', subtotal: 100, iva: 16, envio: 50, total: 166 } });
  await prisma.tventas.create({ data: { usuario: f.users[1].id, pago: payment.id, producto: f.product.id, inventario: f.inventory.id, cantidad: 1, total: 100 } });
  await prisma.tinventario.update({ where: { id: f.inventory.id }, data: { cantidad: 4 } });
  await prisma.$executeRawUnsafe("CREATE FUNCTION test_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$");
  await prisma.$executeRawUnsafe('CREATE TRIGGER test_reject_audit BEFORE INSERT ON tlogs FOR EACH ROW EXECUTE FUNCTION test_reject_audit()');
  try {
    await assert.rejects(confirmCashPayment({ paymentId: payment.id, actorId: f.users[0].id }));
    assert.equal((await prisma.tpagos.findUnique({ where: { id: payment.id } })).estado, 'pendiente');
    await assert.rejects(updateDelivery({ paymentId: payment.id, status: 'cancelado', actorId: f.users[0].id, actorRole: 1 }));
    assert.equal((await prisma.tinventario.findUnique({ where: { id: f.inventory.id } })).cantidad, 4);
    assert.equal((await prisma.tpagos.findUnique({ where: { id: payment.id } })).estadoEntrega, 'preparando');
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER test_reject_audit ON tlogs');
    await prisma.$executeRawUnsafe('DROP FUNCTION test_reject_audit()');
  }
});
