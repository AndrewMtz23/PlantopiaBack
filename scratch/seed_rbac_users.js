require('dotenv').config();
const prisma = require('../src/config/prisma');

async function seedUsers() {
  const hashedPassword = '$2b$10$5jXMAz3M77BWT3Z5zRVCwevEsNOlll91xAHQ60Spoig9lv8oNxjR2'; // Hashed 'Lilith123!@'

  const users = [
    {
      nombre: 'Admin Plantopia',
      correo: 'admin@plantopia.com',
      clave: hashedPassword,
      tipo: 1, // Admin
      estatus: 1,
      fechaNacimiento: '1990-01-01',
      genero: 'Otro',
      telefono: '0000000000',
      domicilio: 'Sede Central Plantopia',
      ciudad: 'Ciudad de México'
    },
    {
      nombre: 'Cliente Ejemplo',
      correo: 'cliente@plantopia.com',
      clave: hashedPassword,
      tipo: 2, // Cliente
      estatus: 1,
      fechaNacimiento: '1995-05-15',
      genero: 'Femenino',
      telefono: '1112223333',
      domicilio: 'Calle Falsa 123',
      ciudad: 'Querétaro'
    },
    {
      nombre: 'Empleado Logistica',
      correo: 'empleado@plantopia.com',
      clave: hashedPassword,
      tipo: 3, // Empleado
      estatus: 1,
      fechaNacimiento: '1988-10-20',
      genero: ' Masc',
      telefono: '4445556666',
      domicilio: 'Almacén Norte',
      ciudad: 'Monterrey'
    },
    {
      nombre: 'Repartidor Veloz',
      correo: 'repartidor@plantopia.com',
      clave: hashedPassword,
      tipo: 4, // Repartidor
      estatus: 1,
      fechaNacimiento: '1992-03-12',
      genero: ' Masc',
      telefono: '7778889999',
      domicilio: 'Base de Reparto',
      ciudad: 'Guadalajara'
    }
  ];

  console.log('--- Iniciando creación de usuarios de prueba ---');

  for (const user of users) {
    try {
      const created = await prisma.tusuarios.upsert({
        where: { id: -1, correo: user.correo }, // Truco para upsert por campo único que no es @id
        update: user,
        create: user
      }).catch(async (e) => {
          // Si upsert falla por no ser @id, intentamos findFirst + create/update
          const existing = await prisma.tusuarios.findFirst({ where: { correo: user.correo } });
          if (existing) {
              return await prisma.tusuarios.update({ where: { id: existing.id }, data: user });
          } else {
              return await prisma.tusuarios.create({ data: user });
          }
      });
      console.log(`Usuario listo: ${created.nombre} (${created.correo}) - Rol: ${created.tipo}`);
    } catch (error) {
      console.error(`Error al procesar usuario ${user.correo}:`, error.message);
    }
  }

  console.log('--- Proceso terminado ---');
  await prisma.$disconnect();
  process.exit(0);
}

seedUsers();
