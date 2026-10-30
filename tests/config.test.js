const { test } = require('node:test');
const assert = require('node:assert/strict');
const valid = { DATABASE_URL: 'postgresql://test:private@localhost:5432/plantopia_test', JWT_SECRET: 'a'.repeat(32) };
test('runtime rejects invalid configuration without including private values', () => {
  const { loadConfig } = require('../src/config/env');
  for (const [key, value] of [['JWT_SECRET', ''], ['JWT_SECRET', 'short-private'], ['DATABASE_URL', 'mysql://private@localhost/db'], ['PORT', '0'], ['PORT', '65536'], ['PORT', '12.5'], ['TRUST_PROXY', 'true'], ['TRUST_PROXY', '0.0.0.0/0']]) {
    assert.throws(() => loadConfig({ ...valid, [key]: value }), error => error.message === `Invalid configuration: ${key}`);
  }
  const config = loadConfig(valid);
  assert.equal(config.port, 3001); assert.equal(config.bodyLimit, 102400); assert.equal(config.trustProxy, false);
});
test('production origins and explicit trusted proxies are validated', () => {
  const { loadConfig } = require('../src/config/env');
  assert.throws(() => loadConfig({ ...valid, NODE_ENV: 'production' }), /ALLOWED_ORIGINS/);
  assert.throws(() => loadConfig({ ...valid, ALLOWED_ORIGINS: 'https://shop.example/path' }), /ALLOWED_ORIGINS/);
  const config = loadConfig({ ...valid, NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://shop.example', TRUST_PROXY: '127.0.0.1,10.1.2.0/24' });
  assert.deepEqual(config.allowedOrigins, ['https://shop.example']);
  assert.deepEqual(config.trustProxy, ['127.0.0.1', '10.1.2.0/24']);
});
