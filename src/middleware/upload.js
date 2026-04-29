const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadsRoot = process.env.UPLOADS_PATH || path.join(__dirname, "../../uploads");
const profileTempDirectory = path.join(uploadsRoot, "tmp", "profiles");
const productTempDirectory = path.join(uploadsRoot, "tmp", "products");
const allowedImageExtensions = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const ensureDirectorySync = (directoryPath) => {
  fs.mkdirSync(directoryPath, { recursive: true });
};

const imageFileFilter = (req, file, callback) => {
  const extension = path.extname(file.originalname || "").toLowerCase();

  if (!allowedImageExtensions.has(extension) || !allowedImageMimeTypes.has(file.mimetype)) {
    return callback(new Error("Formato de imagen no permitido. Usa JPG, PNG, GIF o WEBP."));
  }

  return callback(null, true);
};

const profileStorage = multer.diskStorage({
  destination: (req, file, callback) => {
    ensureDirectorySync(profileTempDirectory);
    callback(null, profileTempDirectory);
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const randomSuffix = Math.round(Math.random() * 1e9);
    callback(null, `temp-${Date.now()}-${randomSuffix}${extension}`);
  },
});

const profileImageUpload = multer({
  storage: profileStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
}).single("fotoPerfil");

const productImageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => {
      ensureDirectorySync(productTempDirectory);
      callback(null, productTempDirectory);
    },
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname || "").toLowerCase();
      const randomSuffix = Math.round(Math.random() * 1e9);
      callback(null, `temp-${Date.now()}-${randomSuffix}${extension}`);
    },
  }),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
}).array("imagenes", 20);

const handleProfileImageUpload = (req, res, next) => {
  profileImageUpload(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "La foto de perfil no puede superar 5MB." });
    }

    return res.status(400).json({
      error: error.message || "No se pudo procesar la foto de perfil.",
    });
  });
};

const handleProductImagesUpload = (req, res, next) => {
  productImageUpload(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Cada imagen del producto debe pesar menos de 10MB." });
    }

    return res.status(400).json({
      error: error.message || "No se pudieron procesar las imagenes del producto.",
    });
  });
};

module.exports = {
  handleProfileImageUpload,
  handleProductImagesUpload,
  uploadsRoot,
};
