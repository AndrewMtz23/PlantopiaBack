const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const ProductController = require('../controllers/ProductController');

const createInventoryRoutes = (db) => {
  const router = express.Router();

  router.get('/verInventario', authenticateToken, authorizeRole([1, 3]), ProductController.getAllInventory);
  router.post('/crearInventario', authenticateToken, authorizeRole([1, 3]), ProductController.createInventory);
  router.put('/editarInventario', authenticateToken, authorizeRole([1, 3]), ProductController.updateInventory);
  router.delete('/eliminarInventario/:id(\\d+)', authenticateToken, authorizeRole([1, 3]), ProductController.deleteInventory);

  router.get('/inventario', authenticateToken, authorizeRole([1, 3]), ProductController.getAllInventory);
  router.post('/inventario/update', authenticateToken, authorizeRole([1, 3]), ProductController.updateStock);

  return router;
};

module.exports = createInventoryRoutes;
