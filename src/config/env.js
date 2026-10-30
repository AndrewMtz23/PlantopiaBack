const { isIP } = require('node:net');
const invalid = key => { throw new Error(`Invalid configuration: ${key}`); };
function loadConfig(env = process.env) {
  const jwtSecret = env.JWT_SECRET;
  if (typeof jwtSecret !== 'string' || Buffer.byteLength(jwtSecret) < 32) invalid('JWT_SECRET');
  let database;
  try { database = new URL(env.DATABASE_URL); } catch { invalid('DATABASE_URL'); }
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.hostname || database.pathname.length < 2) invalid('DATABASE_URL');
  const port = Number(env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) invalid('PORT');
  const origins = env.ALLOWED_ORIGINS || (env.NODE_ENV === 'production' ? '' : 'http://localhost:3000,http://127.0.0.1:3000');
  if (!origins) invalid('ALLOWED_ORIGINS');
  const allowedOrigins = origins.split(',').map(s => s.trim());
  for (const origin of allowedOrigins) {
    let url; try { url = new URL(origin); } catch { invalid('ALLOWED_ORIGINS'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin || (env.NODE_ENV === 'production' && url.protocol !== 'https:')) invalid('ALLOWED_ORIGINS');
  }
  let trustProxy = false;
  if (env.TRUST_PROXY && env.TRUST_PROXY !== 'false') {
    trustProxy = env.TRUST_PROXY.split(',').map(s => s.trim());
    for (const address of trustProxy) {
      const [ip, prefix, extra] = address.split('/');
      const family = isIP(ip);
      if (!family || extra !== undefined || (prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) < 1 || Number(prefix) > (family === 4 ? 32 : 128)))) invalid('TRUST_PROXY');
    }
  }
  return Object.freeze({ port, databaseUrl: env.DATABASE_URL, jwtSecret, allowedOrigins, trustProxy, bodyLimit: 100 * 1024 });
}
module.exports = { loadConfig };
