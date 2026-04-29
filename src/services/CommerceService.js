const prisma = require('../config/prisma');
const CommerceRepository = require('../repositories/CommerceRepository');
const PaymentRepository = require('../repositories/PaymentRepository');
const InventoryRepository = require('../repositories/InventoryRepository');
const { writeActivityLog } = require('../utils/activityLog');

const LOW_STOCK_THRESHOLD = 5;

const isUniqueConstraintError = (error) => (
  error?.code === "P2002" ||
  error?.meta?.driverAdapterError?.name === "DriverAdapterError"
);

const resetCartSequence = async () => {
  await prisma.$executeRaw`
    SELECT setval(
      pg_get_serial_sequence('"tpedido"', 'id'),
      COALESCE((SELECT MAX(id) FROM "tpedido"), 0) + 1,
      false
    )
  `;
};

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const calculateDistanceKm = (origin, destination) => {
  const lat1 = toNumberOrNull(origin?.latitud);
  const lon1 = toNumberOrNull(origin?.longitud);
  const lat2 = toNumberOrNull(destination?.latitud);
  const lon2 = toNumberOrNull(destination?.longitud);

  if ([lat1, lon1, lat2, lon2].some((value) => value === null)) {
    return null;
  }

  const earthRadiusKm = 6371;
  const toRadians = (degrees) => degrees * (Math.PI / 180);
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLon / 2) ** 2;

  return Number((earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
};

const buildMapsUrl = (origin, destination) => {
  const originLat = toNumberOrNull(origin?.latitud);
  const originLng = toNumberOrNull(origin?.longitud);
  const destinationLat = toNumberOrNull(destination?.latitud);
  const destinationLng = toNumberOrNull(destination?.longitud);

  if ([originLat, originLng, destinationLat, destinationLng].some((value) => value === null)) {
    return null;
  }

  return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destinationLat},${destinationLng}&travelmode=driving`;
};

const normalizeBranchLocation = (branch) => ({
  id: branch.id,
  nombre: branch.nombre,
  direccion: branch.direccion,
  telefono: branch.telefono,
  latitud: toNumberOrNull(branch.latitud),
  longitud: toNumberOrNull(branch.longitud),
});

const normalizeDeliveryAddressSnapshot = (deliveryAddress = {}, user = {}) => {
  const address = deliveryAddress && typeof deliveryAddress === "object" ? deliveryAddress : {};
  const latitude = toNumberOrNull(address.latitud) ?? toNumberOrNull(user.latitud);
  const longitude = toNumberOrNull(address.longitud) ?? toNumberOrNull(user.longitud);

  return {
    nombre: String(address.nombre || user.nombre || "").trim(),
    telefono: String(address.telefono || user.telefono || "").replace(/\D/g, ""),
    correo: String(address.correo || user.correo || "").trim().toLowerCase(),
    domicilio: String(address.domicilio || user.domicilio || "").trim(),
    ciudad: String(address.ciudad || user.ciudad || "").trim(),
    estadoDireccion: String(address.estadoDireccion || user.estadoDireccion || "").trim(),
    codigoPostal: String(address.codigoPostal || user.codigoPostal || "").replace(/\D/g, ""),
    referenciasDomicilio: String(address.referenciasDomicilio || user.referenciasDomicilio || "").trim(),
    latitud: latitude,
    longitud: longitude,
  };
};

const buildDeliveryRoute = (cartItems, deliveryAddress) => {
  const destination = {
    latitud: toNumberOrNull(deliveryAddress?.latitud),
    longitud: toNumberOrNull(deliveryAddress?.longitud),
  };

  if (destination.latitud === null || destination.longitud === null) {
    return null;
  }

  const branches = new Map();

  for (const item of cartItems) {
    const branch = item.tinventario?.tsucursales;
    if (!branch || branches.has(branch.id)) continue;

    const location = normalizeBranchLocation(branch);
    const distanceKm = calculateDistanceKm(location, destination);
    if (distanceKm !== null) {
      branches.set(branch.id, { ...location, distanceKm });
    }
  }

  const closestBranch = [...branches.values()].sort((a, b) => a.distanceKm - b.distanceKm)[0];
  if (!closestBranch) return null;

  return {
    sucursalOrigen: closestBranch,
    destino: destination,
    distanciaKm: closestBranch.distanceKm,
    googleMapsUrl: buildMapsUrl(closestBranch, destination),
  };
};

const validateDeliveryStatusTransition = ({ existing, nextStatus, actorId, actorRole }) => {
  const currentStatus = existing.estadoEntrega;

  if (Number(actorRole) === 4) {
    if (Number(existing.repartidorId) !== Number(actorId)) {
      throw new Error("Solo puedes actualizar entregas asignadas a tu usuario.");
    }

    if (currentStatus === "enviado" && nextStatus === "entregado") {
      return;
    }

    throw new Error("El repartidor solo puede confirmar entregas en camino.");
  }

  if (![1, 3].includes(Number(actorRole))) {
    throw new Error("No tienes permisos para actualizar pedidos.");
  }

  const allowedTransitions = {
    preparando: ["listo", "cancelado"],
    listo: ["preparando", "cancelado"],
    enviado: ["cancelado"],
    entregado: [],
    cancelado: [],
  };

  if (!(allowedTransitions[currentStatus] || []).includes(nextStatus)) {
    throw new Error(`No se puede cambiar un pedido de ${currentStatus} a ${nextStatus}.`);
  }
};

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
      proveedor: inventory.proveedor,
      cantidad: inventory.cantidad,
      inventario_cant: inventory.cantidad,
      nombre: product.nombre,
      detalles: product.detalles,
      categoria: product.categoria,
      precioCompra: product.precioCompra,
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
      subtotal: Number(item.subtotal),
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
  async addToCart(userId, inventarioId, cantidad, subtotal, requestIp) {
    const cartData = {
      usuario: Number(userId),
      inventario: Number(inventarioId),
      cantidad: Number(cantidad),
      subtotal: parseFloat(subtotal)
    };

    if (!cartData.usuario || !cartData.inventario || !cartData.cantidad || Number.isNaN(cartData.subtotal)) {
      throw new Error("Datos incompletos para agregar al carrito.");
    }

    const existing = await prisma.tpedido.findFirst({
      where: {
        usuario: cartData.usuario,
        inventario: cartData.inventario
      }
    });

    let item;
    let action = "agregar_carrito";

    if (existing) {
      item = await prisma.tpedido.update({
        where: { id: existing.id },
        data: {
          cantidad: existing.cantidad + cartData.cantidad,
          subtotal: Number(existing.subtotal) + cartData.subtotal
        }
      });
      action = "actualizar_carrito";
    } else {
      try {
        item = await CommerceRepository.create(cartData);
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        await resetCartSequence();
        item = await CommerceRepository.create(cartData);
      }
    }

    await writeActivityLog(null, {
      usuario: userId,
      modulo: "carrito",
      accion: action,
      descripcion: `Se agregó inventario #${inventarioId} al carrito.`,
      entidad: "tpedido",
      entidadId: item.id,
      nivel: "info",
      ip: requestIp,
      metadata: { inventarioId, cantidad, subtotal, acumulado: Boolean(existing) },
    });

    return item;
  }

  async getCart(userId) {
    const cart = await CommerceRepository.getCartByUser(userId);
    return cart.map((item) => this.formatCartItem(item));
  }

  async updateCartItem(id, payload) {
    return await prisma.tpedido.update({
      where: { id: Number(id) },
      data: {
        cantidad: Number(payload.cantidad),
        subtotal: parseFloat(payload.subtotal)
      }
    });
  }

  async deleteCartItem(id) {
    return await prisma.tpedido.delete({
      where: { id: Number(id) }
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

  async deleteWishlistItem(id) {
    return await prisma.tlista.delete({
      where: { id: Number(id) }
    });
  }

  async removeInventoryFromWishlist(userId, inventarioId) {
    return await CommerceRepository.removeFromWishlist(userId, inventarioId);
  }

  // Transacción de Compra (Procesar Compra)
  async processPurchase(userId, purchaseData, requestIp) {
    const { metodo = "efectivo", referencia = null, direccionEntrega = {} } = purchaseData;

    return await prisma.$transaction(async (tx) => {
      // 1. Obtener items del carrito con bloqueo
      const cartItems = await tx.tpedido.findMany({
        where: { usuario: Number(userId) },
        include: {
          tinventario: { include: { tproductos: true, tsucursales: true } }
        }
      });

      if (cartItems.length === 0) throw new Error("El carrito está vacío.");

      // 2. Validar stock
      for (const item of cartItems) {
        if (item.cantidad > item.tinventario.cantidad) {
          throw new Error(`No hay stock suficiente para ${item.tinventario.tproductos.nombre}.`);
        }
      }

      const user = await tx.tusuarios.findUnique({
        where: { id: Number(userId) },
        select: {
          nombre: true,
          telefono: true,
          correo: true,
          domicilio: true,
          ciudad: true,
          estadoDireccion: true,
          codigoPostal: true,
          referenciasDomicilio: true,
          latitud: true,
          longitud: true
        }
      });

      if (!user) throw new Error("Usuario no encontrado.");

      // 3. Calcular totales
      const subtotal = cartItems.reduce((sum, item) => sum + Number(item.subtotal), 0);
      const iva = Number((subtotal * 0.16).toFixed(2));
      const envio = 50;
      const total = Number((subtotal + iva + envio).toFixed(2));
      const normalizedDeliveryAddress = normalizeDeliveryAddressSnapshot(direccionEntrega, user);
      const deliveryRoute = buildDeliveryRoute(cartItems, normalizedDeliveryAddress);
      const enrichedDeliveryAddress = deliveryRoute
        ? { ...normalizedDeliveryAddress, rutaEntrega: deliveryRoute }
        : normalizedDeliveryAddress;

      // 4. Crear Pago
      const payment = await tx.tpagos.create({
        data: {
          usuario: Number(userId),
          metodo: String(metodo).toLowerCase(),
          estado: "pagado",
          referencia,
          subtotal,
          iva,
          envio,
          total,
          direccionEntrega: enrichedDeliveryAddress,
          metadata: { productos: cartItems.length, origen: "MVC_Service", rutaEntrega: deliveryRoute }
        }
      });

      // 5. Crear Ventas y Actualizar Inventario
      for (const item of cartItems) {
        await tx.tventas.create({
          data: {
            usuario: Number(userId),
            pago: payment.id,
            producto: item.tinventario.producto,
            cantidad: item.cantidad,
            total: item.subtotal
          }
        });

        const newStock = item.tinventario.cantidad - item.cantidad;
        await tx.tinventario.update({
          where: { id: item.inventario },
          data: { cantidad: newStock }
        });

        // Logs de stock bajo (fuera de la transacción principal o asíncronos)
        if (newStock <= 5) {
          // Log de advertencia
        }
      }

      // 6. Vaciar carrito
      await tx.tpedido.deleteMany({ where: { usuario: Number(userId) } });

      return { paymentId: payment.id, total };
    });
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
    const validStatuses = ['preparando', 'listo', 'enviado', 'entregado', 'cancelado'];
    if (!validStatuses.includes(status)) throw new Error("Estado de entrega no válido.");

    const existing = await prisma.tpagos.findUnique({ where: { id: Number(pagoId) } });
    if (!existing) throw new Error("Pedido no encontrado.");

    validateDeliveryStatusTransition({
      existing,
      nextStatus: status,
      actorId,
      actorRole,
    });

    const updated = await prisma.tpagos.update({
      where: { id: Number(pagoId) },
      data: { estadoEntrega: status }
    });

    await writeActivityLog(null, {
      usuario: actorId,
      modulo: "logistica",
      accion: "actualizar_estado",
      descripcion: `Pedido #${pagoId} cambiado a estado: ${status}.`,
      entidad: "tpagos",
      entidadId: Number(pagoId),
      nivel: "info",
      ip: requestIp,
      metadata: { anterior: existing.estadoEntrega, nuevo: status }
    });

    return updated;
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

  async assignDelivery(pagoId, repartidorId, requestIp) {
    const pedido = await prisma.tpagos.findUnique({ where: { id: Number(pagoId) } });
    if (!pedido) throw new Error("Pedido no encontrado.");
    if (pedido.repartidorId) throw new Error("Este pedido ya tiene un repartidor asignado.");
    if (pedido.estadoEntrega !== 'listo') {
      throw new Error("El pedido debe estar listo para poder asignarlo a reparto.");
    }

    const updated = await prisma.tpagos.update({
      where: { id: Number(pagoId) },
      data: {
        repartidorId: Number(repartidorId),
        estadoEntrega: 'enviado'
      }
    });

    await writeActivityLog(null, {
      usuario: repartidorId,
      modulo: "logistica",
      accion: "asignar_repartidor",
      descripcion: `Repartidor #${repartidorId} se asignó el pedido #${pagoId}.`,
      entidad: "tpagos",
      entidadId: Number(pagoId),
      nivel: "info",
      ip: requestIp,
    });

    return updated;
  }
}

module.exports = new CommerceService();
