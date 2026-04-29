const fs = require("fs/promises");
const path = require("path");
const { uploadsRoot } = require("../middleware/upload");

const defaultProfileDirectory = path.join(uploadsRoot, "defaults");
const defaultProfileImagePath = path.join(defaultProfileDirectory, "character_00.svg");

const defaultProfileSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="128" fill="#e8f7f1"/>
  <circle cx="256" cy="188" r="82" fill="#22b573"/>
  <path d="M108 422c22-78 78-124 148-124s126 46 148 124" fill="#1f6a42"/>
  <path d="M188 160c22 20 47 30 76 30 23 0 44-6 64-18" fill="none" stroke="#f7fffa" stroke-width="22" stroke-linecap="round"/>
</svg>
`;

const slugify = (value = "") => {
  const normalized = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return normalized || "usuario";
};

const toPublicUploadPath = (absolutePath) => {
  const relativePath = path.relative(uploadsRoot, absolutePath).split(path.sep).join("/");
  return `/uploads/${relativePath}`;
};

const getProfileDirectory = (userId, name) =>
  path.join(uploadsRoot, "profiles", `user-${userId}-${slugify(name)}`);

const getProductDirectory = (productId, name) =>
  path.join(uploadsRoot, "products", `product-${productId}-${slugify(name)}`);

const ensureDefaultProfileImage = async () => {
  await fs.mkdir(defaultProfileDirectory, { recursive: true });

  try {
    await fs.access(defaultProfileImagePath);
  } catch (error) {
    await fs.writeFile(defaultProfileImagePath, defaultProfileSvg, "utf8");
  }

  return defaultProfileImagePath;
};

const removeExistingProfileImages = async (directoryPath) => {
  try {
    const files = await fs.readdir(directoryPath);
    await Promise.all(
      files
        .filter((fileName) => fileName.startsWith("profile."))
        .map((fileName) => fs.unlink(path.join(directoryPath, fileName)))
    );
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
};

const storeUserProfileImage = async ({ userId, name, tempFilePath, originalName }) => {
  const profileDirectory = getProfileDirectory(userId, name);
  await fs.mkdir(profileDirectory, { recursive: true });
  await removeExistingProfileImages(profileDirectory);

  let finalPath;

  if (tempFilePath) {
    const extension = path.extname(originalName || tempFilePath).toLowerCase() || ".jpg";
    finalPath = path.join(profileDirectory, `profile${extension}`);
    await fs.rename(tempFilePath, finalPath);
  } else {
    const defaultImage = await ensureDefaultProfileImage();
    finalPath = path.join(profileDirectory, "profile.svg");
    await fs.copyFile(defaultImage, finalPath);
  }

  return toPublicUploadPath(finalPath);
};

const cleanupTempFile = async (file) => {
  if (!file?.path) {
    return;
  }

  try {
    await fs.unlink(file.path);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.log(error);
    }
  }
};

const cleanupTempFiles = async (files = []) => {
  await Promise.all(files.map((file) => cleanupTempFile(file)));
};

const storeProductImages = async ({ productId, name, files = [], startOrder = 0 }) => {
  if (!files.length) {
    return [];
  }

  const productDirectory = getProductDirectory(productId, name);
  await fs.mkdir(productDirectory, { recursive: true });

  const storedImages = [];

  for (const [index, file] of files.entries()) {
    const extension = path.extname(file.originalname || file.path).toLowerCase() || ".jpg";
    const finalPath = path.join(
      productDirectory,
      `img-${Date.now()}-${index + 1}${extension}`
    );

    await fs.rename(file.path, finalPath);
    storedImages.push({
      ruta: toPublicUploadPath(finalPath),
      nombreOriginal: file.originalname || path.basename(finalPath),
      orden: startOrder + index,
    });
  }

  return storedImages;
};

module.exports = {
  cleanupTempFiles,
  cleanupTempFile,
  storeProductImages,
  storeUserProfileImage,
  toPublicUploadPath,
  uploadsRoot,
};
