const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { getTestDatabaseUrl } = require('./helpers/testDatabase');
test('integrity migration refuses rounding before changing historical data', async () => {
  const db = new Client({ connectionString: getTestDatabaseUrl() });
  await db.connect();
  // Isolated schema, fixed identifier, only inside explicit test database.
  try {
    await db.query('CREATE SCHEMA migration_guard_test');
    await db.query('SET search_path TO migration_guard_test');
    const migration = name => fs.readFileSync(path.join(__dirname, '../prisma/migrations', name, 'migration.sql'), 'utf8');
    await db.query(migration('202610290001_baseline'));
    await db.query(`INSERT INTO tproductos (estatus,nombre,detalles,categoria,"precioCompra","precioVenta",imagen) VALUES (1,'Fixture','Test','Test',1,1.234,'')`);
    await assert.rejects(db.query(migration('202610290003_integrity')), /precision\/range requires reconciliation/);
    await db.query('ROLLBACK');
    assert.equal((await db.query('SELECT "precioVenta" FROM tproductos')).rows[0].precioVenta, 1.234);
    await db.query('UPDATE tproductos SET "precioVenta" = 1.23');
    await db.query(migration('202610290003_integrity'));
    assert.equal((await db.query('SELECT "precioVenta" FROM tproductos')).rows[0].precioVenta, '1.23');
  } finally {
    await db.query('ROLLBACK');
    await db.query('SET search_path TO public');
    await db.query('DROP SCHEMA IF EXISTS migration_guard_test CASCADE');
    await db.end();
  }
});
