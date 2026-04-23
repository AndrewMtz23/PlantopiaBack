require("dotenv").config();
const db = require('./src/db/connection');

async function migrate() {
  try {
    console.log("Iniciando migracion...");
    
    // 1. Crear tabla de categorías
    await db.promise().query(`
      CREATE TABLE IF NOT EXISTS tcategorias (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL UNIQUE,
        descripcion VARCHAR(255) DEFaULT ''
      )
    `);
    console.log("Tabla tcategorias creada o ya existe.");

    // 2. Insertar categorías únicas existentes (si hay)
    const [productos] = await db.promise().query("SELECT DISTINCT categoria FROM tproductos WHERE categoria IS NOT NULL AND categoria != ''");
    
    for (let p of productos) {
      try {
        await db.promise().query("INSERT IGNORE INTO tcategorias (nombre) VALUES (?)", [p.categoria]);
      } catch (e) {
        console.log("Error insertando categoria " + p.categoria, e.message);
      }
    }
    console.log("Categorias iniciales migradas.");

    console.log("Migracion completada. Recuerda actualizar los controladores para usar tcategorias.");
    process.exit(0);
  } catch (err) {
    console.error("Error en migracion: ", err);
    process.exit(1);
  }
}

migrate();
