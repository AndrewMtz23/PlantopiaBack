const prisma = require('../config/prisma');

/**
 * BaseRepository
 * Implementa el patrón Repository para aislar la lógica de acceso a datos (Prisma).
 * Provee métodos CRUD genéricos para cualquier modelo.
 */
class BaseRepository {
  /**
   * @param {string} modelName - El nombre del modelo en Prisma (ej. 'tusuarios')
   */
  constructor(modelName) {
    if (!prisma[modelName]) {
      throw new Error(`El modelo ${modelName} no existe en PrismaClient.`);
    }
    this.model = prisma[modelName];
  }

  async findAll(options = {}) {
    return await this.model.findMany(options);
  }

  async findById(id, options = {}) {
    return await this.model.findUnique({
      where: { id: Number(id) },
      ...options,
    });
  }

  async findOne(options = {}) {
    return await this.model.findFirst(options);
  }

  async create(data) {
    return await this.model.create({
      data,
    });
  }

  async update(id, data) {
    return await this.model.update({
      where: { id: Number(id) },
      data,
    });
  }

  async delete(id) {
    return await this.model.delete({
      where: { id: Number(id) },
    });
  }

  async count(options = {}) {
    return await this.model.count(options);
  }
}

module.exports = BaseRepository;
