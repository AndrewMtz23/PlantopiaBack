const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, startupErrorMessage } = require('../src/startServer');
test('startup connects and listens without modifying database sequences', async () => {
  let writes = 0, listened = false;
  const db = { $connect: async () => {}, $executeRawUnsafe: async () => { writes++; }, $disconnect: async () => {} };
  const server = await startServer({ prisma: db, readiness: async () => ({ ready: true }), app: { listen: () => { listened = true; return 'server'; } }, port: 0 });
  assert.equal(server, 'server'); assert.equal(listened, true); assert.equal(writes, 0);
});
test('startup refuses missing schema even when the database is reachable', async () => {
  let listened = false;
  await assert.rejects(startServer({ prisma: { $connect: async () => {}, $disconnect: async () => {} }, readiness: async () => ({ ready: false }), app: { listen: () => { listened = true; } }, port: 0 }), error => {
    assert.equal(error.code, 'DATABASE_SCHEMA_NOT_READY');
    assert.match(startupErrorMessage(error), /prisma migrate status/);
    return true;
  });
  assert.equal(listened, false);
});

test('startup diagnostics never expose raw database errors or credentials', () => {
  const secret = new Error('postgresql://admin:secret@localhost/server');
  assert.equal(startupErrorMessage(secret), 'Database startup failed. Check PostgreSQL availability and DATABASE_URL configuration.');
});
test('startup refuses to listen when database connection fails', async () => {
  let listened = false;
  await assert.rejects(startServer({ prisma: { $connect: async () => { throw new Error('offline'); } },
    app: { listen: () => { listened = true; } }, port: 0 }), /offline/);
  assert.equal(listened, false);
});
