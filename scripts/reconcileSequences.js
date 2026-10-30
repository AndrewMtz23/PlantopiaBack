require('dotenv').config();
const prisma = require('../src/config/prisma');
const { syncAutoIncrementSequences } = require('../src/utils/sequences');
syncAutoIncrementSequences().then(result => {
  console.log(JSON.stringify(result));
  if (result.failed.length) process.exitCode = 1;
}).catch(() => { console.error('Sequence reconciliation failed'); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
