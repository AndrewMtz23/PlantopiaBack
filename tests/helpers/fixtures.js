const { getTestDatabaseUrl } = require('./testDatabase');
const target = getTestDatabaseUrl();
process.env.DATABASE_URL = target;
process.env.JWT_SECRET = 'isolated-test-only-secret-never-production';
const prisma = require('../../src/config/prisma');
const { signAuthToken } = require('../../src/utils/jwt');
const { hashPassword } = require('../../src/utils/passwords');
async function fixtures() {
  await prisma.$executeRawUnsafe('TRUNCATE tlogs, tventas, tpedido, tlista, tproducto_imagenes, tinventario, tpagos, tproductos, tproveedores, tsucursales, tusuarios, tcategorias RESTART IDENTITY CASCADE');
  const password = await hashPassword('Password123!');
  const users = [];
  for (const [name, tipo] of [['admin', 1], ['alice', 2], ['bob', 2], ['courier', 4]]) {
    users.push(await prisma.tusuarios.create({ data: { nombre: name, tipo, estatus: 1, clave: password,
      correo: `${name}@example.test`, fechaNacimiento: '1990-01-01', genero: 'otro', telefono: '4421234567', domicilio: 'Calle Prueba 123' } }));
  }
  const provider = await prisma.tproveedores.create({ data: { estatus: 1, marca: 'Test', representante: 'Test', telefono: '4421234567', correo: 'p@example.test', direccion: 'Test', fechaContrato: '2026-01-01' } });
  const branch = await prisma.tsucursales.create({ data: { estatus: 1, gerente: users[0].id, nombre: 'Test', telefono: '4421234567', direccion: 'Test' } });
  const product = await prisma.tproductos.create({ data: { estatus: 1, nombre: 'Planta', detalles: 'Test', categoria: 'Test', precioCompra: 50, precioVenta: 100, imagen: '' } });
  const inventory = await prisma.tinventario.create({ data: { estatus: 1, sucursal: branch.id, proveedor: provider.id, producto: product.id, cantidad: 5 } });
  const tokens = users.map(user => signAuthToken({ idUsuario: user.id, tipo: user.tipo, tokenVersion: user.tokenVersion || 0 }));
  return { users, tokens, inventory, product, branch };
}
module.exports = { prisma, fixtures };
