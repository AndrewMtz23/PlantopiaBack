const fs = require('node:fs');
const path = require('node:path');
const migrationRoot = path.join(__dirname, '../prisma/migrations');
const expected = fs.readdirSync(migrationRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => ({ name: entry.name }));
async function checkReadiness(client = require('../src/config/prisma')) {
  try {
    const applied = await client.$queryRaw`SELECT migration_name, checksum, finished_at, rolled_back_at FROM _prisma_migrations`;
    const active = applied.filter(row => !row.rolled_back_at);
    return { ready: expected.every(migration => active.some(row => row.migration_name === migration.name && row.finished_at)) && active.every(row => row.finished_at && expected.some(migration => migration.name === row.migration_name)) };
  } catch { return { ready: false }; }
}
if (require.main === module) {
  require('dotenv').config();
  const prisma = require('../src/config/prisma');
  checkReadiness(prisma).then(result => { console.log(JSON.stringify(result)); if (!result.ready) process.exitCode = 1; }).finally(() => prisma.$disconnect());
}
module.exports = { checkReadiness };
