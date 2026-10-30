function getTestDatabaseUrl(env = process.env) {
  if (!env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required');
  const target = new URL(env.TEST_DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(target.protocol) || !/^\/[a-z0-9_]+_test$/.test(target.pathname)) {
    throw new Error('Use a dedicated database ending in _test');
  }
  const identity = url => `${['localhost', '::1'].includes(url.hostname) ? '127.0.0.1' : url.hostname}:${url.port || '5432'}${decodeURIComponent(url.pathname)}`;
  if (env.DATABASE_URL && identity(target) === identity(new URL(env.DATABASE_URL))) {
    throw new Error('Test database must differ from application database');
  }
  return target.href;
}
module.exports = { getTestDatabaseUrl };
