const { app, port } = require('./src/app');
const prisma = require('./src/config/prisma');
const { startServer, shutdownServer, startupErrorMessage } = require('./src/startServer');
startServer({ app, prisma, port }).then(server => {
  console.log(`Plantopia API listening on ${port}`);
  let stopping = false;
  const shutdown = () => { if (stopping) return; stopping = true; shutdownServer(server, prisma).then(() => process.exit(0), () => process.exit(1)); };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}).catch(error => { console.error(startupErrorMessage(error)); process.exit(1); });
