const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma, fixtures } = require('./helpers/fixtures');
const request = require('supertest');
const { app } = require('../src/app');
const UserService = require('../src/services/UserService');
let f;
beforeEach(async () => { f = await fixtures(); });
after(() => prisma.$disconnect());
const registration = () => ({ nombre: 'New Customer', fechaNacimiento: '1990-01-01', genero: 'otro', telefono: '4421234567', correo: 'new@example.test', domicilio: 'Calle prueba 123', clave: 'Password123!' });
test('the existing registration payload works without granting client-selected privileges', async () => {
  const r = await request(app).post('/auth/register').send({ ...registration(), estatus: 1, tipo: 2 });
  assert.equal(r.status, 201);
  assert.equal((await prisma.tusuarios.findUnique({ where: { id: r.body.idUsuario } })).tipo, 2);
  assert.equal((await request(app).post('/auth/register').send({ ...registration(), correo: 'injected@example.test', tipo: 1 })).status, 400);
});
test('privileged creation and password changes both roll back when business audit fails', async () => {
  await prisma.$executeRawUnsafe("CREATE FUNCTION test_identity_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$");
  await prisma.$executeRawUnsafe('CREATE TRIGGER test_identity_audit_failure BEFORE INSERT ON tlogs FOR EACH ROW EXECUTE FUNCTION test_identity_audit_failure()');
  try {
    await assert.rejects(UserService.createUser({ ...registration(), tipo: 1, estatus: 1 }, null, null, f.users[0].id));
    assert.equal(await prisma.tusuarios.count(), 4);
    await assert.rejects(UserService.changePassword(f.users[1].id, 'Password123!', 'ChangedPassword123!', 'ChangedPassword123!'));
    const user = await prisma.tusuarios.findUnique({ where: { id: f.users[1].id } });
    assert.equal(user.clave, f.users[1].clave); assert.equal(user.tokenVersion, 0);
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER test_identity_audit_failure ON tlogs');
    await prisma.$executeRawUnsafe('DROP FUNCTION test_identity_audit_failure()');
  }
});
test('dashboard totals do not depend on loading the detailed sales report', async () => {
  const metrics = require('../src/services/MetricService');
  const original = metrics.getSalesByBranch;
  metrics.getSalesByBranch = async () => { throw new Error('report too large'); };
  try { assert.equal((await metrics.getDashboardSummary()).pagosProcesados, 0); }
  finally { metrics.getSalesByBranch = original; }
});
test('a supplier can change with a reviewed version and auditable reason', async () => {
  const provider = await prisma.tproveedores.create({ data: { estatus: 1, marca: 'Alternate', representante: 'Test', telefono: '4421234567', correo: 'alternate@example.test', direccion: 'Test', fechaContrato: '2026-01-01' } });
  const service = require('../src/modules/inventory/inventoryService');
  const updated = await service.editInventory(f.inventory.id, { proveedor: provider.id, expectedVersion: 0, reason: 'Cambio de proveedor autorizado' }, f.users[0].id);
  assert.equal(updated.proveedor, provider.id); assert.equal(updated.cantidad, 5);
  const audit = await prisma.tlogs.findFirst({ orderBy: { id: 'desc' } });
  assert.equal(audit.metadata.previousSupplier, f.inventory.proveedor);
  assert.equal(audit.metadata.supplier, provider.id);
});
test('sales report date filters provide a real recovery path', async () => {
  const pay = await prisma.tpagos.create({ data: { usuario: f.users[1].id, metodo: 'efectivo', estado: 'pagado', subtotal: 100, iva: 16, envio: 50, total: 166 } });
  await prisma.tventas.create({ data: { usuario: f.users[1].id, pago: pay.id, producto: f.product.id, inventario: f.inventory.id, sucursal: f.branch.id, cantidad: 1, total: 100, fechaRegistro: new Date('2020-01-01T12:00:00Z') } });
  const metrics = require('../src/services/MetricService');
  assert.equal((await metrics.getSalesByBranch({ from: '2020-01-01', to: '2020-01-02' })).length, 1);
  assert.equal((await metrics.getSalesByBranch({ from: '2021-01-01', to: '2021-01-02' })).length, 0);
  await assert.rejects(metrics.getSalesByBranch({ from: 'bad', to: '2021-01-01' }), error => error.code === 'INVALID_DATE_RANGE');
  const response = await request(app).get('/ventasPorSucursal?from=2021-01-01&to=2021-01-02').set('Authorization', `Bearer ${f.tokens[0]}`);
  assert.equal(response.status, 200); assert.deepEqual(response.body, []);
});
