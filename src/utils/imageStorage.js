const path = require('node:path');
const { uploadsRoot, validateAndStoreImage, compensate } = require('../infrastructure/storage/imageStore');
const toPublicUploadPath = absolutePath => `/uploads/${path.relative(uploadsRoot, absolutePath).split(path.sep).join('/')}`;
async function storeUserProfileImage({ file }) {
  if (!file) return null;
  const stored = await validateAndStoreImage(file, { ownerType: 'profile' });
  return `/uploads/${stored.key}`;
}
async function storeProductImages({ files = [], startOrder = 0 }) {
  const stored = [];
  try {
    for (const [index, file] of files.entries()) {
      const image = await validateAndStoreImage(file, { ownerType: 'product' });
      stored.push({ ruta: `/uploads/${image.key}`, nombreOriginal: path.basename(file.originalname || '').slice(0, 255), orden: startOrder + index });
    }
    return stored;
  } catch (error) { await compensate(files); throw error; }
}
const cleanupTempFile = file => compensate(file ? [file] : []);
const cleanupTempFiles = files => compensate(files);
module.exports = { uploadsRoot, toPublicUploadPath, storeUserProfileImage, storeProductImages, cleanupTempFile, cleanupTempFiles };
