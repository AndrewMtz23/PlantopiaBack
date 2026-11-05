const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const isolatedRoot = require('node:fs').mkdtempSync(path.join(os.tmpdir(), 'plantopia-upload-test-'));
process.env.UPLOADS_PATH = path.join(isolatedRoot, 'public');
process.env.UPLOAD_TEMP_PATH = path.join(isolatedRoot, 'private');
const { prisma, fixtures } = require('./helpers/fixtures');
const request = require('supertest');
const { app } = require('../src/app');
let f;
beforeEach(async () => { f = await fixtures(); });
after(async () => { await prisma.$disconnect(); if (path.dirname(isolatedRoot) === os.tmpdir() && path.basename(isolatedRoot).startsWith('plantopia-upload-test-')) await fs.rm(isolatedRoot, { recursive: true, force: true }); });
const upload = () => request(app).post('/upload').set('Authorization', `Bearer ${f.tokens[0]}`);
test('spoofed and truncated images never publish content', async () => {
  for (const data of [Buffer.from('not an image'), Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')]) {
    const r = await upload().attach('image', data, { filename: 'fake.png', contentType: 'image/png' });
    assert.equal(r.status, 400);
  }
});
test('upload limits reject oversized single files and a sixth gallery image', async () => {
  const huge = await upload().attach('image', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'large.png', contentType: 'image/png' });
  assert.equal(huge.status, 413);
  let req = request(app).post(`/productoImagenes/${f.product.id}`).set('Authorization', `Bearer ${f.tokens[0]}`);
  for (let n = 0; n < 6; n++) req = req.attach('imagenes', Buffer.from('x'), `image${n}.png`);
  assert.equal((await req).status, 400);
});
test('temporary uploads are private and authentication runs before storage', async () => {
  const r = await request(app).post('/upload').attach('image', Buffer.from('x'), 'unauth.png');
  assert.equal(r.status, 401);
  await fs.mkdir(path.join(process.env.UPLOADS_PATH, 'tmp'), { recursive: true });
  await fs.writeFile(path.join(process.env.UPLOADS_PATH, 'tmp', 'private.txt'), 'private');
  assert.equal((await request(app).get('/uploads/tmp/private.txt')).status, 404);
});
test('valid images are decoded and reencoded under generated names; oversized dimensions fail', async () => {
  const sharp = require('sharp');
  const png = await sharp({ create: { width: 2, height: 3, channels: 3, background: '#228833' } }).png().toBuffer();
  const r = await upload().attach('image', png, { filename: '../../original.png', contentType: 'image/png' });
  assert.equal(r.status, 200);
  assert.match(r.body.imagePath, /^\/uploads\/pending\/[0-9a-f-]{36}\.webp$/);
  const saved = await request(app).get(r.body.imagePath);
  assert.equal(saved.status, 200); assert.match(saved.headers['content-type'], /image\/webp/);
  const huge = await sharp({ create: { width: 5000, height: 4001, channels: 3, background: '#228833' } }).png().toBuffer();
  assert.equal((await upload().attach('image', huge, 'huge.png')).status, 400);
});
test('gallery database failure removes newly stored files', async () => {
  const sharp = require('sharp');
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#228833' } }).png().toBuffer();
  const media = path.join(process.env.UPLOADS_PATH, 'media');
  const before = (await fs.readdir(media).catch(() => [])).sort();
  await prisma.$executeRawUnsafe("CREATE FUNCTION test_gallery_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$");
  await prisma.$executeRawUnsafe('CREATE TRIGGER test_gallery_failure BEFORE INSERT ON tproducto_imagenes FOR EACH ROW EXECUTE FUNCTION test_gallery_failure()');
  try {
    const response = await request(app).post(`/productoImagenes/${f.product.id}`).set('Authorization', `Bearer ${f.tokens[0]}`).attach('imagenes', png, 'good.png');
    assert.equal(response.status, 500);
    assert.deepEqual((await fs.readdir(media)).sort(), before);
    assert.equal(await prisma.tproducto_imagenes.count(), 0);
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER test_gallery_failure ON tproducto_imagenes');
    await prisma.$executeRawUnsafe('DROP FUNCTION test_gallery_failure()');
  }
});
test('aborted multipart requests leave no disk temporaries', async () => {
  const http = require('node:http');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    await new Promise(resolve => {
      const req = http.request({ host: '127.0.0.1', port: server.address().port, path: '/upload', method: 'POST', headers: { Authorization: `Bearer ${f.tokens[0]}`, 'Content-Type': 'multipart/form-data; boundary=unfinished', 'Content-Length': '100000' } });
      req.on('error', () => {}); req.on('close', resolve);
      req.write('--unfinished\r\nContent-Disposition: form-data; name="image"; filename="partial.png"\r\nContent-Type: image/png\r\n\r\npartial', () => req.destroy());
    });
    assert.equal(await fs.stat(process.env.UPLOAD_TEMP_PATH).then(() => true, () => false), false);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
test('standalone uploads expire unless a product successfully attaches them', async () => {
  const png = await require('sharp')({ create: { width: 2, height: 2, channels: 3, background: '#228833' } }).png().toBuffer();
  const response = await upload().attach('image', png, 'pending.png');
  assert.match(response.body.imagePath, /^\/uploads\/pending\/[0-9a-f-]{36}\.webp$/);
  const { withProductImages, pendingPath, cleanupPendingImages } = require('../src/infrastructure/storage/pendingImages');
  const original = response.body.imagePath;
  const media = path.join(process.env.UPLOADS_PATH, 'media');
  const before = (await fs.readdir(media).catch(() => [])).sort();
  await assert.rejects(withProductImages({ imagen: original }, async () => { throw new Error('database failed'); }));
  assert.deepEqual((await fs.readdir(media)).sort(), before);
  const file = pendingPath(original);
  const expired = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await fs.utimes(file, expired, expired);
  await cleanupPendingImages(prisma);
  assert.equal(await fs.stat(file).then(() => true, () => false), false);
  assert.equal((await request(app).get(original)).status, 404);
  const accepted = await upload().attach('image', png, 'saved.png');
  const product = await request(app).post('/crearProducto').set('Authorization', `Bearer ${f.tokens[0]}`).send({ nombre: 'Saved image', categoria: 'Test', precioCompra: '10.00', precioVenta: '20.00', imagen: accepted.body.imagePath });
  assert.equal(product.status, 201);
  assert.match(product.body.imagen, /^\/uploads\/media\/product-/);
  assert.equal((await request(app).get(product.body.imagen)).status, 200);
  assert.equal((await request(app).get(accepted.body.imagePath)).status, 404);
});
