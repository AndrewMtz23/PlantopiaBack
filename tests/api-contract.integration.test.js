const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma, fixtures } = require('./helpers/fixtures');
const request = require('supertest');
const { app } = require('../src/app');
const Ajv = require('ajv/dist/2020');
const spec = JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname, '../contracts/openapi.yaml'), 'utf8'));
after(() => prisma.$disconnect());
test('versioned list and error payloads satisfy the published OpenAPI schemas', async () => {
  const f = await fixtures();
  const ajv = new Ajv();
  const page = ajv.compile(spec.components.schemas.Page);
  const error = ajv.compile(spec.components.schemas.Error);
  for (const resource of ['users', 'products', 'inventory', 'catalog', 'payments', 'logs', 'my-payments']) {
    assert.ok(spec.paths[`/${resource}`].get);
    const r = await request(app).get(`/api/v1/${resource}`).set('Authorization', `Bearer ${f.tokens[0]}`);
    assert.equal(r.status, 200, resource);
    assert.equal(page(r.body), true, JSON.stringify(page.errors));
  }
  const rejected = await request(app).get('/api/v1/users?pageSize=101').set('Authorization', `Bearer ${f.tokens[0]}`);
  assert.equal(rejected.status, 400);
  assert.equal(error(rejected.body), true, JSON.stringify(error.errors));
  const ownerInjection = await request(app).post('/api/v1/crearCarrito').set('Authorization', `Bearer ${f.tokens[1]}`).send({ usuario: f.users[2].id, inventario: f.inventory.id, cantidad: 1 });
  assert.equal(ownerInjection.status, 400);
});
