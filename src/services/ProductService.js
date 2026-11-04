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
    const { estatus, nombre, detalles, categoria, precioCompra, precioVenta, imagen, imagenUrl } = payload;

    if (!nombre) throw new Error('El nombre del producto es obligatorio.');

    const product = await ProductRepository.create({
      estatus: Number(estatus) || 1,
      nombre,
      detalles: detalles || '',
      categoria,
      precioCompra: parseFloat(precioCompra) || 0,
      precioVenta: parseFloat(precioVenta) || 0,
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
    return await ProductRepository.findAllWithInventory();
  }

  async getAllInventory() {
    return await InventoryRepository.findAll({
      orderBy: { id: 'asc' },
      include: {
        tproductos: true,
        tproveedores: true,
        tsucursales: true
      }
    });
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
    if (!file) throw new Error('No se recibio imagen.');

    const publicImagesDir = path.join(__dirname, '../../public/images');
    await fs.mkdir(publicImagesDir, { recursive: true });
    const extension = path.extname(file.originalname || file.path).toLowerCase() || '.jpg';
    const finalPath = path.join(publicImagesDir, `upload-${Date.now()}${extension}`);
    await fs.rename(file.path, finalPath);

    return {
      ok: true,
      imagePath: `/images/${path.basename(finalPath)}`,
      url: `/images/${path.basename(finalPath)}`
    };
  }

  async storeProductGallery(productId, files = []) {
    const product = await ProductRepository.findById(productId);
    if (!product) throw new Error('Producto no encontrado.');

    const storedImages = await storeProductImages({
      productId: product.id,
      name: product.nombre,
      files
    });

    const created = [];
    for (const [index, image] of storedImages.entries()) {
      const record = await prisma.tproducto_imagenes.create({
        data: {
          producto: product.id,
          ruta: image.ruta,
          nombreOriginal: image.nombreOriginal,
          orden: image.orden,
          esPrincipal: index === 0 ? 1 : 0
        }
      });
      created.push(record);
    }

    return created;
  }

  async getCatalogProducts() {
    const inventory = await prisma.tinventario.findMany({
      where: {
        estatus: 1,
        cantidad: { gt: 0 },
        tproductos: { estatus: 1 }
      },
      include: {
        tproductos: true,
        tsucursales: true
      },
      orderBy: { id: 'asc' }
    });

    return inventory.map((item) => this.formatCatalogItem(item));
  }

  async getCatalogProductByInventoryId(inventoryId) {
    const id = Number(inventoryId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('Id de inventario inválido.');
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

    if (!inventory || !inventory.tproductos) throw new Error('Producto no encontrado.');

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
      throw new Error('Id de producto inválido.');
    }

    const product = await ProductRepository.findById(id, {
      include: { tinventario: true }
    });
    if (!product) throw new Error('Producto no encontrado.');
    return product;
  }

  async updateProduct(id, payload, requestIp, adminId) {
    const productId = Number(id);
    const existing = await ProductRepository.findById(productId);
    if (!existing) throw new Error('Producto no encontrado.');

    const updated = await ProductRepository.update(productId, {
      ...payload,
      estatus: payload.estatus !== undefined ? Number(payload.estatus) : existing.estatus,
      precioCompra: payload.precioCompra !== undefined ? parseFloat(payload.precioCompra) : existing.precioCompra,
      precioVenta: payload.precioVenta !== undefined ? parseFloat(payload.precioVenta) : existing.precioVenta
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
    if (!existing) throw new Error('Producto no encontrado.');

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
    if (!payload.id) throw new Error('El id del producto es obligatorio.');
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
