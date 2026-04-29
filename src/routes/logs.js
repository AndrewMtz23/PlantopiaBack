const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const MetricController = require('../controllers/MetricController');

const createLogRoutes = (db) => {
  const router = express.Router();

  router.get('/verLogs', authenticateToken, requireAdmin, MetricController.getLogs);
  router.get('/verLog/:id(\\d+)', authenticateToken, requireAdmin, MetricController.getLogById);

  return router;
};

module.exports = createLogRoutes;
