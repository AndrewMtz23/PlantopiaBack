const prisma = require('../../config/prisma');
const AppError = require('../../utils/AppError');
async function withTransaction(work, { client = prisma } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await client.$transaction(work, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 15000 }); }
    catch (error) {
      if (error.code !== 'P2034') throw error;
      if (attempt === 2) throw new AppError(409, 'CONCURRENT_CHANGE', 'La operacion cambio. Intenta de nuevo.');
    }
  }
}
module.exports = { withTransaction };
