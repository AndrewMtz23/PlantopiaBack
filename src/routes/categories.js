const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const CategoryController = require('../controllers/CategoryController');

const createCategoryRoutes = (db) => {
  const router = express.Router();

  router.get('/categorias', CategoryController.getAllCategories);
  router.post('/crearCategoria', authenticateToken, requireAdmin, CategoryController.createCategory);
  router.put('/editarCategoria', authenticateToken, requireAdmin, CategoryController.updateLegacyCategory);
  router.delete('/eliminarCategoria/:id(\\d+)', authenticateToken, requireAdmin, CategoryController.deleteCategory);

  router.post('/categorias', authenticateToken, requireAdmin, CategoryController.createCategory);
  router.get('/categorias/:id(\\d+)', CategoryController.getCategoryById);
  router.put('/categorias/:id(\\d+)', authenticateToken, requireAdmin, CategoryController.updateCategory);
  router.delete('/categorias/:id(\\d+)', authenticateToken, requireAdmin, CategoryController.deleteCategory);

  return router;
};

module.exports = createCategoryRoutes;
