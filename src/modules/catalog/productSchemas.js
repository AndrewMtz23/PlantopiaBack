const { object, text, id, invalid } = require('../../shared/http/validate');
function productSchema(value, { create = false } = {}) {
  object(value, ['id', 'estatus', 'nombre', 'detalles', 'categoria', 'precioCompra', 'precioVenta', 'imagen', 'imagenUrl']);
  const out = {};
  if (value.id !== undefined) id(value.id);
  for (const [field, max] of [['nombre', 45], ['detalles', 450], ['categoria', 45], ['imagen', 450], ['imagenUrl', 500]]) {
    if (value[field] !== undefined || (create && ['nombre', 'categoria'].includes(field))) out[field] = text(value[field], field, ['nombre', 'categoria'].includes(field) ? 1 : 0, max, !['nombre', 'categoria'].includes(field));
  }
  for (const field of ['precioCompra', 'precioVenta']) {
    if (value[field] !== undefined || create) {
      if (!['number', 'string'].includes(typeof value[field]) || !/^\d{1,10}(\.\d{1,2})?$/.test(String(value[field]))) invalid(field);
      out[field] = String(value[field]);
    }
  }
  if (value.estatus !== undefined) { if (!['0', '1'].includes(String(value.estatus))) invalid('estatus'); out.estatus = Number(value.estatus); }
  return out;
}
module.exports = { productSchema };
