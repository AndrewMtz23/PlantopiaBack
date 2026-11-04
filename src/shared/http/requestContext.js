const { randomUUID } = require('node:crypto');
function requestContext(req, res, next) {
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  const start = process.hrtime.bigint();
  res.once('finish', () => require('../../infrastructure/logging/logger').writeTechnicalLog({
    event: 'request_completed', requestId: req.requestId, method: req.method,
    route: typeof req.route?.path === 'string' ? req.route.path : 'unmatched',
    status: res.statusCode, durationMs: Number(process.hrtime.bigint() - start) / 1e6,
  }));
  next();
}
module.exports = { requestContext };
