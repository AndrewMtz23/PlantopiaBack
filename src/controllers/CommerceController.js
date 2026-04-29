const CommerceService = require('../services/CommerceService');
const { getRequestIp } = require('../utils/activityLog');

class CommerceController {
  async addToCart(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const { inventario, usuario, cantidad, subtotal } = req.body;
      const result = await CommerceService.addToCart(usuario, inventario, cantidad, subtotal, requestIp);
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  }

  async getCart(req, res) {
    try {
      const cart = await CommerceService.getCart(req.params.usuario);
      res.json(cart);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener el carrito' });
    }
  }

  async updateCartItem(req, res) {
    try {
      const result = await CommerceService.updateCartItem(req.body.id, req.body);
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  async deleteCartItem(req, res) {
    try {
      const result = await CommerceService.deleteCartItem(req.params.id);
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  async addToWishlist(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const { inventario, usuario } = req.body;
      const result = await CommerceService.addToWishlist(usuario, inventario, requestIp);
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al agregar a la lista' });
    }
  }

  async getWishlist(req, res) {
    try {
      const wishlist = await CommerceService.getWishlist(req.params.usuario);
      res.json(wishlist);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener la lista' });
    }
  }

  async getWishlistIds(req, res) {
    try {
      const wishlistIds = await CommerceService.getWishlistIds(req.params.usuario);
      res.json(wishlistIds);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener agregados' });
    }
  }

  async deleteWishlistItem(req, res) {
    try {
      const result = await CommerceService.deleteWishlistItem(req.params.id);
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  async removeInventoryFromWishlist(req, res) {
    try {
      const result = await CommerceService.removeInventoryFromWishlist(
        req.params.usuario,
        req.params.inventario
      );
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  async processPurchase(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const result = await CommerceService.processPurchase(req.body.usuario, req.body, requestIp);
      res.json({
        message: "Compra procesada correctamente.",
        pagoId: result.paymentId,
        total: result.total
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  }

  async getPendingOrders(req, res) {
    try {
      const orders = await CommerceService.getPendingOrders();
      res.json(orders);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener pedidos pendientes' });
    }
  }

  async updateDeliveryStatus(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const actorId = Number(req.auth?.idUsuario);
      const actorRole = Number(req.auth?.tipo);
      const { status } = req.body;
      const updated = await CommerceService.updateDeliveryStatus(req.params.id, status, requestIp, actorId, actorRole);
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  async getAvailableDeliveries(req, res) {
    try {
      const deliveries = await CommerceService.getAvailableDeliveries();
      res.json(deliveries);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener entregas disponibles' });
    }
  }

  async getMyDeliveries(req, res) {
    try {
      const repartidorId = Number(req.auth?.idUsuario);
      const deliveries = await CommerceService.getMyDeliveries(repartidorId);
      res.json(deliveries);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener tus entregas' });
    }
  }

  async assignDelivery(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const repartidorId = Number(req.auth?.idUsuario);
      const result = await CommerceService.assignDelivery(req.params.id, repartidorId, requestIp);
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new CommerceController();
