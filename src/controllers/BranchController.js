const BranchService = require('../services/BranchService');
const { getRequestIp } = require('../utils/activityLog');

class BranchController {
  // Sucursales
  async createBranch(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const branch = await BranchService.createBranch(req.body, requestIp, adminId);
      res.status(201).json(branch);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  async getAllBranches(req, res) {
    try {
      const branches = await BranchService.getAllBranches();
      res.json(branches);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener sucursales' });
    }
  }

  async getPublicBranches(req, res) {
    try {
      const branches = await BranchService.getPublicBranches();
      res.json(branches);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener sucursales publicas' });
    }
  }

  async getManagers(req, res) {
    try {
      const managers = await BranchService.getManagers();
      res.json(managers);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener gerentes' });
    }
  }

  async updateBranch(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const updated = await BranchService.updateBranch(req.body.id, req.body, requestIp, adminId);
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  async deleteBranch(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const updated = await BranchService.deactivateBranch(req.params.id, requestIp, adminId);
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  // Proveedores
  async createProvider(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const provider = await BranchService.createProvider(req.body, requestIp, adminId);
      res.status(201).json(provider);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  async getAllProviders(req, res) {
    try {
      const providers = await BranchService.getAllProviders();
      res.json(providers);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener proveedores' });
    }
  }

  async updateProvider(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const updated = await BranchService.updateProvider(req.body.id, req.body, requestIp, adminId);
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  async deleteProvider(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const updated = await BranchService.deactivateProvider(req.params.id, requestIp, adminId);
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new BranchController();
