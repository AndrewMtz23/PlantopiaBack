const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma, fixtures } = require('./helpers/fixtures');
process.env.AUTH_RATE_LIMIT = '3';
const request = require('supertest');
const { app } = require('../src/app');
after(() => prisma.$disconnect());
test('health and readiness are usable without exposing database configuration', async () => {
  for (const url of ['/health', '/ready']) {
    const response = await request(app).get(url);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { ok: true });
  }
});
test('API errors have a stable object contract and conceal DB internals', async () => {
  const f = await fixtures();
  const missing = await request(app).get('/not-a-route');
  assert.equal(missing.status, 404); assert.equal(typeof missing.body.error.code, 'string');
  const invalid = await request(app).delete('/eliminarCarrito/not-an-id').set('Authorization', `Bearer ${f.tokens[1]}`);
  assert.ok(invalid.status >= 400);
  assert.equal(typeof invalid.body.error.message, 'string');
  assert.equal(/Prisma|Invalid.*invocation|node_modules|SELECT/i.test(invalid.body.error.message), false);
});
test('login rate limit returns 429 after repeated failed attempts', async () => {
  const statuses = [];
  for (let i = 0; i < 4; i++) statuses.push((await request(app).post('/auth/login').send({ correo: 'unknown@example.test', clave: 'wrong-password' })).status);
  assert.equal(statuses[3], 429);
});
