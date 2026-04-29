const BaseRepository = require('./BaseRepository');

class ProductRepository extends BaseRepository {
  constructor() {
    super('tproductos');
  }

  async findByEstatus(estatus) {
    return await this.findAll({
      where: { estatus: Number(estatus) },
      include: {
        tinventario: true
      }
    });
  }

  async findAllWithInventory() {
    return await this.findAll({
      include: {
        tinventario: true
      }
    });
  }
}

module.exports = new ProductRepository();
