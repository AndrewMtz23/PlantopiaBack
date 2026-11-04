const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma, fixtures } = require('./helpers/fixtures');
const request = require('supertest');
const { app } = require('../src/app');
let f;
beforeEach(async () => { f = await fixtures(); });
after(() => prisma.$disconnect());
test('profile validation rejects arrays, long phones and injected permissions before any write', async () => {
  const { id, clave, tokenVersion, ...profile } = f.users[1];
  delete profile.fotoPerfil;
  delete profile.estatus; delete profile.tipo;
  for (const change of [{ nombre: ['Invalid'] }, { telefono: '12345678901' }, { tipo: 1 }, { tokenVersion: 9 }]) {
    const r = await request(app).put('/perfil').set('Authorization', `Bearer ${f.tokens[1]}`).send({ ...profile, ...change });
    assert.equal(r.status, 400);
    assert.equal(typeof r.body.error.fields, 'object');
  }
  assert.equal((await prisma.tusuarios.findUnique({ where: { id } })).tipo, 2);
});
test('products reject malformed prices and unexpected writable properties', async () => {
  for (const change of [{ precioVenta: 'Infinity' }, { precioCompra: '1.234' }, { nombre: ['plant'] }, { tinventario: {} }]) {
    const r = await request(app).put('/editarProducto').set('Authorization', `Bearer ${f.tokens[0]}`).send({ id: f.product.id, nombre: 'Planta', precioVenta: '100.00', ...change });
    assert.equal(r.status, 400);
  }
  assert.equal((await prisma.tproductos.findFirst()).precioVenta.toFixed(2), '100.00');
});
test('invalid resource identifiers and malformed login types produce typed 400 errors', async () => {
  for (const id of ['-1', '1.5', 'NaN']) {
    const r = await request(app).delete(`/eliminarUsuario/${id}`).set('Authorization', `Bearer ${f.tokens[0]}`);
    assert.equal(r.status, 400);
  }
  const r = await request(app).post('/auth/login').send({ correo: ['admin@example.test'], clave: {} });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'INVALID_INPUT');
});
test('valid profile updates and login responses expose only public account fields', async () => {
  const { id, clave, tipo, estatus, tokenVersion, fotoPerfil, ...profile } = f.users[1];
  const saved = await request(app).put('/perfil').set('Authorization', `Bearer ${f.tokens[1]}`).send(profile);
  assert.equal(saved.status, 200);
  const login = await request(app).post('/auth/login').send({ correo: profile.correo, clave: 'Password123!' });
  assert.equal(login.status, 200);
  for (const data of [saved.body, login.body.session]) assert.doesNotMatch(JSON.stringify(data), /tokenVersion|"clave"|\$2[aby]\$/);
});
