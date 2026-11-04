const ProductService = require('../services/ProductService');
const { getRequestIp } = require('../utils/activityLog');

class ProductController {
  async createProduct(req, res, next) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const product = await ProductService.createProduct(req.body, requestIp, adminId);
      res.status(201).json(product);
    } catch (error) {
      return next(error);
    }
  }

  async getAllProducts(req, res, next) {
    try {
      const products = await ProductService.getAllProducts();
      res.json(products);
    } catch (error) {
      return next(error);
    }
  }

  async getCatalogProducts(req, res, next) {
    try {
      const products = await ProductService.getCatalogProducts();
      res.json(products);
    } catch (error) {
      return next(error);
    }
  }

  async getAllInventory(req, res, next) {
    try {
      const inventory = await ProductService.getAllInventory();
      res.json(inventory);
    } catch (error) {
      return next(error);
    }
  }

  async createInventory(req, res, next) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const inventory = await ProductService.createInventory(req.body, requestIp, adminId);
      res.status(201).json(inventory);
    } catch (error) {
      return next(error);
    }
  }

  async updateInventory(req, res, next) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const updated = await ProductService.updateInventory(req.body.id, req.body, requestIp, adminId);
      res.json(updated);
    } catch (error) {
      return next(error);
    }
  }

  async deleteInventory(req, res, next) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const updated = await ProductService.deactivateInventory(req.params.id, requestIp, adminId);
      res.json(updated);
    } catch (error) {
      return next(error);
    }
  }

  async uploadSingleImage(req, res, next) {
    try {
      const result = await ProductService.storeSingleProductImage(req.file);
      res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async uploadProductImages(req, res, next) {
    try {
      const images = await ProductService.storeProductGallery(req.params.id, req.files || []);
      res.json({ images });
    } catch (error) {
      return next(error);
    }
  }

  async getCatalogProductByInventoryId(req, res, next) {
    try {
      const product = await ProductService.getCatalogProductByInventoryId(req.params.id);
      res.json(product);
    } catch (error) {
      return next(error);
    }
  }

  async getProductById(req, res, next) {
    try {
      const product = await ProductService.getProductById(req.params.id);
      res.json(product);
    } catch (error) {
      return next(error);
    }
  }

  async updateProduct(req, res, next) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const updated = await ProductService.updateProduct(req.params.id, req.body, requestIp, adminId);
      res.json(updated);
    } catch (error) {
      return next(error);
    }
  }

  async updateLegacyProduct(req, res, next) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const updated = await ProductService.updateProductFromLegacyPayload(req.body, requestIp, adminId);
      res.json(updated);
    } catch (error) {
      return next(error);
    }
  }

  async deleteProduct(req, res, next) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const updated = await ProductService.deactivateProduct(req.params.id, requestIp, adminId);
      res.json(updated);
    } catch (error) {
      return next(error);
    }
  }

  async updateStock(req, res, next) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const inventory = await ProductService.updateStock(req.body, requestIp, adminId);
      res.json(inventory);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new ProductController();
