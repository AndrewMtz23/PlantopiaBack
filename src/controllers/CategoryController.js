const CategoryService = require('../services/CategoryService');
const { getRequestIp } = require('../utils/activityLog');

class CategoryController {
  async createCategory(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const category = await CategoryService.createCategory(req.body, requestIp, adminId);
      res.status(201).json(category);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  async getAllCategories(req, res) {
    try {
      const includeInactive = req.query.all === 'true';
      const categories = await CategoryService.getAllCategories(includeInactive);
      res.json(categories);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener categorías' });
    }
  }

  async getCategoryById(req, res) {
    try {
      const category = await CategoryService.getCategoryById(req.params.id);
      res.json(category);
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: error.message });
    }
  }

  async updateCategory(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const updated = await CategoryService.updateCategory(req.params.id, req.body, requestIp, adminId);
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  async updateLegacyCategory(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const updated = await CategoryService.updateCategory(req.body.id, req.body, requestIp, adminId);
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  async deleteCategory(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      await CategoryService.deleteCategory(req.params.id, requestIp, adminId);
      res.json({ message: 'Categoría desactivada correctamente' });
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new CategoryController();
