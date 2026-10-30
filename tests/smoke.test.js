const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getTestDatabaseUrl } = require('./helpers/testDatabase');
test('rejects unsafe database destinations before connecting', () => {
  for (const env of [{}, { TEST_DATABASE_URL: 'not-url' },
    { TEST_DATABASE_URL: 'postgresql://u@localhost/shop' },
    { TEST_DATABASE_URL: 'postgresql://u@localhost/shop_test', DATABASE_URL: 'postgresql://other@localhost:5432/shop_test' }]) {
    assert.throws(() => getTestDatabaseUrl(env));
  }
});
test('accepts a separate explicitly named test database', () => {
  const url = 'postgresql://sprint1@127.0.0.1:55432/plantopia_test';
  assert.equal(getTestDatabaseUrl({ TEST_DATABASE_URL: url }), url);
});
