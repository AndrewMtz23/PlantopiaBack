const BaseRepository = require('./BaseRepository');

class CategoryRepository extends BaseRepository {
  constructor() {
    super('tcategorias');
  }

  async findBySlug(slug) {
    return await this.findOne({
      where: { slug }
    });
  }

  async findAllActive() {
    return await this.findAll({
      where: { isActive: 1 },
      orderBy: { nombre: 'asc' }
    });
  }
}

module.exports = new CategoryRepository();
