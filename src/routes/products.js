const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { handleProductImagesUpload, handleSingleUpload } = require('../middleware/upload');
const ProductController = require('../controllers/ProductController');

const createProductRoutes = (db) => {
  const router = express.Router();
  for (const name of ['id', 'usuario', 'inventario']) router.param(name, require('../shared/http/validate').validateIdParam);

  router.get('/obtenerProductos', ProductController.getCatalogProducts);
  router.get('/productoDetalle/:id(\\d+)', ProductController.getCatalogProductByInventoryId);
  router.post('/upload', authenticateToken, authorizeRole([1, 3]), handleSingleUpload, ProductController.uploadSingleImage);
  router.post('/productoImagenes/:id(\\d+)', authenticateToken, authorizeRole([1, 3]), handleProductImagesUpload, ProductController.uploadProductImages);
  router.get('/verProducto', authenticateToken, authorizeRole([1, 3]), ProductController.getAllProducts);
  router.post('/crearProducto', authenticateToken, authorizeRole([1, 3]), ProductController.createProduct);
  router.put('/editarProducto', authenticateToken, authorizeRole([1, 3]), ProductController.updateLegacyProduct);
  router.delete('/eliminarProducto/:id', authenticateToken, authorizeRole([1, 3]), ProductController.deleteProduct);

  router.post('/', authenticateToken, authorizeRole([1, 3]), ProductController.createProduct);
  router.get('/', authenticateToken, authorizeRole([1, 3]), ProductController.getAllProducts);
  router.post('/stock', authenticateToken, authorizeRole([1, 3]), ProductController.updateStock);
  router.get('/:id(\\d+)', authenticateToken, authorizeRole([1, 3]), ProductController.getProductById);
  router.put('/:id(\\d+)', authenticateToken, authorizeRole([1, 3]), ProductController.updateProduct);

  return router;
};

module.exports = createProductRoutes;
