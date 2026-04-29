const BaseRepository = require('./BaseRepository');

class PaymentRepository extends BaseRepository {
  constructor() {
    super('tpagos');
  }

  async findByReference(reference) {
    return await this.findOne({
      where: { referencia: reference }
    });
  }

  async getPaymentsByUser(userId) {
    return await this.findAll({
      where: { usuario: Number(userId) },
      orderBy: { id: 'desc' }
    });
  }
}

module.exports = new PaymentRepository();
