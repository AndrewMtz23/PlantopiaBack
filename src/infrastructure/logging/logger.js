function writeTechnicalLog({ level = 'info', event, requestId }) {
  // Technical events never serialize request bodies, credentials or database errors.
  process.stdout.write(JSON.stringify({ level, event, ...(requestId ? { requestId } : {}) }) + '\n');
}
module.exports = { writeTechnicalLog };
