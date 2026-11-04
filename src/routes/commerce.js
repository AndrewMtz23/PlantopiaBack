const express = require('express');
const { authenticateToken, authorizeRole, authorizeUserAccess } = require('../middleware/auth');
const CommerceController = require('../controllers/CommerceController');

const createCommerceRoutes = (db) => {
  const router = express.Router();
  for (const name of ['id', 'usuario', 'inventario']) router.param(name, require('../shared/http/validate').validateIdParam);

  router.get('/carrito/cotizacion', authenticateToken, async (req, res, next) => {
    try { res.json(await require('../services/CheckoutService').getQuote(req.auth.idUsuario)); } catch (error) { next(error); }
  });
  // Carrito
  router.get('/verCarrito/:usuario', authenticateToken, (req, res, next) => req.params.usuario ? authorizeUserAccess(r => r.params.usuario)(req, res, next) : next(), CommerceController.getCart);
  router.post('/crearCarrito', authenticateToken, CommerceController.addToCart);
  router.put('/editarCarrito', authenticateToken, CommerceController.updateCartItem);
  router.delete('/eliminarCarrito/:id', authenticateToken, CommerceController.deleteCartItem);
  
  // Wishlist
  router.get('/verLista/:usuario', authenticateToken, (req, res, next) => req.params.usuario ? authorizeUserAccess(r => r.params.usuario)(req, res, next) : next(), CommerceController.getWishlist);
  router.get('/verAgregados/:usuario', authenticateToken, (req, res, next) => req.params.usuario ? authorizeUserAccess(r => r.params.usuario)(req, res, next) : next(), CommerceController.getWishlistIds);
  router.post('/crearLista', authenticateToken, CommerceController.addToWishlist);
  router.delete('/eliminarLista/:id', authenticateToken, CommerceController.deleteWishlistItem);
  router.delete('/eliminarListaInventario/:usuario/:inventario', authenticateToken, authorizeUserAccess(req => req.params.usuario), CommerceController.removeInventoryFromWishlist);
  
  // Proceso de Compra
  router.post('/procesarCompra', authenticateToken, CommerceController.processPurchase);

  // Gestión de Pedidos (Empleado y Admin)
  router.get('/pedidos/pendientes', authenticateToken, authorizeRole([1, 3]), CommerceController.getPendingOrders);
  router.put('/pedidos/estado/:id', authenticateToken, authorizeRole([1, 3, 4]), CommerceController.updateDeliveryStatus);

  // Logística (Repartidor y Admin)
  router.get('/reparto/disponibles', authenticateToken, authorizeRole([1, 4]), CommerceController.getAvailableDeliveries);
  router.get('/reparto/mis-entregas', authenticateToken, authorizeRole([1, 4]), CommerceController.getMyDeliveries);
  router.post('/reparto/asignar/:id', authenticateToken, authorizeRole([1, 4]), CommerceController.assignDelivery);

  return router;
};

module.exports = createCommerceRoutes;
