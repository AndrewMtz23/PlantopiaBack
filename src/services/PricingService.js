const Decimal = require('decimal.js');
const AppError = require('../utils/AppError');
const MAX = new Decimal('9999999999.99');
function quantity(value) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0 || value > 2147483647) {
    throw new AppError(400, 'INVALID_QUANTITY', 'La cantidad debe ser un entero positivo.');
  }
  return value;
}
function money(value) {
  let amount;
  try { amount = new Decimal(value); } catch { throw new AppError(400, 'INVALID_PRICE', 'Importe invalido.'); }
  if (!amount.isFinite() || amount.isNegative() || amount.gt(MAX)) throw new AppError(400, 'INVALID_PRICE', 'Importe fuera de rango.');
  return amount;
}
function calculateTotals(items, { taxRate = '0.16', shipping = '50.00' } = {}) {
  const subtotal = money(items.reduce((sum, item) => sum.plus(money(item.unitPrice).times(quantity(item.quantity))), new Decimal(0))).toDecimalPlaces(2);
  const iva = money(subtotal.times(money(taxRate))).toDecimalPlaces(2);
  const envio = money(shipping).toDecimalPlaces(2);
  const total = money(subtotal.plus(iva).plus(envio));
  return Object.fromEntries(Object.entries({ subtotal, iva, envio, total }).map(([k,v]) => [k, v.toFixed(2)]));
}
module.exports = { calculateTotals, quantity, money };
