const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('./helpers/fixtures');
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
const request = require('supertest');
const { app } = require('../src/app');
const { getRequestIp } = require('../src/utils/activityLog');
after(() => prisma.$disconnect());
test('CORS permits configured origins only and does not replace authentication', async () => {
  const yes = await request(app).get('/health').set('Origin', 'http://localhost:3000');
  assert.equal(yes.headers['access-control-allow-origin'], 'http://localhost:3000');
  const no = await request(app).get('/health').set('Origin', 'https://untrusted.example');
  assert.equal(no.headers['access-control-allow-origin'], undefined);
  assert.equal((await request(app).get('/perfil')).status, 401);
  assert.equal(yes.headers['x-content-type-options'], 'nosniff');
});
test('oversized JSON receives a safe 413 and a server-generated request id', async () => {
  const response = await request(app).post('/auth/login').set('X-Request-Id', 'attacker').send({ payload: 'x'.repeat(102401) });
  assert.equal(response.status, 413);
  assert.match(response.headers['x-request-id'], /^[a-f0-9-]{36}$/);
  assert.equal(response.body.error.requestId, response.headers['x-request-id']);
  assert.equal(response.body.error.code, 'PAYLOAD_TOO_LARGE');
  assert.equal(JSON.stringify(response.body).includes('payload'), false);
});
test('untrusted forwarded headers cannot forge the audit address', () => {
  assert.equal(getRequestIp({ headers: { 'x-forwarded-for': '203.0.113.7' }, ip: '127.0.0.1' }), '127.0.0.1');
});
