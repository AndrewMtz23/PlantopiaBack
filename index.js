const { app, port } = require("./src/app");
const prisma = require("./src/config/prisma");
const { syncAutoIncrementSequences } = require("./src/utils/sequences");

async function startServer() {
  try {
    // Validamos la conexión con Prisma/PostgreSQL antes de iniciar el servidor
    await prisma.$connect();
    console.log("✅ Conectado correctamente a PostgreSQL mediante Prisma Client.");

    const sequenceStatus = await syncAutoIncrementSequences();
    console.log(`Secuencias sincronizadas: ${sequenceStatus.synced}`);

    app.listen(port, () => {
      console.log(`🚀 Servidor corriendo en el puerto ${port}`);
      console.log(`🔗 Local: http://localhost:${port}`);
    });
  } catch (error) {
    console.error("❌ Error al conectar con la base de datos:");
    console.error(error);
    process.exit(1);
  }
}

// Ya no necesitamos las funciones 'ensureSchema' porque Prisma maneja la integridad del esquema
startServer();
