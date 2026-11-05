const MetricService = require('../services/MetricService');

class MetricController {
  async getDashboard(req, res) {
    try {
      const dashboard = await MetricService.getDashboardSummary();
      res.json(dashboard);
    } catch (error) {
      require('../infrastructure/logging/logger').writeTechnicalLog({ level: 'error', event: 'operation_failed' });
      res.status(500).json({ error: 'Error al obtener el dashboard' });
    }
  }

  async getLogs(req, res) {
    try {
      const limit = Number(req.query.limit) || 50;
      const logs = await MetricService.getRecentLogs(limit, req.query);
      res.json(logs);
    } catch (error) {
      require('../infrastructure/logging/logger').writeTechnicalLog({ level: 'error', event: 'operation_failed' });
      res.status(500).json({ error: 'Error al obtener los logs' });
    }
  }

  async getLogById(req, res) {
    try {
      const log = await MetricService.getLogById(req.params.id);
      if (!log) return res.status(404).json({ error: 'Log no encontrado' });
      res.json(log);
    } catch (error) {
      require('../infrastructure/logging/logger').writeTechnicalLog({ level: 'error', event: 'operation_failed' });
      res.status(500).json({ error: 'Error al obtener el log' });
    }
  }

  async getSalesByBranch(req, res, next) {
    try {
      const sales = await MetricService.getSalesByBranch(req.query);
      res.json(sales);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MetricController();
