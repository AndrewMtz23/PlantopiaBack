const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('./helpers/fixtures');
const request = require('supertest');
const { app } = require('../src/app');
after(() => prisma.$disconnect());
test('readiness is 503 for database outages and missing migrations', async () => {
  const original = prisma.$queryRaw;
  try {
    prisma.$queryRaw = async () => { throw new Error('private DB credentials'); };
    assert.equal((await request(app).get('/ready')).status, 503);
    prisma.$queryRaw = async () => [];
    assert.equal((await request(app).get('/ready')).status, 503);
  } finally { prisma.$queryRaw = original; }
});
test('technical logging includes duration and status but discards secrets and personal data', () => {
  const { writeTechnicalLog } = require('../src/infrastructure/logging/logger');
  let output = '';
  const write = process.stdout.write;
  process.stdout.write = chunk => { output += chunk; return true; };
  try { writeTechnicalLog({ event: 'request_completed', requestId: 'safe-id', durationMs: 10, status: 400, password: 'secret', clave: 'secret', token: 'secret', authorization: 'secret', cookie: 'secret', correo: 'private@example.test', body: { clave: 'secret' } }); }
  finally { process.stdout.write = write; }
  const parsed = JSON.parse(output);
  assert.equal(parsed.status, 400); assert.equal(parsed.durationMs, 10);
  assert.doesNotMatch(output, /secret|private@|password|authorization|cookie/);
});
test('graceful shutdown stops the listener before closing the pool', async () => {
  const { shutdownServer } = require('../src/startServer');
  const events = [];
  await shutdownServer({ close: callback => { events.push('listener'); callback(); } }, { $disconnect: async () => events.push('pool') });
  assert.deepEqual(events, ['listener', 'pool']);
});
test('the entrypoint handles SIGTERM and exits cleanly after serving HTTP', { timeout: 20000 }, async () => {
  const net = require('node:net');
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = require('node:child_process').spawn(process.execPath, ['-e', "require('./index');process.stdin.on('data',()=>process.emit('SIGTERM'));"], { cwd: require('node:path').join(__dirname, '..'), env: { ...process.env, PORT: String(port) }, stdio: ['pipe', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => {
      child.once('error', reject); child.once('exit', code => reject(new Error(`Early exit ${code}`)));
      child.stdout.on('data', data => { if (String(data).includes('listening')) resolve(); });
    });
    assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status, 200);
    const exit = new Promise(resolve => child.once('exit', resolve));
    child.stdin.write('signal');
    assert.equal(await exit, 0);
  } finally { if (child.exitCode === null) child.kill(); }
});
