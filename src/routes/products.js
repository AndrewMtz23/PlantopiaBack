const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { handleProductImagesUpload, uploadsRoot } = require('../middleware/upload');
const ProductController = require('../controllers/ProductController');

const singleUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => {
      const directory = path.join(uploadsRoot, 'tmp', 'products');
      fs.mkdirSync(directory, { recursive: true });
      callback(null, directory);
    },
    filename: (req, file, callback) => callback(null, `single-${Date.now()}${path.extname(file.originalname || '')}`)
  })
}).single('image');

const handleSingleUpload = (req, res, next) => {
  singleUpload(req, res, (error) => {
    if (error) return res.status(400).json({ error: error.message });
    return next();
  });
};

const createProductRoutes = (db) => {
  const router = express.Router();

  router.get('/obtenerProductos', ProductController.getCatalogProducts);
  router.get('/productoDetalle/:id(\\d+)', ProductController.getCatalogProductByInventoryId);
  router.post('/upload', authenticateToken, authorizeRole([1, 3]), handleSingleUpload, ProductController.uploadSingleImage);
  router.post('/productoImagenes/:id(\\d+)', authenticateToken, authorizeRole([1, 3]), handleProductImagesUpload, ProductController.uploadProductImages);
  router.get('/verProducto', ProductController.getAllProducts);
  router.post('/crearProducto', authenticateToken, authorizeRole([1, 3]), ProductController.createProduct);
  router.put('/editarProducto', authenticateToken, authorizeRole([1, 3]), ProductController.updateLegacyProduct);
  router.delete('/eliminarProducto/:id', authenticateToken, authorizeRole([1, 3]), ProductController.deleteProduct);

  router.post('/', authenticateToken, authorizeRole([1, 3]), ProductController.createProduct);
  router.get('/', ProductController.getAllProducts);
  router.post('/stock', authenticateToken, authorizeRole([1, 3]), ProductController.updateStock);
  router.get('/:id(\\d+)', ProductController.getProductById);
  router.put('/:id(\\d+)', authenticateToken, authorizeRole([1, 3]), ProductController.updateProduct);

  return router;
};

module.exports = createProductRoutes;
