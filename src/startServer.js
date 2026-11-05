async function startServer({ prisma, app, port, readiness = require('../scripts/checkReadiness').checkReadiness }) {
  await prisma.$connect();
  if (!(await readiness(prisma)).ready) {
    await prisma.$disconnect();
    throw new Error('Database schema is not ready. Apply reviewed migrations before starting.');
  }
  const pending = require('./infrastructure/storage/pendingImages');
  const cleanup = () => pending.cleanupPendingImages(prisma).catch(() => require('./infrastructure/logging/logger').writeTechnicalLog({ level: 'error', event: 'image_cleanup_failed' }));
  await cleanup();
  const server = app.listen(port);
  if (server?.once) {
    const timer = setInterval(cleanup, 15 * 60 * 1000);
    timer.unref(); server.once('close', () => clearInterval(timer));
  }
  return server;
}
async function shutdownServer(server, prisma) {
  const deadline = setTimeout(() => server.closeAllConnections?.(), 10000);
  deadline.unref();
  try { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  finally { clearTimeout(deadline); await prisma.$disconnect(); }
}
module.exports = { startServer, shutdownServer };
