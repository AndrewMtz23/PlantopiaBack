const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const BranchController = require('../controllers/BranchController');

const createProviderRoutes = (db) => {
  const router = express.Router();

  router.post('/crearProveedor', authenticateToken, requireAdmin, BranchController.createProvider);
  router.get('/verProveedor', authenticateToken, requireAdmin, BranchController.getAllProviders);
  router.get('/verProveedores', authenticateToken, requireAdmin, BranchController.getAllProviders);
  router.put('/editarProveedor', authenticateToken, requireAdmin, BranchController.updateProvider);
  router.delete('/eliminarProveedor/:id(\\d+)', authenticateToken, requireAdmin, BranchController.deleteProvider);

  return router;
};

module.exports = createProviderRoutes;
