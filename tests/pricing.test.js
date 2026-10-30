const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateTotals } = require('../src/services/PricingService');
test('rounds monetary amounts using decimal arithmetic', () => {
  assert.deepEqual(calculateTotals([{ quantity: 3, unitPrice: '0.10' }]), { subtotal: '0.30', iva: '0.05', envio: '50.00', total: '50.35' });
});
test('rejects invalid quantities and price overflow', () => {
  for (const quantity of [-1, 0, 1.5, null, 'bad', Infinity]) assert.throws(() => calculateTotals([{ quantity, unitPrice: '1.00' }]));
  for (const unitPrice of ['-1', 'NaN', 'Infinity', '10000000000']) assert.throws(() => calculateTotals([{ quantity: 1, unitPrice }]));
});
