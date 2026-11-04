const AppError = require('./errors');
function invalid(field, message = 'Valor invalido.') { throw new AppError(400, 'INVALID_INPUT', 'Revisa los datos enviados.', { [field]: message }); }
function object(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('body');
  for (const key of Object.keys(value)) if (!allowed.includes(key)) invalid(key, 'Campo no permitido.');
  return value;
}
function text(value, field, min, max, optional = false) {
  if (optional && (value === undefined || value === null || value === '')) return '';
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) invalid(field);
  return value.trim();
}
function id(value, field = 'id') {
  if (!['number', 'string'].includes(typeof value) || !/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > 2147483647) invalid(field);
  return Number(value);
}
const validate = (schema, source = 'body') => (req, res, next) => {
  try { req[source] = schema(req[source]); next(); } catch (error) { next(error); }
};
const validateIdParam = (req, res, next, value, name) => { try { id(value, name); next(); } catch (error) { next(error); } };
module.exports = { validate, validateIdParam, object, text, id, invalid };
