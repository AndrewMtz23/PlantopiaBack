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

const ensureProductGalleryTable = async (db) => {
  const dbPromise = db.promise();

  await dbPromise.query(`
    CREATE TABLE IF NOT EXISTS tproducto_imagenes (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      producto INT NOT NULL,
      ruta VARCHAR(500) NOT NULL,
      nombreOriginal VARCHAR(255) NULL,
      esPrincipal TINYINT NOT NULL DEFAULT 0,
      orden INT NOT NULL DEFAULT 0,
      fechaRegistro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tproducto_imagenes_producto (producto),
      INDEX idx_tproducto_imagenes_orden (orden)
    )
  `);
};

const ensureWishlistUniqueIndex = async (db) => {
  const dbPromise = db.promise();

  await dbPromise.query(`
    DELETE duplicate_list
    FROM tlista duplicate_list
    INNER JOIN tlista first_list
      ON duplicate_list.usuario = first_list.usuario
      AND duplicate_list.inventario = first_list.inventario
      AND duplicate_list.id > first_list.id
  `);

  const [rows] = await dbPromise.query(
    `SELECT INDEX_NAME
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tlista'
       AND INDEX_NAME = 'uniq_tlista_usuario_inventario'
     LIMIT 1`
  );

  if (!rows.length) {
    await dbPromise.query(
      "ALTER TABLE tlista ADD UNIQUE KEY uniq_tlista_usuario_inventario (usuario, inventario)"
    );
    console.log("Indice unico tlista(usuario, inventario) agregado correctamente.");
  }
};

const ensureUserProfileImageColumn = async (db) => {
  const dbPromise = db.promise();

  const [rows] = await dbPromise.query(
    `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tusuarios'
       AND COLUMN_NAME = 'fotoPerfil'
     LIMIT 1`
  );

  if (!rows.length) {
    await dbPromise.query(
      "ALTER TABLE tusuarios ADD COLUMN fotoPerfil VARCHAR(500) NULL AFTER domicilio"
    );
    console.log("Columna tusuarios.fotoPerfil agregada correctamente.");
    return;
  }

  const column = rows[0];
  const currentLength = Number(column.CHARACTER_MAXIMUM_LENGTH || 0);
  const isSupportedType =
    column.DATA_TYPE === "varchar" || column.DATA_TYPE === "text";

  if (!isSupportedType || currentLength < 500) {
    await dbPromise.query(
      "ALTER TABLE tusuarios MODIFY COLUMN fotoPerfil VARCHAR(500) NULL"
    );
    console.log("Columna tusuarios.fotoPerfil actualizada a VARCHAR(500).");
  }
};

const ensureUserAddressColumns = async (db) => {
  const dbPromise = db.promise();

  const [rows] = await dbPromise.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tusuarios'
       AND COLUMN_NAME IN ('ciudad', 'estadoDireccion', 'codigoPostal', 'referenciasDomicilio')`
  );

  const existingColumns = new Set(rows.map((column) => column.COLUMN_NAME));

  if (!existingColumns.has("ciudad")) {
    await dbPromise.query(
      "ALTER TABLE tusuarios ADD COLUMN ciudad VARCHAR(120) NULL AFTER domicilio"
    );
    console.log("Columna tusuarios.ciudad agregada correctamente.");
  }

  if (!existingColumns.has("estadoDireccion")) {
    await dbPromise.query(
      "ALTER TABLE tusuarios ADD COLUMN estadoDireccion VARCHAR(120) NULL AFTER ciudad"
    );
    console.log("Columna tusuarios.estadoDireccion agregada correctamente.");
  }

  if (!existingColumns.has("codigoPostal")) {
    await dbPromise.query(
      "ALTER TABLE tusuarios ADD COLUMN codigoPostal VARCHAR(10) NULL AFTER estadoDireccion"
    );
    console.log("Columna tusuarios.codigoPostal agregada correctamente.");
  }

  if (!existingColumns.has("referenciasDomicilio")) {
    await dbPromise.query(
      "ALTER TABLE tusuarios ADD COLUMN referenciasDomicilio VARCHAR(500) NULL AFTER codigoPostal"
    );
    console.log("Columna tusuarios.referenciasDomicilio agregada correctamente.");
  }
};

const ensureBranchLocationColumns = async (db) => {
  const dbPromise = db.promise();

  const [rows] = await dbPromise.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tsucursales'
       AND COLUMN_NAME IN ('latitud', 'longitud')`
  );

  const hasLatitude = rows.some((column) => column.COLUMN_NAME === "latitud");
  const hasLongitude = rows.some((column) => column.COLUMN_NAME === "longitud");

  if (!hasLatitude) {
    await dbPromise.query(
      "ALTER TABLE tsucursales ADD COLUMN latitud DECIMAL(10,8) NULL AFTER direccion"
    );
    console.log("Columna tsucursales.latitud agregada correctamente.");
  }

  if (!hasLongitude) {
    await dbPromise.query(
      "ALTER TABLE tsucursales ADD COLUMN longitud DECIMAL(11,8) NULL AFTER latitud"
    );
    console.log("Columna tsucursales.longitud agregada correctamente.");
  }

  await dbPromise.query(
    `UPDATE tsucursales
     SET
       latitud = CASE
         WHEN nombre LIKE '%Antea%' THEN 20.67383200
         WHEN nombre LIKE '%Centro%' THEN 20.59213200
         WHEN nombre LIKE '%Juriquilla%' THEN 20.70809400
         ELSE latitud
       END,
       longitud = CASE
         WHEN nombre LIKE '%Antea%' THEN -100.43727100
         WHEN nombre LIKE '%Centro%' THEN -100.39283200
         WHEN nombre LIKE '%Juriquilla%' THEN -100.44732600
         ELSE longitud
       END
     WHERE (latitud IS NULL OR longitud IS NULL)
       AND (
         nombre LIKE '%Antea%'
         OR nombre LIKE '%Centro%'
         OR nombre LIKE '%Juriquilla%'
       )`
  );
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
      direccionEntrega JSON NULL,
      estadoEntrega VARCHAR(30) NOT NULL DEFAULT 'preparando',
      fechaEstimadaEntrega DATE NULL,
      guiaEntrega VARCHAR(120) NULL,
      notasEntrega VARCHAR(500) NULL,
      metadata JSON NULL,
      fechaRegistro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fechaActualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_tpagos_usuario (usuario),
      INDEX idx_tpagos_estado (estado),
      INDEX idx_tpagos_metodo (metodo)
    )
  `);

  const [paymentAddressColumns] = await dbPromise.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tpagos'
       AND COLUMN_NAME = 'direccionEntrega'
     LIMIT 1`
  );

  if (!paymentAddressColumns.length) {
    await dbPromise.query(
      "ALTER TABLE tpagos ADD COLUMN direccionEntrega JSON NULL AFTER proveedor"
    );
    console.log("Columna tpagos.direccionEntrega agregada correctamente.");
  }

  const [paymentTrackingColumns] = await dbPromise.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tpagos'
       AND COLUMN_NAME IN ('estadoEntrega', 'fechaEstimadaEntrega', 'guiaEntrega', 'notasEntrega')`
  );
  const existingPaymentTrackingColumns = new Set(
    paymentTrackingColumns.map((column) => column.COLUMN_NAME)
  );

  if (!existingPaymentTrackingColumns.has("estadoEntrega")) {
    await dbPromise.query(
      "ALTER TABLE tpagos ADD COLUMN estadoEntrega VARCHAR(30) NOT NULL DEFAULT 'preparando' AFTER direccionEntrega"
    );
    console.log("Columna tpagos.estadoEntrega agregada correctamente.");
  }

  if (!existingPaymentTrackingColumns.has("fechaEstimadaEntrega")) {
    await dbPromise.query(
      "ALTER TABLE tpagos ADD COLUMN fechaEstimadaEntrega DATE NULL AFTER estadoEntrega"
    );
    console.log("Columna tpagos.fechaEstimadaEntrega agregada correctamente.");
  }

  if (!existingPaymentTrackingColumns.has("guiaEntrega")) {
    await dbPromise.query(
      "ALTER TABLE tpagos ADD COLUMN guiaEntrega VARCHAR(120) NULL AFTER fechaEstimadaEntrega"
    );
    console.log("Columna tpagos.guiaEntrega agregada correctamente.");
  }

  if (!existingPaymentTrackingColumns.has("notasEntrega")) {
    await dbPromise.query(
      "ALTER TABLE tpagos ADD COLUMN notasEntrega VARCHAR(500) NULL AFTER guiaEntrega"
    );
    console.log("Columna tpagos.notasEntrega agregada correctamente.");
  }

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
  ensureBranchLocationColumns,
  ensurePaymentAndLogTables,
  ensureProductGalleryTable,
  ensureProductImageColumns,
  ensureWishlistUniqueIndex,
  ensureUserAddressColumns,
  ensureUserProfileImageColumn,
  ensureUserPasswordColumn,
};
