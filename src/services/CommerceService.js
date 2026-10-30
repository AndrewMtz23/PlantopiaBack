const prisma = require('../config/prisma');
const Checkout = require('./CheckoutService');
const { quantity, money } = require('./PricingService');
const AppError = require('../utils/AppError');
const CommerceRepository = require('../repositories/CommerceRepository');
const { writeActivityLog } = require('../utils/activityLog');

class CommerceService {
  formatInventoryProduct(inventory) {
    const product = inventory.tproductos || {};
    const branch = inventory.tsucursales || {};

    return {
      id: inventory.id,
      inventario_id: inventory.id,
      producto_id: product.id,
      producto: product.id,
      estatus: product.estatus,
      inventario_estatus: inventory.estatus,
      sucursal: inventory.sucursal,
      sucursal_nombre: branch.nombre,
      cantidad: inventory.cantidad,
      inventario_cant: inventory.cantidad,
      nombre: product.nombre,
      detalles: product.detalles,
      categoria: product.categoria,
      precioVenta: product.precioVenta,
      imagen: product.imagen,
      imagenUrl: product.imagenUrl,
    };
  }

  formatCartItem(item) {
    const product = this.formatInventoryProduct(item.tinventario || {});

    return {
      ...product,
      id: item.id,
      pedido_id: item.id,
      inventario_id: item.inventario,
      cantidad: item.cantidad,
      subtotal: money(money(item.tinventario.tproductos.precioVenta).times(item.cantidad)).toFixed(2),
      inventario_cant: item.tinventario?.cantidad || 0,
    };
  }

  formatWishlistItem(item) {
    return {
      ...this.formatInventoryProduct(item.tinventario || {}),
      lista_id: item.id,
    };
  }

  async attachPaymentRelations(payments, { includeSales = false, userFields = null } = {}) {
    const paymentIds = payments.map((payment) => payment.id);
    const userIds = [...new Set(payments.map((payment) => payment.usuario).filter(Boolean).map(Number))];

    const users = userIds.length
      ? await prisma.tusuarios.findMany({
          where: { id: { in: userIds } },
          select: userFields || {
            id: true,
            nombre: true,
            correo: true,
            telefono: true,
            domicilio: true,
            ciudad: true,
            estadoDireccion: true,
            codigoPostal: true,
            referenciasDomicilio: true,
            latitud: true,
            longitud: true
          }
        })
      : [];
    const usersById = new Map(users.map((user) => [user.id, user]));

    let salesByPaymentId = new Map();
    if (includeSales && paymentIds.length) {
      const sales = await prisma.tventas.findMany({
        where: { pago: { in: paymentIds } },
        include: { tproductos: true }
      });
      salesByPaymentId = sales.reduce((map, sale) => {
        const list = map.get(sale.pago) || [];
        list.push(sale);
        map.set(sale.pago, list);
        return map;
      }, new Map());
    }

    return payments.map((payment) => ({
      ...payment,
      tusuarios: usersById.get(Number(payment.usuario)) || null,
      tventas: includeSales ? salesByPaymentId.get(payment.id) || [] : undefined
    }));
  }

  // Carrito
  async addToCart(userId, inventarioId, cantidad) {
    quantity(cantidad);
    if (!Number.isSafeInteger(Number(inventarioId)) || Number(inventarioId) <= 0) throw new AppError(400, 'INVALID_ID', 'Inventario invalido.');
    return Checkout.transaction(async tx => {
      await Checkout.lockCart(tx, userId);
      const stock = await tx.tinventario.findUnique({ where: { id: Number(inventarioId) }, include: { tproductos: true } });
      if (!stock || stock.estatus !== 1 || stock.tproductos.estatus !== 1) throw new AppError(409, 'UNAVAILABLE', 'Producto no disponible.');
      const where = { usuario_inventario: { usuario: Number(userId), inventario: stock.id } };
      const current = await tx.tpedido.findUnique({ where });
      const count = quantity((current?.cantidad || 0) + cantidad);
      if (count > stock.cantidad) throw new AppError(409, 'OUT_OF_STOCK', 'Stock insuficiente.');
      const data = { cantidad: count, subtotal: money(money(stock.tproductos.precioVenta).times(count)).toFixed(2) };
      return tx.tpedido.upsert({ where, create: { ...data, usuario: Number(userId), inventario: stock.id }, update: data });
    });
  }

  async getCart(userId) {
    const cart = await CommerceRepository.getCartByUser(userId);
    return cart.map((item) => this.formatCartItem(item));
  }

  async updateCartItem(actorId, id, payload) {
    quantity(payload.cantidad);
    return Checkout.transaction(async tx => {
      await Checkout.lockCart(tx, actorId);
      const item = await tx.tpedido.findFirst({ where: { id: Number(id), usuario: Number(actorId) }, include: { tinventario: { include: { tproductos: true } } } });
      if (!item) throw new AppError(404, 'NOT_FOUND', 'Articulo no encontrado.');
      const stock = item.tinventario;
      if (stock.estatus !== 1 || stock.tproductos.estatus !== 1 || payload.cantidad > stock.cantidad) throw new AppError(409, 'UNAVAILABLE', 'Cantidad no disponible.');
      return tx.tpedido.update({ where: { id: Number(id), usuario: Number(actorId) }, data: { cantidad: payload.cantidad, subtotal: money(money(stock.tproductos.precioVenta).times(payload.cantidad)).toFixed(2) } });
    });
  }
  async deleteCartItem(actorId, id) {
    return Checkout.transaction(async tx => {
      await Checkout.lockCart(tx, actorId);
      return tx.tpedido.delete({ where: { id: Number(id), usuario: Number(actorId) } });
    });
  }

  // Lista de Deseos
  async addToWishlist(userId, inventarioId, requestIp) {
    const existing = await prisma.tlista.findFirst({
      where: { usuario: Number(userId), inventario: Number(inventarioId) }
    });

    if (existing) return { alreadyExists: true, id: existing.id };

    const item = await CommerceRepository.addToWishlist(userId, inventarioId);

    await writeActivityLog(null, {
      usuario: userId,
      modulo: "lista_deseos",
      accion: "agregar_lista",
      descripcion: `Se agregó inventario #${inventarioId} a la lista de deseos.`,
      entidad: "tlista",
      entidadId: item.id,
      nivel: "info",
      ip: requestIp,
    });

    return item;
  }

  async getWishlist(userId) {
    const wishlist = await CommerceRepository.getWishlistByUser(userId);
    return wishlist.map((item) => this.formatWishlistItem(item));
  }

  async getWishlistIds(userId) {
    const wishlist = await prisma.tlista.findMany({
      where: { usuario: Number(userId) },
      select: { inventario: true }
    });

    return wishlist.map((item) => item.inventario);
  }

  async deleteWishlistItem(actorId, id) {
    return await prisma.tlista.delete({
      where: { id: Number(id), usuario: Number(actorId) }
    });
  }

  async removeInventoryFromWishlist(userId, inventarioId) {
    return await CommerceRepository.removeFromWishlist(userId, inventarioId);
  }

  // Transacción de Compra (Procesar Compra)
  async processPurchase(userId, purchaseData, requestIp, idempotencyKey) {
    return Checkout.checkout({ userId, idempotencyKey, payload: purchaseData });
  }

  // Gestión de Pedidos (Para Empleado y Admin)
  async getPendingOrders() {
    const payments = await prisma.tpagos.findMany({
      where: {
        estadoEntrega: { in: ['preparando', 'listo'] }
      },
      orderBy: { fechaRegistro: 'asc' }
    });

    return this.attachPaymentRelations(payments, {
      includeSales: true,
      userFields: { id: true, nombre: true, correo: true, telefono: true, domicilio: true, ciudad: true, estadoDireccion: true, codigoPostal: true, referenciasDomicilio: true, latitud: true, longitud: true }
    });
  }

  async updateDeliveryStatus(pagoId, status, requestIp, actorId, actorRole) {
    return require('./PaymentStateService').updateDelivery({ paymentId: pagoId, status, actorId, actorRole });
  }

  // Logística (Para Repartidor y Admin)
  async getAvailableDeliveries() {
    const payments = await prisma.tpagos.findMany({
      where: {
        estadoEntrega: { in: ['preparando', 'listo'] },
        repartidorId: null
      },
      orderBy: { fechaRegistro: 'asc' }
    });

    return this.attachPaymentRelations(payments, {
      includeSales: true,
      userFields: { id: true, nombre: true, telefono: true, domicilio: true, ciudad: true, estadoDireccion: true, codigoPostal: true, referenciasDomicilio: true, latitud: true, longitud: true }
    });
  }

  async getMyDeliveries(repartidorId) {
    const payments = await prisma.tpagos.findMany({
      where: {
        repartidorId: Number(repartidorId),
        estadoEntrega: { in: ['enviado', 'entregado'] }
      },
      orderBy: { fechaActualizacion: 'desc' }
    });

    return this.attachPaymentRelations(payments, {
      includeSales: true,
      userFields: { id: true, nombre: true, telefono: true, domicilio: true, ciudad: true, estadoDireccion: true, codigoPostal: true, referenciasDomicilio: true, latitud: true, longitud: true }
    });
  }

  async assignDelivery(pagoId, repartidorId) {
    return require('./PaymentStateService').assignDelivery(pagoId, repartidorId);
  }
}
module.exports = new CommerceService();
