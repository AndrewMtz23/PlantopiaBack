const BaseRepository = require('./BaseRepository');
const prisma = require('../config/prisma');

class CommerceRepository extends BaseRepository {
  constructor() {
    super('tpedido'); // Por defecto para el carrito
  }

  // Carrito (tpedido)
  async getCartByUser(userId) {
    return await prisma.tpedido.findMany({
      where: { usuario: Number(userId) },
      include: {
        tinventario: {
          include: {
            tproductos: true,
            tsucursales: true
          }
        },
        tusuarios: true
      }
    });
  }

  async clearCart(userId) {
    return await prisma.tpedido.deleteMany({
      where: { usuario: Number(userId) }
    });
  }

  // Lista de deseos (tlista)
  async addToWishlist(userId, inventarioId) {
    return await prisma.tlista.create({
      data: {
        usuario: Number(userId),
        inventario: Number(inventarioId)
      }
    });
  }

  async getWishlistByUser(userId) {
    return await prisma.tlista.findMany({
      where: { usuario: Number(userId) },
      include: {
        tinventario: {
          include: {
            tproductos: true,
            tsucursales: true
          }
        }
      }
    });
  }

  async removeFromWishlist(userId, inventarioId) {
    return await prisma.tlista.deleteMany({
      where: {
        usuario: Number(userId),
        inventario: Number(inventarioId)
      }
    });
  }

  // Ventas (tventas)
  async createSale(data) {
    return await prisma.tventas.create({
      data: {
        ...data,
        usuario: Number(data.usuario),
        producto: Number(data.producto),
        pago: data.pago ? Number(data.pago) : null
      }
    });
  }

  async getSalesByUser(userId) {
    return await prisma.tventas.findMany({
      where: { usuario: Number(userId) },
      include: {
        tproductos: true
      }
    });
  }
}

module.exports = new CommerceRepository();
