const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const sharp = require('sharp');
const AppError = require('../../utils/AppError');
const uploadsRoot = process.env.UPLOADS_PATH || path.join(__dirname, '../../../uploads');
const keyPattern = /^media\/(profile|product)-[0-9a-f-]{36}\.webp$/;

async function validateImage(file) {
  if (!file?.buffer || file.buffer.length > 5 * 1024 * 1024) throw new AppError(413, 'IMAGE_TOO_LARGE', 'La imagen no puede superar 5 MiB.');
  try {
    const decoder = sharp(file.buffer, { limitInputPixels: 20000000, failOn: 'warning', animated: false });
    const info = await decoder.metadata();
    if (!['jpeg', 'png', 'webp'].includes(info.format) || (info.pages || 1) !== 1) throw new Error('Unsupported image');
    const result = await decoder.rotate().webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
    file.validatedImage = result;
    return result;
  } catch { throw new AppError(400, 'INVALID_IMAGE', 'La imagen debe ser un JPG, PNG o WebP valido de hasta 20 megapixeles.'); }
}

async function validateAndStoreImage(file, { ownerType }) {
  if (!['profile', 'product'].includes(ownerType)) throw new Error('Invalid image owner type');
  const result = file.validatedImage || await validateImage(file);
  const key = `media/${ownerType}-${randomUUID()}.webp`;
  await fs.mkdir(path.join(uploadsRoot, 'media'), { recursive: true });
  file.storedKey = key;
  try { await fs.writeFile(path.join(uploadsRoot, key), result.data, { flag: 'wx' }); }
  catch (error) { await deleteStoredImage(key); throw error; }
  return { key, mime: 'image/webp', width: result.info.width, height: result.info.height, bytes: result.info.size };
}
async function deleteStoredImage(key) {
  if (!keyPattern.test(key)) throw new Error('Invalid stored image key');
  await fs.unlink(path.join(uploadsRoot, key)).catch(error => { if (error.code !== 'ENOENT') throw error; });
}
async function compensate(files = []) {
  for (const file of files) if (file?.storedKey && !file.committed) await deleteStoredImage(file.storedKey);
}
module.exports = { uploadsRoot, validateImage, validateAndStoreImage, deleteStoredImage, compensate };
