async function startServer({ prisma, app, port, readiness = require('../scripts/checkReadiness').checkReadiness }) {
  await prisma.$connect();
  if (!(await readiness(prisma)).ready) {
    await prisma.$disconnect();
    throw new Error('Database schema is not ready. Apply reviewed migrations before starting.');
  }
  return app.listen(port);
}
async function shutdownServer(server, prisma) {
  const deadline = setTimeout(() => server.closeAllConnections?.(), 10000);
  deadline.unref();
  try { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  finally { clearTimeout(deadline); await prisma.$disconnect(); }
}
module.exports = { startServer, shutdownServer };
