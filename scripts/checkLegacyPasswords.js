require('dotenv').config();
const prisma = require('../src/config/prisma');
const { hashPassword, isHashedPassword } = require('../src/utils/passwords');

async function checkLegacyPasswords({ apply = false, client = prisma } = {}) {
  const summary = { scanned: 0, legacy: 0, converted: 0 };
  let cursor = 0;
  for (;;) {
    const rows = await client.tusuarios.findMany({ where: { id: { gt: cursor } }, orderBy: { id: 'asc' }, take: 100, select: { id: true, clave: true } });
    if (!rows.length) return summary;
    for (const row of rows) {
      summary.scanned++;
      if (!isHashedPassword(row.clave)) {
        summary.legacy++;
        if (apply) {
          const hashed = await hashPassword(row.clave);
          // Compare-and-swap preserves a password changed while this batch ran.
          const result = await client.tusuarios.updateMany({ where: { id: row.id, clave: row.clave }, data: { clave: hashed, tokenVersion: { increment: 1 } } });
          summary.converted += result.count;
        }
      }
      cursor = row.id;
    }
  }
}
if (require.main === module) {
  const apply = process.argv.includes('--apply');
  if (apply && process.env.LEGACY_PASSWORD_MIGRATION_APPROVED !== 'yes') {
    console.error('Apply requires a verified backup, rehearsal and LEGACY_PASSWORD_MIGRATION_APPROVED=yes.');
    process.exitCode = 1;
  } else {
    checkLegacyPasswords({ apply }).then(result => console.log(JSON.stringify(result)))
      .catch(() => { console.error('Password audit failed. No credentials are printed.'); process.exitCode = 1; })
      .finally(() => prisma.$disconnect());
  }
}
module.exports = { checkLegacyPasswords };
