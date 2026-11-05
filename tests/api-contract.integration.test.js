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
    const contract = ajv.compile(spec.paths[`/${resource}`].get.responses['200'].content['application/json'].schema);
    assert.equal(contract(r.body), true, JSON.stringify(contract.errors));
  }
  const rejected = await request(app).get('/api/v1/users?pageSize=101').set('Authorization', `Bearer ${f.tokens[0]}`);
  assert.equal(rejected.status, 400);
  assert.equal(error(rejected.body), true, JSON.stringify(error.errors));
  const ownerInjection = await request(app).post('/api/v1/crearCarrito').set('Authorization', `Bearer ${f.tokens[1]}`).send({ usuario: f.users[2].id, inventario: f.inventory.id, cantidad: 1 });
  assert.equal(ownerInjection.status, 400);
});
test('published command contracts define bodies and the actual creation statuses', async () => {
  const ajv = new Ajv({ strict: false });
  const resolve = schema => schema.$ref ? spec.components.schemas[schema.$ref.split('/').at(-1)] : schema;
  for (const [path, operations] of Object.entries(spec.paths)) for (const [method, operation] of Object.entries(operations)) {
    if (!['post', 'put'].includes(method)) continue;
    assert.ok(operation.requestBody?.content, `${method} ${path} needs a request schema`);
    const success = operation.responses['201'] || operation.responses['200'];
    assert.ok(success?.content?.['application/json']?.schema, `${method} ${path} needs a success schema`);
  }
  await fixtures();
  const payload = { nombre: 'Contract Customer', fechaNacimiento: '1990-01-01', genero: 'otro', telefono: '4421234567', correo: 'contract@example.test', domicilio: 'Calle prueba 123', clave: 'Password123!' };
  const operation = spec.paths['/auth/register'].post;
  assert.ok(operation.responses['201']);
  assert.equal(ajv.compile(resolve(operation.requestBody.content['application/json'].schema))(payload), true);
  const response = await request(app).post('/api/v1/auth/register').send(payload);
  assert.equal(response.status, 201);
  const validate = ajv.compile(resolve(operation.responses['201'].content['application/json'].schema));
  assert.equal(validate(response.body), true, JSON.stringify(validate.errors));
});
