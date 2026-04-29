const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const BranchController = require('../controllers/BranchController');

const createBranchRoutes = (db) => {
  const router = express.Router();

  router.post('/crearSucursal', authenticateToken, requireAdmin, BranchController.createBranch);
  router.get('/verSucursal', BranchController.getAllBranches);
  router.get('/verSucursales', authenticateToken, requireAdmin, BranchController.getAllBranches);
  router.get('/sucursalesPublicas', BranchController.getPublicBranches);
  router.get('/verGerente', authenticateToken, requireAdmin, BranchController.getManagers);
  router.put('/editarSucursal', authenticateToken, requireAdmin, BranchController.updateBranch);
  router.delete('/eliminarSucursal/:id(\\d+)', authenticateToken, requireAdmin, BranchController.deleteBranch);

  return router;
};

module.exports = createBranchRoutes;
