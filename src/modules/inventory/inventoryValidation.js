const AppError = require('../../utils/AppError');
function integer(value, name, min = 0) {
  if (typeof value === 'string' && /^\d+$/.test(value)) value = Number(value);
  if (!Number.isInteger(value) || value < min || value > 2147483647) throw new AppError(400, 'INVALID_INPUT', `${name} debe ser un entero valido.`);
  return value;
}
function reason(value) {
  if (typeof value !== 'string' || value.trim().length < 5 || value.trim().length > 250) throw new AppError(400, 'INVALID_INPUT', 'El motivo debe tener entre 5 y 250 caracteres.');
  return value.trim();
}
module.exports = { integer, reason };
