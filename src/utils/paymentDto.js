function customerSale(sale) {
  const product = sale.tproductos || {};
  return {
    id: sale.id, producto: sale.producto, cantidad: sale.cantidad, total: sale.total,
    fechaRegistro: sale.fechaRegistro, precioUnitario: sale.precioUnitario,
    nombre: product.nombre, detalles: product.detalles, categoria: product.categoria,
    imagen: product.imagen, imagenUrl: product.imagenUrl,
    precioVenta: sale.precioUnitario || product.precioVenta,
  };
}
function customerPayment(payment) {
  return {
    id: payment.id, metodo: payment.metodo, estado: payment.estado, referencia: payment.referencia,
    subtotal: payment.subtotal, iva: payment.iva, envio: payment.envio, total: payment.total,
    direccionEntrega: payment.direccionEntrega, estadoEntrega: payment.estadoEntrega,
    fechaEstimadaEntrega: payment.fechaEstimadaEntrega, guiaEntrega: payment.guiaEntrega,
    fechaRegistro: payment.fechaRegistro, fechaActualizacion: payment.fechaActualizacion,
    usuario_nombre: payment.usuario_nombre, usuario_correo: payment.usuario_correo,
    usuario_telefono: payment.usuario_telefono, usuario_domicilio: payment.usuario_domicilio,
    productos: payment.tventas?.length,
    unidades: payment.tventas?.reduce((sum, item) => sum + item.cantidad, 0),
    tventas: payment.tventas?.map(customerSale),
  };
}
module.exports = { customerSale, customerPayment };
