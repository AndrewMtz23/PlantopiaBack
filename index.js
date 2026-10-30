const { app, port } = require('./src/app');
const prisma = require('./src/config/prisma');
const { startServer } = require('./src/startServer');
startServer({ app, prisma, port }).then(server => {
  console.log(`Plantopia API listening on ${port}`);
  const shutdown = () => server.close(async () => { await prisma.$disconnect(); process.exit(0); });
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}).catch(() => { console.error('Database startup failed.'); process.exit(1); });
