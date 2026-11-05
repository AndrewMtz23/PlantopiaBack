const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { uploadsRoot, validateImage } = require('./imageStore');
const AppError = require('../../utils/AppError');
const root = path.join(path.dirname(uploadsRoot), '.pending-product-images');
const prefix = '/uploads/pending/';
const pattern = /^[0-9a-f-]{36}\.webp$/;
const lifetime = 60 * 60 * 1000;
function pendingPath(url) {
  const name = typeof url === 'string' && url.startsWith(prefix) ? url.slice(prefix.length) : '';
  if (!pattern.test(name)) throw new AppError(400, 'INVALID_IMAGE', 'Referencia de imagen invalida.');
  return path.join(root, name);
}
async function stageProductImage(file) {
  const image = file.validatedImage || await validateImage(file);
  const name = `${randomUUID()}.webp`;
  await fs.mkdir(root, { recursive: true });
  const target = path.join(root, name);
  try { await fs.writeFile(target, image.data, { flag: 'wx' }); }
  catch (error) { await fs.unlink(target).catch(() => {}); throw error; }
  return prefix + name;
}
async function getPendingImage(url) {
  const target = pendingPath(url);
  const stat = await fs.stat(target).catch(() => null);
  if (!stat || Date.now() - stat.mtimeMs > lifetime) throw new AppError(404, 'IMAGE_EXPIRED', 'La imagen temporal expiro. Vuelve a seleccionarla.');
  return target;
}
async function withProductImages(payload, work) {
  const urls = [...new Set(['imagen', 'imagenUrl'].map(field => payload?.[field]).filter(value => typeof value === 'string' && value.startsWith(prefix)))];
  if (!urls.length) return work(payload);
  const copies = [];
  const updated = { ...payload };
  try {
    await fs.mkdir(path.join(uploadsRoot, 'media'), { recursive: true });
    for (const url of urls) {
      const source = await getPendingImage(url);
      const key = `media/product-${path.basename(source)}`;
      const target = path.join(uploadsRoot, key);
      // The deterministic key links an interrupted promotion to its pending
      // record, allowing the expiry worker to reconcile a process crash.
      await fs.copyFile(source, target, require('node:fs').constants.COPYFILE_EXCL);
      copies.push({ source, target });
      for (const field of ['imagen', 'imagenUrl']) if (updated[field] === url) updated[field] = `/uploads/${key}`;
    }
    const result = await work(updated);
    for (const { source } of copies) await fs.unlink(source).catch(() => {});
    return result;
  } catch (error) {
    for (const { target } of copies) await fs.unlink(target).catch(() => {});
    throw error;
  }
}
async function cleanupPendingImages(client) {
  const names = await fs.readdir(root).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  for (const name of names) {
    if (!pattern.test(name)) continue;
    const pending = path.join(root, name);
    const stat = await fs.stat(pending).catch(() => null);
    if (!stat || Date.now() - stat.mtimeMs <= lifetime) continue;
    const url = `/uploads/media/product-${name}`;
    // If DB is unavailable, leave both files for a later reconciliation.
    const used = await client.tproductos.count({ where: { OR: [{ imagen: url }, { imagenUrl: url }] } });
    if (!used) await fs.unlink(path.join(uploadsRoot, 'media', `product-${name}`)).catch(error => { if (error.code !== 'ENOENT') throw error; });
    await fs.unlink(pending).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}
module.exports = { stageProductImage, getPendingImage, pendingPath, withProductImages, cleanupPendingImages };
