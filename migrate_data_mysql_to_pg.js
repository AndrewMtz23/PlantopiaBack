require('dotenv').config();
const mysql = require('mysql2/promise');
const prisma = require('./src/config/prisma');
const { importSnapshot, TABLES } = require('./src/db/importSnapshot');
const { syncAutoIncrementSequences } = require('./src/utils/sequences');
async function main() {
  for (const key of ['DATABASE_URL', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) if (!process.env[key]) throw new Error('Missing migration configuration');
  const source = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, port: Number(process.env.DB_PORT || 3306), timezone: 'Z' });
  try {
    await source.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await source.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    const snapshot = {};
    for (const table of TABLES) [snapshot[table]] = await source.query(`SELECT * FROM ${table}`);
    const verifyOnly = process.argv.includes('--verify-only');
    const report = await importSnapshot(prisma, snapshot, { verifyOnly });
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) { process.exitCode = 1; return; }
    if (!verifyOnly) {
      const sequences = await syncAutoIncrementSequences();
      if (sequences.failed.length) { process.exitCode = 1; console.error('Data imported but sequences require reconciliation.'); }
    }
  } finally { await source.rollback(); await source.end(); }
}
main().catch(() => { console.error('Migration failed; no success claimed. Review configuration and source integrity.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
