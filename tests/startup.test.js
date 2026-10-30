const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('../src/startServer');
test('startup connects and listens without modifying database sequences', async () => {
  let writes = 0, listened = false;
  const db = { $connect: async () => {}, $executeRawUnsafe: async () => { writes++; }, $disconnect: async () => {} };
  const server = await startServer({ prisma: db, app: { listen: () => { listened = true; return 'server'; } }, port: 0 });
  assert.equal(server, 'server'); assert.equal(listened, true); assert.equal(writes, 0);
});
test('startup refuses to listen when database connection fails', async () => {
  let listened = false;
  await assert.rejects(startServer({ prisma: { $connect: async () => { throw new Error('offline'); } },
    app: { listen: () => { listened = true; } }, port: 0 }), /offline/);
  assert.equal(listened, false);
});
