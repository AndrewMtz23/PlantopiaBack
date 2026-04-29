require('dotenv').config();
const mysql = require('mysql2/promise');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} no esta configurado.`);
  }

  return value;
};

async function migrateData() {
  console.log('Iniciando migración de datos de MySQL a PostgreSQL...');

  // Conexión a MySQL
  const mysqlDb = await mysql.createConnection({
    host: requireEnv('DB_HOST'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
    port: Number(process.env.DB_PORT || 3306),
  });

  console.log('Conectado a MySQL exitosamente.');

  try {
    // Definir el orden de migración para respetar las llaves foráneas (Foreign Keys)
    const tables = [
      'tusuarios',
      'tproveedores',
      'tsucursales',
      'tcategorias',
      'tproductos',
      'tinventario',
      'tpedido',
      'tlista',
      'tventas',
      'tpagos',
      'tproducto_imagenes',
      'tlogs'
    ];

    for (const table of tables) {
      console.log(`\nMigrando tabla: ${table}...`);
      
      const [rows] = await mysqlDb.execute(`SELECT * FROM ${table}`);
      console.log(`Se encontraron ${rows.length} registros en ${table} (MySQL).`);

      if (rows.length === 0) {
        console.log(`Tabla ${table} vacía. Saltando...`);
        continue;
      }

      // Convertir fechas a objetos Date y Decimales si es necesario para Prisma
      const formattedRows = rows.map(row => {
        const formatted = { ...row };
        // MySQL a veces devuelve TinyInt como Buffer o Number, Prisma espera Boolean a veces o Int.
        // Aquí lo dejamos como está ya que Prisma se encarga si el tipo coincide (SmallInt/Int).
        return formatted;
      });

      // Insertar en PostgreSQL a través de Prisma
      // Usamos createMany para eficiencia
      try {
        const result = await prisma[table].createMany({
          data: formattedRows,
          skipDuplicates: true, // Por si acaso se ejecuta dos veces
        });
        console.log(`Insertados ${result.count} registros en ${table} (PostgreSQL).`);
      } catch (insertError) {
        console.error(`Error al insertar en la tabla ${table}:`, insertError);
        // Si falla el bloque, intentar de a uno para encontrar el error
        console.log(`Intentando inserción individual para ${table}...`);
        let count = 0;
        for (const row of formattedRows) {
          try {
            await prisma[table].create({ data: row });
            count++;
          } catch (individualError) {
             console.error(`Error al insertar registro ID ${row.id} en ${table}:`, individualError.message);
          }
        }
        console.log(`Insertados ${count} registros individualmente en ${table}.`);
      }
    }

    console.log('\n✅ ¡Migración de datos completada con éxito!');
  } catch (error) {
    console.error('Error durante la migración:', error);
  } finally {
    await mysqlDb.end();
    await prisma.$disconnect();
  }
}

migrateData();
