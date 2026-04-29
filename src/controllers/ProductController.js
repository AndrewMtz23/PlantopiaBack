const ProductService = require('../services/ProductService');
const { getRequestIp } = require('../utils/activityLog');

class ProductController {
  async createProduct(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const product = await ProductService.createProduct(req.body, requestIp, adminId);
      res.status(201).json(product);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  async getAllProducts(req, res) {
    try {
      const products = await ProductService.getAllProducts();
      res.json(products);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener productos' });
    }
  }

  async getCatalogProducts(req, res) {
    try {
      const products = await ProductService.getCatalogProducts();
      res.json(products);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener productos' });
    }
  }

  async getAllInventory(req, res) {
    try {
      const inventory = await ProductService.getAllInventory();
      res.json(inventory);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener inventarios' });
    }
  }

  async createInventory(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const inventory = await ProductService.createInventory(req.body, requestIp, adminId);
      res.status(201).json(inventory);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  async updateInventory(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const updated = await ProductService.updateInventory(req.body.id, req.body, requestIp, adminId);
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  async deleteInventory(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const updated = await ProductService.deactivateInventory(req.params.id, requestIp, adminId);
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  async uploadSingleImage(req, res) {
    try {
      const result = await ProductService.storeSingleProductImage(req.file);
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  async uploadProductImages(req, res) {
    try {
      const images = await ProductService.storeProductGallery(req.params.id, req.files || []);
      res.json({ images });
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  async getCatalogProductByInventoryId(req, res) {
    try {
      const product = await ProductService.getCatalogProductByInventoryId(req.params.id);
      res.json(product);
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: error.message });
    }
  }

  async getProductById(req, res) {
    try {
      const product = await ProductService.getProductById(req.params.id);
      res.json(product);
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: error.message });
    }
  }

  async updateProduct(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const updated = await ProductService.updateProduct(req.params.id, req.body, requestIp, adminId);
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  async updateLegacyProduct(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const updated = await ProductService.updateProductFromLegacyPayload(req.body, requestIp, adminId);
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  async deleteProduct(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const updated = await ProductService.deactivateProduct(req.params.id, requestIp, adminId);
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  async updateStock(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const inventory = await ProductService.updateStock(req.body, requestIp, adminId);
      res.json(inventory);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new ProductController();
