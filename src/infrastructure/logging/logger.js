function writeTechnicalLog({ level = 'info', event, requestId, durationMs, status, method, route }) {
  // Technical events never serialize request bodies, credentials or database errors.
  const record = { level, event, ...(requestId ? { requestId } : {}) };
  if (Number.isFinite(durationMs)) record.durationMs = Math.round(durationMs);
  if (Number.isInteger(status)) record.status = status;
  if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(method)) record.method = method;
  if (typeof route === 'string') record.route = route;
  process.stdout.write(JSON.stringify(record) + '\n');
}
module.exports = { writeTechnicalLog };
