// Test-only role fixtures. Never seeds application accounts or shared passwords.
require('dotenv').config();
const { prisma, fixtures } = require('../tests/helpers/fixtures');
fixtures().then(() => console.log('Synthetic role fixtures created in the isolated test database.'))
  .catch(() => { console.error('Fixture creation failed.'); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
