const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compareRows, normalizeRow } = require('../src/db/migrationData');
test('migration comparison accepts equivalent dates, JSON and decimal representations', () => {
  const source = [{ id: 7, total: 1.1, metadata: '{"nested":"á"}', fechaRegistro: new Date('2026-01-01T00:00:00Z') }];
  const target = [{ id: 7, total: '1.10', metadata: { nested: 'á' }, fechaRegistro: new Date('2026-01-01T00:00:00Z'), newDefault: 0 }];
  assert.deepEqual(compareRows('tpagos', source, target), []);
});
test('migration comparison detects missing IDs, extra IDs and altered data without exposing values', () => {
  const issues = compareRows('tusuarios', [{ id: 1, correo: 'private@example.test' }], [{ id: 1, correo: 'different@example.test' }, { id: 2 }]);
  assert.equal(issues.length, 2);
  assert.equal(JSON.stringify(issues).includes('@'), false);
  assert.equal(compareRows('tusuarios', [{ id: 1 }], []).length, 1);
});
test('invalid JSON is a migration error, never silently skipped', () => {
  assert.throws(() => normalizeRow('tpagos', { id: 1, metadata: '{bad' }));
});
test('migration refuses silent monetary rounding', () => {
  assert.throws(() => normalizeRow('tproductos', { id: 1, precioVenta: 1.234 }), /precision/i);
});
test('coordinates compare equivalent numeric and database decimal forms', () => {
  assert.deepEqual(compareRows('tusuarios', [{ id: 1, latitud: 20.5 }], [{ id: 1, latitud: '20.50000000' }]), []);
});
