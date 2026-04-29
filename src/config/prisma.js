const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

// Utilizamos el adapter de PostgreSQL nativo para la versión 7.x de Prisma
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Instancia única (Singleton) de PrismaClient
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
