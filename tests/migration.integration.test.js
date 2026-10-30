const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma, fixtures } = require('./helpers/fixtures');
const { importSnapshot, TABLES } = require('../src/db/importSnapshot');
after(() => prisma.$disconnect());
test('snapshot import is repeatable, reconciles data and fails on conflicts without partial writes', async () => {
  await fixtures();
  const snapshot = {};
  for (const table of TABLES) snapshot[table] = await prisma[table].findMany();
  assert.equal((await importSnapshot(prisma, snapshot)).ok, true);
  assert.equal((await importSnapshot(prisma, snapshot)).ok, true);
  snapshot.tusuarios[0].nombre = 'Alterado';
  const result = await importSnapshot(prisma, snapshot);
  assert.equal(result.ok, false);
  assert.equal(result.tables[0].differences[0].field, 'nombre');
  assert.equal((await prisma.tusuarios.findFirst({ orderBy: { id: 'asc' } })).nombre, 'admin');
});
test('an orphan in a later table rolls back earlier imported rows', async () => {
  await fixtures();
  const snapshot = {};
  for (const table of TABLES) snapshot[table] = await prisma[table].findMany();
  snapshot.tusuarios.push({ ...snapshot.tusuarios[0], id: 100, correo: 'new@example.test' });
  snapshot.tproducto_imagenes.push({ id: 100, producto: 9999, ruta: 'orphan' });
  const result = await importSnapshot(prisma, snapshot);
  assert.equal(result.ok, false);
  assert.equal(await prisma.tusuarios.findUnique({ where: { id: 100 } }), null);
});
