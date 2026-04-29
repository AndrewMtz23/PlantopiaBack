const BaseRepository = require('./BaseRepository');

class BranchRepository extends BaseRepository {
  constructor() {
    super('tsucursales');
  }

  async findAllActive() {
    return await this.findAll({
      where: { estatus: 1 }
    });
  }
}

module.exports = new BranchRepository();
