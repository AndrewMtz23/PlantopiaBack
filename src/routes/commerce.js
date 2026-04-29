const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const CommerceController = require('../controllers/CommerceController');

const createCommerceRoutes = (db) => {
  const router = express.Router();

  // Carrito
  router.get('/verCarrito/:usuario', authenticateToken, CommerceController.getCart);
  router.post('/crearCarrito', authenticateToken, CommerceController.addToCart);
  router.put('/editarCarrito', authenticateToken, CommerceController.updateCartItem);
  router.delete('/eliminarCarrito/:id', authenticateToken, CommerceController.deleteCartItem);
  
  // Wishlist
  router.get('/verLista/:usuario', authenticateToken, CommerceController.getWishlist);
  router.get('/verAgregados/:usuario', authenticateToken, CommerceController.getWishlistIds);
  router.post('/crearLista', authenticateToken, CommerceController.addToWishlist);
  router.delete('/eliminarLista/:id', authenticateToken, CommerceController.deleteWishlistItem);
  router.delete('/eliminarListaInventario/:usuario/:inventario', authenticateToken, CommerceController.removeInventoryFromWishlist);
  
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
