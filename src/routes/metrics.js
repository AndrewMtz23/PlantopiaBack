const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const MetricController = require('../controllers/MetricController');

const createMetricsRoutes = (db) => {
  const router = express.Router();

  router.get('/dashboardResumen', authenticateToken, requireAdmin, MetricController.getDashboard);
  router.get('/metricasGenerales', authenticateToken, requireAdmin, MetricController.getDashboard);
  router.get('/ventasPorSucursal', authenticateToken, requireAdmin, MetricController.getSalesByBranch);

  return router;
};

module.exports = createMetricsRoutes;
