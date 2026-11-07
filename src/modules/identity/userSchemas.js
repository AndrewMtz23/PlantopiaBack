const { object, text, id, invalid } = require('../../shared/http/validate');
const profileFields = ['nombre', 'fechaNacimiento', 'genero', 'telefono', 'correo', 'domicilio', 'ciudad', 'estadoDireccion', 'codigoPostal', 'referenciasDomicilio', 'latitud', 'longitud'];
function userSchema(value, { admin = false, create = false } = {}) {
  object(value, [...profileFields, ...(admin ? ['id', 'tipo', 'estatus'] : []), ...(admin || create ? ['clave'] : [])]);
  const out = { ...value };
  const limits = { nombre: [3, 45], fechaNacimiento: [10, 10], genero: [1, 20], domicilio: [8, 450], ciudad: [0, 120], estadoDireccion: [0, 120], codigoPostal: [0, 5], referenciasDomicilio: [0, 500] };
  for (const [field, [min, max]] of Object.entries(limits)) out[field] = text(value[field], field, min, max, min === 0);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.fechaNacimiento) || Number.isNaN(Date.parse(out.fechaNacimiento))) invalid('fechaNacimiento');
  out.telefono = text(value.telefono, 'telefono', 10, 30);
  if (!/^[0-9 ()-]+$/.test(out.telefono)) invalid('telefono');
  out.telefono = out.telefono.replace(/[ ()-]/g, '');
  if (!/^\d{10}$/.test(out.telefono)) invalid('telefono');
  out.correo = text(value.correo, 'correo', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.correo)) invalid('correo');
  if (out.codigoPostal && !/^\d{5}$/.test(out.codigoPostal)) invalid('codigoPostal');
  for (const [field, bound] of [['latitud', 90], ['longitud', 180]]) {
    if (value[field] !== undefined && value[field] !== null && value[field] !== '') {
      if (!['number', 'string'].includes(typeof value[field]) || !Number.isFinite(Number(value[field])) || Math.abs(Number(value[field])) > bound) invalid(field);
    }
  }
  if (value.id !== undefined) out.id = id(value.id);
  if (admin) {
    if (value.tipo !== undefined && !['1', '2', '3', '4'].includes(String(value.tipo))) invalid('tipo');
    if (value.estatus !== undefined && !['0', '1'].includes(String(value.estatus))) invalid('estatus');
  }
  if (create || value.clave) {
    if (typeof value.clave !== 'string' || value.clave.length < 8 || Buffer.byteLength(value.clave) > 72) invalid('clave');
  }
  return out;
}
function loginSchema(value) {
  object(value, ['correo', 'clave']);
  const correo = text(value.correo, 'correo', 3, 254).toLowerCase();
  const clave = text(value.clave, 'clave', 1, 72);
  return { correo, clave: value.clave };
}
module.exports = { userSchema, loginSchema };
