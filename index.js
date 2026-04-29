const { app, db, port } = require("./src/app");
const {
  ensureBranchLocationColumns,
  ensurePaymentAndLogTables,
  ensureProductGalleryTable,
  ensureProductImageColumns,
  ensureWishlistUniqueIndex,
  ensureUserAddressColumns,
  ensureUserProfileImageColumn,
  ensureUserPasswordColumn,
} = require("./src/db/ensureSchema");

db.getConnection(async (err, connection) => {
  if (err) {
    console.log(err);
    process.exit(1);
  }

  try {
    console.log("Conectado correctamente a la base de datos!!!");
    connection.release();

    await ensureUserPasswordColumn(db);
    await ensureUserProfileImageColumn(db);
    await ensureUserAddressColumns(db);
    await ensureProductImageColumns(db);
    await ensureProductGalleryTable(db);
    await ensureWishlistUniqueIndex(db);
    await ensureBranchLocationColumns(db);
    await ensurePaymentAndLogTables(db);

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (schemaError) {
    console.log(schemaError);
    process.exit(1);
  }
});
