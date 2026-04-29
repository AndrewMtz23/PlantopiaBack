const BaseRepository = require('./BaseRepository');

class ProviderRepository extends BaseRepository {
  constructor() {
    super('tproveedores');
  }

  async findAllActive() {
    return await this.findAll({
      where: { estatus: 1 }
    });
  }
}

module.exports = new ProviderRepository();
