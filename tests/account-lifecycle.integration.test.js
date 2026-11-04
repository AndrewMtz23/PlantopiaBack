const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma, fixtures } = require('./helpers/fixtures');
const UserService = require('../src/services/UserService');
const request = require('supertest');
const { app } = require('../src/app');
const { signAuthToken, verifyAuthToken } = require('../src/utils/jwt');
let f;
test('password comparison never accepts a plaintext stored password', async () => {
  const { comparePassword } = require('../src/utils/passwords');
  assert.equal(await comparePassword('SyntheticLegacy123!', 'SyntheticLegacy123!'), false);
});
beforeEach(async () => { f = await fixtures(); });
after(() => prisma.$disconnect());
const update = (user, values, actorId = f.users[0].id) => UserService.updateUser(user.id, { ...user, clave: '', ...values }, null, null, actorId);
test('an administrator cannot demote the last active administrator through legacy editing', async () => {
  await assert.rejects(update(f.users[0], { tipo: 2 }), error => error.code === 'LAST_ADMIN');
  assert.equal((await prisma.tusuarios.findUnique({ where: { id: f.users[0].id } })).tipo, 1);
});
test('simultaneous administrator demotions preserve at least one active administrator', async () => {
  const other = await prisma.tusuarios.update({ where: { id: f.users[1].id }, data: { tipo: 1 } });
  const results = await Promise.allSettled([update(f.users[0], { tipo: 2 }), update(other, { tipo: 2 }, other.id)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(await prisma.tusuarios.count({ where: { tipo: 1, estatus: 1 } }), 1);
});
test('deactivation followed by reactivation never restores earlier tokens', async () => {
  await UserService.deleteUser(f.users[1].id, f.users[0].id);
  await update(f.users[1], { estatus: 1 });
  const response = await request(app).get('/verInventario').set('Authorization', `Bearer ${f.tokens[1]}`);
  assert.equal(response.status, 401);
  assert.equal((await prisma.tusuarios.findUnique({ where: { id: f.users[1].id } })).tokenVersion, 2);
});
test('tokens require the configured issuer, audience and HS256 algorithm', () => {
  const jwt = require('jsonwebtoken');
  const claims = { idUsuario: f.users[0].id, tipo: 1, tokenVersion: 0 };
  assert.equal(verifyAuthToken(signAuthToken(claims)).iss, 'plantopia-api');
  assert.throws(() => verifyAuthToken(jwt.sign(claims, process.env.JWT_SECRET)));
  assert.throws(() => verifyAuthToken(jwt.sign(claims, process.env.JWT_SECRET, { algorithm: 'HS384', issuer: 'plantopia-api', audience: 'plantopia-web' })));
});
test('password conversion is resumable and leaves existing hashes unchanged', async () => {
  const { checkLegacyPasswords } = require('../scripts/checkLegacyPasswords');
  const { comparePassword } = require('../src/utils/passwords');
  await prisma.tusuarios.update({ where: { id: f.users[1].id }, data: { clave: 'SyntheticLegacy123!' } });
  assert.deepEqual(await checkLegacyPasswords(), { scanned: 4, legacy: 1, converted: 0 });
  assert.deepEqual(await checkLegacyPasswords({ apply: true }), { scanned: 4, legacy: 1, converted: 1 });
  assert.equal(await comparePassword('SyntheticLegacy123!', (await prisma.tusuarios.findUnique({ where: { id: f.users[1].id } })).clave), true);
  assert.equal((await prisma.tusuarios.findUnique({ where: { id: f.users[0].id } })).clave, f.users[0].clave);
  assert.deepEqual(await checkLegacyPasswords({ apply: true }), { scanned: 4, legacy: 0, converted: 0 });
});
test('database outages are operational errors rather than invalid credentials', async () => {
  const original = prisma.tusuarios.findUnique;
  const originalFirst = prisma.tusuarios.findFirst;
  prisma.tusuarios.findUnique = async () => { throw Object.assign(new Error('private database details'), { code: 'P1001' }); };
  prisma.tusuarios.findFirst = prisma.tusuarios.findUnique;
  try {
    const session = await request(app).get('/verInventario').set('Authorization', `Bearer ${f.tokens[0]}`);
    assert.equal(session.status, 503);
    const login = await request(app).post('/auth/login').send({ correo: 'admin@example.test', clave: 'Password123!' });
    assert.equal(login.status, 503);
    assert.doesNotMatch(JSON.stringify(login.body), /private database/);
  } finally { prisma.tusuarios.findUnique = original; prisma.tusuarios.findFirst = originalFirst; }
});
