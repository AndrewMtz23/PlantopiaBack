const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma, fixtures } = require('./helpers/fixtures');
const { app } = require('../src/app');
const { startServer, shutdownServer } = require('../src/startServer');
after(() => prisma.$disconnect());
test('real HTTP login, checkout, cash collection and cancellation work through the listener', async () => {
  const f = await fixtures();
  const server = await startServer({ app, prisma, port: 0 });
  if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (url, { method = 'GET', token, body, key } = {}) => {
    const response = await fetch(base + url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    assert.ok(response.ok, `${url}: ${response.status}`);
    return data;
  };
  try {
    assert.deepEqual(await call('/ready'), { ok: true });
    const { token } = await call('/auth/login', { method: 'POST', body: { correo: 'alice@example.test', clave: 'Password123!' } });
    const buy = async key => {
      await call('/crearCarrito', { method: 'POST', token, body: { inventario: f.inventory.id, cantidad: 1 } });
      const quote = await call('/carrito/cotizacion', { token });
      return call('/procesarCompra', { method: 'POST', token, key, body: { quoteHash: quote.quoteHash, metodo: 'efectivo', direccionEntrega: { nombre: 'Alice', telefono: '4421234567', domicilio: 'Calle Prueba 123', ciudad: 'Queretaro', estadoDireccion: 'Queretaro', codigoPostal: '76000' } } });
    };
    const paid = await buy('http-smoke-paid');
    await call(`/pagos/${paid.pagoId}/confirmar-efectivo`, { method: 'POST', token: f.tokens[0], body: {} });
    const cancelled = await buy('http-smoke-cancel');
    await call(`/pedidos/estado/${cancelled.pagoId}`, { method: 'PUT', token: f.tokens[0], body: { status: 'cancelado' } });
    assert.equal((await prisma.tinventario.findFirst()).cantidad, 4);
  } finally { await shutdownServer(server, prisma); }
  assert.equal(server.listening, false);
});
