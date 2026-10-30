const Decimal = require('decimal.js');
const moneyFields = new Set(['subtotal', 'iva', 'envio', 'total', 'precioCompra', 'precioVenta', 'precioUnitario', 'costoUnitario']);
const jsonFields = new Set(['metadata', 'direccionEntrega']);
function normalizeRow(table, row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (value === null || value === undefined) return [key, null];
    if (jsonFields.has(key) && typeof value === 'string') value = JSON.parse(value);
    if (moneyFields.has(key)) {
      const amount = new Decimal(String(value));
      if (!amount.isFinite() || amount.isNegative() || amount.gt('9999999999.99') || !amount.eq(amount.toDecimalPlaces(2))) {
        throw new Error(`Monetary precision/range requires reconciliation: ${table}.${key}, ID ${row.id}`);
      }
      value = amount.toFixed(2);
    }
    if (key === 'latitud' || key === 'longitud') value = new Decimal(String(value)).toString();
    if (value instanceof Date) value = value.toISOString();
    if (table === 'tusuarios' && key === 'correo') value = String(value).trim().toLowerCase();
    return [key, value];
  }));
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
function compareRows(table, source, target) {
  const targets = new Map(target.map(row => [row.id, normalizeRow(table, row)]));
  const differences = [];
  for (const row of source) {
    const expected = normalizeRow(table, row), actual = targets.get(row.id);
    if (!actual) differences.push({ id: row.id, kind: 'missing' });
    else for (const key of Object.keys(expected)) {
      if (JSON.stringify(stable(expected[key])) !== JSON.stringify(stable(actual[key]))) differences.push({ id: row.id, field: key, kind: 'different' });
    }
    targets.delete(row.id);
  }
  for (const id of targets.keys()) differences.push({ id, kind: 'extra' });
  return differences;
}
module.exports = { normalizeRow, compareRows };
