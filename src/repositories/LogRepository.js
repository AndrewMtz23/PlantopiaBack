const BaseRepository = require('./BaseRepository');

class LogRepository extends BaseRepository {
  constructor() {
    super('tlogs');
  }

  async getRecentLogs(limit = 10) {
    return await this.findAll({
      take: limit,
      orderBy: { fechaRegistro: 'desc' },
      include: {
        tusuarios: {
          select: { nombre: true }
        }
      }
    });
  }
}

module.exports = new LogRepository();
