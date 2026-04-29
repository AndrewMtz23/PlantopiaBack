const BaseRepository = require('./BaseRepository');

class InventoryRepository extends BaseRepository {
  constructor() {
    super('tinventario');
  }

  async findByBranch(sucursalId) {
    return await this.findAll({
      where: { sucursal: Number(sucursalId) },
      include: {
        tproductos: true,
        tproveedores: true,
        tsucursales: true
      }
    });
  }

  async findByProductAndBranch(productoId, sucursalId) {
    return await this.findOne({
      where: {
        producto: Number(productoId),
        sucursal: Number(sucursalId)
      }
    });
  }
}

module.exports = new InventoryRepository();
