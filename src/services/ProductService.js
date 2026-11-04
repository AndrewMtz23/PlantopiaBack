const AppError = require('../utils/AppError');
const { productSchema } = require('../modules/catalog/productSchemas');
const ProductRepository = require('../repositories/ProductRepository');
const InventoryRepository = require('../repositories/InventoryRepository');
const prisma = require('../config/prisma');
const path = require('path');
const fs = require('fs/promises');
const { storeProductImages, toPublicUploadPath } = require('../utils/imageStorage');
const { writeActivityLog } = require('../utils/activityLog');

class ProductService {
  formatCatalogItem(inventory) {
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
      nombre: product.nombre,
      detalles: product.detalles,
      categoria: product.categoria,
      precioVenta: product.precioVenta,
      imagen: product.imagen,
      imagenUrl: product.imagenUrl,
    };
  }

  async createProduct(payload, requestIp, adminId) {
    payload = productSchema(payload, { create: true });
    const { estatus, nombre, detalles, categoria, precioCompra, precioVenta, imagen, imagenUrl } = payload;

    if (!nombre) throw new AppError(400, 'INVALID_INPUT', 'El nombre del producto es obligatorio.');

    const product = await ProductRepository.create({
      estatus: Number(estatus) || 1,
      nombre,
      detalles: detalles || '',
      categoria,
      precioCompra: precioCompra,
      precioVenta: precioVenta,
      imagen: imagen || '',
      imagenUrl: imagenUrl || null
    });

    await writeActivityLog(null, {
      usuario: adminId,
      modulo: "productos",
      accion: "crear_producto",
      descripcion: `Se creó el producto ${nombre}.`,
      entidad: "tproductos",
      entidadId: product.id,
      nivel: "info",
      ip: requestIp,
    });

    return product;
  }

  async getAllProducts() {
    return require('../modules/catalog/listService').smallLegacyList('products');
  }

  async getAllInventory() {
    return require('../modules/catalog/listService').smallLegacyList('inventory');
  }

  async createInventory(payload, requestIp, adminId) {
    return require('../modules/inventory/inventoryService').createInventory(payload, adminId);
  }

  async updateInventory(id, payload, requestIp, adminId) {
    return require('../modules/inventory/inventoryService').editInventory(id, payload, adminId);
  }

  async deactivateInventory(id, requestIp, adminId) {
    return require('../modules/inventory/inventoryService').deactivateInventory(id, adminId);
  }

  async storeSingleProductImage(file) {
    if (!file) throw new AppError(400, 'INVALID_IMAGE', 'No se recibio imagen.');
    const stored = await require('../infrastructure/storage/imageStore').validateAndStoreImage(file, { ownerType: 'product' });
    file.committed = true;
    const imagePath = `/uploads/${stored.key}`;
    return { ok: true, imagePath, url: imagePath };
  }

  async storeProductGallery(productId, files = []) {
    const product = await ProductRepository.findById(productId);
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Producto no encontrado.');
    try {
      const stored = await storeProductImages({ files });
      const created = await require('../infrastructure/db/transaction').withTransaction(async tx => {
        const rows = [];
        for (const [index, image] of stored.entries()) rows.push(await tx.tproducto_imagenes.create({ data: { producto: product.id, ...image, esPrincipal: index === 0 ? 1 : 0 } }));
        return rows;
      });
      files.forEach(file => { file.committed = true; });
      return created;
    } catch (error) { await require('../infrastructure/storage/imageStore').compensate(files); throw error; }
  }

  async getCatalogProducts() {
    return require('../modules/catalog/listService').smallLegacyList('catalog');
  }

  async getCatalogProductByInventoryId(inventoryId) {
    const id = Number(inventoryId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError(400, 'INVALID_INPUT', 'Id de inventario inválido.');
    }

    const inventory = await prisma.tinventario.findUnique({
      where: { id },
      include: {
        tproductos: {
          include: {
            tinventario: {
              include: { tsucursales: true },
              where: { estatus: 1 }
            }
          }
        },
        tsucursales: true
      }
    });

    if (!inventory || !inventory.tproductos) throw new AppError(404, 'NOT_FOUND', 'Producto no encontrado.');

    const product = this.formatCatalogItem(inventory);
    product.disponibilidad = inventory.tproductos.tinventario.map((item) => ({
      id: item.id,
      sucursal: item.sucursal,
      sucursal_nombre: item.tsucursales?.nombre,
      cantidad: item.cantidad
    }));

    return product;
  }

  async getProductById(id) {
    const productId = Number(id);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new AppError(400, 'INVALID_INPUT', 'Id de producto inválido.');
    }

    const product = await ProductRepository.findById(id, {
      include: { tinventario: true }
    });
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Producto no encontrado.');
    return product;
  }

  async updateProduct(id, payload, requestIp, adminId) {
    payload = productSchema(payload);
    const productId = Number(id);
    const existing = await ProductRepository.findById(productId);
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Producto no encontrado.');

    const updated = await ProductRepository.update(productId, {
      ...payload,
      estatus: payload.estatus !== undefined ? Number(payload.estatus) : existing.estatus,
      precioCompra: payload.precioCompra !== undefined ? payload.precioCompra : existing.precioCompra,
      precioVenta: payload.precioVenta !== undefined ? payload.precioVenta : existing.precioVenta
    });

    await writeActivityLog(null, {
      usuario: adminId,
      modulo: "productos",
      accion: "actualizar_producto",
      descripcion: `Se actualizó el producto ${existing.nombre}.`,
      entidad: "tproductos",
      entidadId: productId,
      nivel: "info",
      ip: requestIp,
    });

    return updated;
  }

  async deactivateProduct(id, requestIp, adminId) {
    const productId = Number(id);
    const existing = await ProductRepository.findById(productId);
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Producto no encontrado.');

    const updated = await ProductRepository.update(productId, { estatus: 0 });

    await writeActivityLog(null, {
      usuario: adminId,
      modulo: "productos",
      accion: "desactivar_producto",
      descripcion: `Se desactivó el producto ${existing.nombre}.`,
      entidad: "tproductos",
      entidadId: productId,
      nivel: "info",
      ip: requestIp,
    });

    return updated;
  }

  async updateProductFromLegacyPayload(payload, requestIp, adminId) {
    if (!payload.id) throw new AppError(400, 'INVALID_INPUT', 'El id del producto es obligatorio.');
    return this.updateProduct(payload.id, payload, requestIp, adminId);
  }

  // Lógica de Inventario
  async updateStock(payload, requestIp, adminId) {
    const { integer } = require('../modules/inventory/inventoryValidation');
    const inventory = await InventoryRepository.findByProductAndBranch(integer(payload.productoId, 'producto', 1), integer(payload.sucursalId, 'sucursal', 1));
    if (!inventory) throw new (require('../utils/AppError'))(404, 'NOT_FOUND', 'Crea el inventario antes de ajustar existencias.');
    return require('../modules/inventory/inventoryService').adjustStock({ inventoryId: inventory.id, operation: payload.operacion, quantity: payload.cantidad, expectedVersion: payload.expectedVersion, reason: payload.reason, actorId: adminId });
  }
}

module.exports = new ProductService();
