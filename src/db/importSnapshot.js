const { normalizeRow, compareRows } = require('./migrationData');
const { Prisma } = require('@prisma/client');
const TABLES = ['tusuarios', 'tproveedores', 'tsucursales', 'tcategorias', 'tproductos', 'tinventario', 'tpagos', 'tpedido', 'tlista', 'tventas', 'tproducto_imagenes', 'tlogs'];
async function importSnapshot(prisma, snapshot, { verifyOnly = false } = {}) {
  const report = { ok: false, tables: [], errors: [] };
  try {
    await prisma.$transaction(async tx => {
      for (const table of TABLES) {
        if (!Array.isArray(snapshot[table])) throw new Error(`Missing table ${table}`);
        const source = snapshot[table];
        const data = source.map(row => {
          const result = normalizeRow(table, row);
          for (const key of ['metadata', 'direccionEntrega']) if (key in result && result[key] === null) result[key] = Prisma.DbNull;
          return result;
        });
        if (!verifyOnly && data.length) await tx[table].createMany({ data, skipDuplicates: true });
        const target = await tx[table].findMany();
        const differences = compareRows(table, source, target);
        report.tables.push({ name: table, sourceCount: source.length, targetCount: target.length, differences });
        if (differences.length) throw new Error(`Reconciliation failed: ${table}`);
      }
    }, { timeout: 120000, isolationLevel: 'Serializable' });
    report.ok = true;
  } catch (error) {
    report.errors.push({ code: error.code || 'MIGRATION_FAILED', message: 'Migration incomplete; inspect table reconciliation and source integrity. No partial import committed.' });
  }
  return report;
}
module.exports = { importSnapshot, TABLES };
