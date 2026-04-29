require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function fixSlugs() {
  console.log('Generando slugs para categorías existentes...');
  const categories = await prisma.tcategorias.findMany({
    where: { slug: null }
  });

  console.log(`Encontradas ${categories.length} categorías sin slug.`);

  for (const cat of categories) {
    const slug = generateSlug(cat.nombre);
    await prisma.tcategorias.update({
      where: { id: cat.id },
      data: { slug }
    });
    console.log(`Slug generado para "${cat.nombre}": ${slug}`);
  }

  console.log('¡Proceso completado!');
  await prisma.$disconnect();
}

fixSlugs().catch(err => {
  console.error(err);
  process.exit(1);
});
