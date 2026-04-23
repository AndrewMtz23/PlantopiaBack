const ensureUserPasswordColumn = async (db) => {
  const dbPromise = db.promise();

  const [rows] = await dbPromise.query(
    `SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tusuarios'
       AND COLUMN_NAME = 'clave'
     LIMIT 1`
  );

  if (rows.length === 0) {
    throw new Error("No se encontro la columna tusuarios.clave.");
  }

  const column = rows[0];
  const currentLength = Number(column.CHARACTER_MAXIMUM_LENGTH || 0);
  const isSupportedType =
    column.DATA_TYPE === "varchar" || column.DATA_TYPE === "text";

  if (!isSupportedType || currentLength < 255) {
    await dbPromise.query(
      "ALTER TABLE tusuarios MODIFY COLUMN clave VARCHAR(255) NOT NULL"
    );
    console.log("Columna tusuarios.clave actualizada a VARCHAR(255).");
  }
};

const ensureProductImageColumns = async (db) => {
  const dbPromise = db.promise();

  const [rows] = await dbPromise.query(
    `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tproductos'
       AND COLUMN_NAME IN ('imagen', 'imagenUrl')`
  );

  const imageColumn = rows.find((column) => column.COLUMN_NAME === "imagen");
  const imageUrlColumn = rows.find((column) => column.COLUMN_NAME === "imagenUrl");

  if (imageColumn) {
    const currentLength = Number(imageColumn.CHARACTER_MAXIMUM_LENGTH || 0);
    const isSupportedType =
      imageColumn.DATA_TYPE === "varchar" || imageColumn.DATA_TYPE === "text";

    if (!isSupportedType || currentLength < 255) {
      await dbPromise.query(
        "ALTER TABLE tproductos MODIFY COLUMN imagen VARCHAR(255) NULL"
      );
      console.log("Columna tproductos.imagen actualizada a VARCHAR(255).");
    }
  }

  if (!imageUrlColumn) {
    await dbPromise.query(
      "ALTER TABLE tproductos ADD COLUMN imagenUrl VARCHAR(500) NULL AFTER imagen"
    );
    console.log("Columna tproductos.imagenUrl agregada correctamente.");
  }
};

const ensurePaymentAndLogTables = async (db) => {
  const dbPromise = db.promise();

  await dbPromise.query(`
    CREATE TABLE IF NOT EXISTS tpagos (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      usuario INT NOT NULL,
      metodo VARCHAR(40) NOT NULL DEFAULT 'efectivo',
      estado VARCHAR(30) NOT NULL DEFAULT 'pagado',
      referencia VARCHAR(120) NULL,
      subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
      iva DECIMAL(10,2) NOT NULL DEFAULT 0,
      envio DECIMAL(10,2) NOT NULL DEFAULT 0,
      total DECIMAL(10,2) NOT NULL DEFAULT 0,
      proveedor VARCHAR(60) NULL,
      metadata JSON NULL,
      fechaRegistro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fechaActualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_tpagos_usuario (usuario),
      INDEX idx_tpagos_estado (estado),
      INDEX idx_tpagos_metodo (metodo)
    )
  `);

  await dbPromise.query(`
    CREATE TABLE IF NOT EXISTS tlogs (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      usuario INT NULL,
      modulo VARCHAR(60) NOT NULL,
      accion VARCHAR(80) NOT NULL,
      descripcion VARCHAR(255) NOT NULL,
      entidad VARCHAR(60) NULL,
      entidadId INT NULL,
      nivel VARCHAR(20) NOT NULL DEFAULT 'info',
      ip VARCHAR(80) NULL,
      metadata JSON NULL,
      fechaRegistro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tlogs_usuario (usuario),
      INDEX idx_tlogs_modulo (modulo),
      INDEX idx_tlogs_entidad (entidad),
      INDEX idx_tlogs_fecha (fechaRegistro)
    )
  `);

  const [salesColumns] = await dbPromise.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tventas'
       AND COLUMN_NAME = 'pago'
     LIMIT 1`
  );

  if (!salesColumns.length) {
    await dbPromise.query(
      "ALTER TABLE tventas ADD COLUMN pago INT NULL AFTER usuario"
    );
    console.log("Columna tventas.pago agregada correctamente.");
  }
};

module.exports = {
  ensurePaymentAndLogTables,
  ensureProductImageColumns,
  ensureUserPasswordColumn,
};
