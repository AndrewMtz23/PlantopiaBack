const CommerceService = require('../services/CommerceService');
const { getRequestIp } = require('../utils/activityLog');

class CommerceController {
  async addToCart(req, res, next) {
    try {
      const requestIp = getRequestIp(req);
      const { inventario, usuario, cantidad, subtotal } = req.body;
      const result = await CommerceService.addToCart(req.auth.idUsuario, inventario, cantidad, subtotal, requestIp);
      res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async getCart(req, res, next) {
    try {
      const cart = await CommerceService.getCart(req.params.usuario);
      res.json(cart);
    } catch (error) {
      return next(error);
    }
  }

  async updateCartItem(req, res, next) {
    try {
      const result = await CommerceService.updateCartItem(req.auth.idUsuario, req.body.id, req.body);
      res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async deleteCartItem(req, res, next) {
    try {
      const result = await CommerceService.deleteCartItem(req.auth.idUsuario, req.params.id);
      res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async addToWishlist(req, res, next) {
    try {
      const requestIp = getRequestIp(req);
      const { inventario, usuario } = req.body;
      const result = await CommerceService.addToWishlist(req.auth.idUsuario, inventario, requestIp);
      res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async getWishlist(req, res, next) {
    try {
      const wishlist = await CommerceService.getWishlist(req.params.usuario);
      res.json(wishlist);
    } catch (error) {
      return next(error);
    }
  }

  async getWishlistIds(req, res, next) {
    try {
      const wishlistIds = await CommerceService.getWishlistIds(req.params.usuario);
      res.json(wishlistIds);
    } catch (error) {
      return next(error);
    }
  }

  async deleteWishlistItem(req, res, next) {
    try {
      const result = await CommerceService.deleteWishlistItem(req.auth.idUsuario, req.params.id);
      res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async removeInventoryFromWishlist(req, res, next) {
    try {
      const result = await CommerceService.removeInventoryFromWishlist(
        req.params.usuario,
        req.params.inventario
      );
      res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async processPurchase(req, res, next) {
    try {
      const requestIp = getRequestIp(req);
      const result = await CommerceService.processPurchase(req.auth.idUsuario, req.body, requestIp, req.get('Idempotency-Key'));
      res.json({
        message: "Compra procesada correctamente.",
        pagoId: result.pagoId,
        estado: result.estado,
        total: result.total
      });
    } catch (error) {
      return next(error);
    }
  }

  async getPendingOrders(req, res, next) {
    try {
      const orders = await CommerceService.getPendingOrders();
      res.json(orders);
    } catch (error) {
      return next(error);
    }
  }

  async updateDeliveryStatus(req, res, next) {
    try {
      const requestIp = getRequestIp(req);
      const actorId = Number(req.auth?.idUsuario);
      const actorRole = Number(req.auth?.tipo);
      const { status } = req.body;
      const updated = await CommerceService.updateDeliveryStatus(req.params.id, status, requestIp, actorId, actorRole);
      res.json(updated);
    } catch (error) {
      return next(error);
    }
  }

  async getAvailableDeliveries(req, res, next) {
    try {
      const deliveries = await CommerceService.getAvailableDeliveries();
      res.json(deliveries);
    } catch (error) {
      return next(error);
    }
  }

  async getMyDeliveries(req, res, next) {
    try {
      const repartidorId = Number(req.auth?.idUsuario);
      const deliveries = await CommerceService.getMyDeliveries(repartidorId);
      res.json(deliveries);
    } catch (error) {
      return next(error);
    }
  }

  async assignDelivery(req, res, next) {
    try {
      const requestIp = getRequestIp(req);
      const repartidorId = Number(req.auth?.idUsuario);
      const result = await CommerceService.assignDelivery(req.params.id, repartidorId, requestIp);
      res.json(result);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new CommerceController();
