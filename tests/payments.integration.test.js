const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma, fixtures } = require('./helpers/fixtures');
const request = require('supertest');
const { app } = require('../src/app');
let f, payment;
beforeEach(async () => {
  f = await fixtures();
  payment = await prisma.tpagos.create({ data: { usuario: f.users[1].id, estado: 'pendiente', total: 166 } });
  await prisma.tventas.create({ data: { usuario: f.users[1].id, producto: f.product.id, pago: payment.id, inventario: f.inventory.id, sucursal: f.branch.id, cantidad: 1, total: 100 } });
  await prisma.tinventario.update({ where: { id: f.inventory.id }, data: { cantidad: 4 } });
});
after(() => prisma.$disconnect());
const as = (method, url, index = 0) => request(app)[method](url).set('Authorization', `Bearer ${f.tokens[index]}`);
test('only administrator can confirm cash and retry is harmless', async () => {
  const url = `/pagos/${payment.id}/confirmar-efectivo`;
  assert.equal((await as('post', url, 1)).status, 403);
  assert.equal((await as('post', url)).status, 200);
  assert.equal((await as('post', url)).status, 200);
  const paid = await prisma.tpagos.findUnique({ where: { id: payment.id } });
  assert.equal(paid.estado, 'pagado'); assert.equal(paid.cobradoPor, f.users[0].id);
  assert.equal(await prisma.tlogs.count({ where: { accion: 'confirmar_cobro' } }), 1);
});
test('cancel unpaid order restores stock exactly once across repeated calls', async () => {
  const url = `/pedidos/estado/${payment.id}`;
  const responses = await Promise.all([as('put', url).send({ status: 'cancelado' }), as('put', url).send({ status: 'cancelado' })]);
  assert.deepEqual(responses.map(r => r.status), [200, 200]);
  assert.equal((await prisma.tinventario.findFirst()).cantidad, 5);
  assert.equal((await prisma.tpagos.findFirst()).estado, 'cancelado');
  assert.equal((await as('post', `/pagos/${payment.id}/confirmar-efectivo`)).status, 409);
});
test('paid orders cannot be cancelled through either endpoint', async () => {
  await prisma.tpagos.update({ where: { id: payment.id }, data: { estado: 'pagado' } });
  for (const url of [`/pedidos/estado/${payment.id}`, `/actualizarSeguimientoPago/${payment.id}`]) {
    const response = await as('put', url).send({ status: 'cancelado', estadoEntrega: 'cancelado' });
    assert.equal(response.status, 409);
  }
  assert.equal((await prisma.tinventario.findFirst()).cantidad, 4);
});
test('couriers compete for assignment atomically', async () => {
  await prisma.tpagos.update({ where: { id: payment.id }, data: { estadoEntrega: 'listo' } });
  const responses = await Promise.all([as('post', `/reparto/asignar/${payment.id}`, 3), as('post', `/reparto/asignar/${payment.id}`, 0)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
});
test('tracking edits preserve notes without bypassing delivery transitions', async () => {
  const response = await as('put', `/actualizarSeguimientoPago/${payment.id}`).send({ estadoEntrega: 'preparando', notasEntrega: 'Llamar al llegar', guiaEntrega: 'GUIA-1', fechaEstimadaEntrega: '2026-11-01' });
  assert.equal(response.status, 200);
  assert.equal((await prisma.tpagos.findFirst()).notasEntrega, 'Llamar al llegar');
  assert.equal((await as('put', `/actualizarSeguimientoPago/${payment.id}`).send({ estadoEntrega: 'entregado' })).status, 409);
});
test('customer payment responses never expose purchase costs', async () => {
  await prisma.tventas.updateMany({ where: { pago: payment.id }, data: { costoUnitario: 50 } });
  for (const url of [`/miPago/${f.users[1].id}/${payment.id}`, `/misPagos/${f.users[1].id}`]) {
    const response = await as('get', url, 1);
    assert.equal(response.status, 200);
    assert.equal(/precioCompra|costoUnitario/.test(JSON.stringify(response.body)), false);
  }
});
test('pending and cancelled orders are excluded from paid sales metrics', async () => {
  const metrics = require('../src/services/MetricService');
  for (const estado of ['pendiente', 'cancelado']) {
    await prisma.tpagos.update({ where: { id: payment.id }, data: { estado } });
    const summary = await metrics.getDashboardSummary();
    assert.equal(summary.productosTop.length, 0);
    assert.equal(summary.ventasPorSucursal.length, 0);
    assert.equal(summary.rentabilidadPromedio, 0);
  }
  await prisma.tpagos.update({ where: { id: payment.id }, data: { estado: 'pagado' } });
  assert.equal((await metrics.getDashboardSummary()).productosTop.length, 1);
});
