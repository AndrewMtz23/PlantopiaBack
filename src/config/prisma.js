const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

// Utilizamos el adapter de PostgreSQL nativo para la versión 7.x de Prisma
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, statement_timeout: 15000 });
const adapter = new PrismaPg(pool, { disposeExternalPool: true });

// Instancia única (Singleton) de PrismaClient
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
