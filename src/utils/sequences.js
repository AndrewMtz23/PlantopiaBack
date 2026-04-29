const prisma = require("../config/prisma");

const AUTO_INCREMENT_TABLES = [
  "tcategorias",
  "tinventario",
  "tlista",
  "tlogs",
  "tpagos",
  "tpedido",
  "tproducto_imagenes",
  "tproductos",
  "tproveedores",
  "tsucursales",
  "tusuarios",
  "tventas",
];

const quoteIdentifier = (identifier) => `"${String(identifier).replace(/"/g, '""')}"`;

const syncTableSequence = async (tableName, columnName = "id") => {
  if (!AUTO_INCREMENT_TABLES.includes(tableName)) {
    throw new Error(`Tabla no permitida para sincronizar secuencia: ${tableName}`);
  }

  const tableIdentifier = quoteIdentifier(tableName);
  const columnIdentifier = quoteIdentifier(columnName);

  await prisma.$executeRawUnsafe(`
    SELECT setval(
      pg_get_serial_sequence('${tableIdentifier}', '${columnName}'),
      COALESCE((SELECT MAX(${columnIdentifier}) FROM ${tableIdentifier}), 0) + 1,
      false
    )
  `);
};

const syncAutoIncrementSequences = async () => {
  const failed = [];

  for (const tableName of AUTO_INCREMENT_TABLES) {
    try {
      await syncTableSequence(tableName);
    } catch (error) {
      failed.push({ tableName, error });
    }
  }

  if (failed.length) {
    const tables = failed.map((item) => item.tableName).join(", ");
    console.warn(`No se pudieron sincronizar estas secuencias: ${tables}`);
  }

  return {
    synced: AUTO_INCREMENT_TABLES.length - failed.length,
    failed: failed.map((item) => item.tableName),
  };
};

module.exports = {
  syncAutoIncrementSequences,
  syncTableSequence,
};
