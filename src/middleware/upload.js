const multer = require('multer');
const { uploadsRoot, validateImage, compensate } = require('../infrastructure/storage/imageStore');
const AppError = require('../utils/AppError');

// Bounded raw buffers never touch the publicly served filesystem. An aborted
// multipart request cannot leave a partial file behind.
const parser = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 5, fields: 25, fieldSize: 100 * 1024, parts: 30 } });
function upload(parse) {
  return (req, res, next) => {
    parse(req, res, async error => {
      if (error) return next(new AppError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, 'INVALID_UPLOAD', 'Revisa los archivos: maximo 5 imagenes de 5 MiB cada una.'));
      const files = req.files || (req.file ? [req.file] : []);
      res.once('finish', () => { compensate(files).catch(() => require('../infrastructure/logging/logger').writeTechnicalLog({ level: 'error', event: 'image_cleanup_failed', requestId: req.requestId })); });
      try {
        for (const file of files) await validateImage(file);
        next();
      } catch (failure) { next(failure); }
    });
  };
}
module.exports = { uploadsRoot, handleProfileImageUpload: upload(parser.single('fotoPerfil')), handleProductImagesUpload: upload(parser.array('imagenes', 5)), handleSingleUpload: upload(parser.single('image')) };
