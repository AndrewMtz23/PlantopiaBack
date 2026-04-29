const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const CommerceService = require('../services/CommerceService');

const createPaymentRoutes = (db) => {
  const router = express.Router();

  const buildPaymentDetail = async (prisma, pagoId, userId = null) => {
    const where = { id: Number(pagoId) };
    if (userId) where.usuario = Number(userId);

    const pago = await prisma.tpagos.findFirst({ where });
    if (!pago) return null;

    const [usuario, ventas] = await Promise.all([
      prisma.tusuarios.findUnique({ where: { id: Number(pago.usuario) } }),
      prisma.tventas.findMany({
        where: { pago: Number(pago.id) },
        include: { tproductos: true },
        orderBy: { id: 'asc' }
      })
    ]);

    const pagoPlano = {
      ...pago,
      usuario_nombre: usuario?.nombre,
      usuario_correo: usuario?.correo,
      usuario_telefono: usuario?.telefono,
      usuario_domicilio: usuario?.domicilio,
    };

    const items = ventas.map((venta) => ({
      ...venta,
      nombre: venta.tproductos?.nombre,
      detalles: venta.tproductos?.detalles,
      categoria: venta.tproductos?.categoria,
      imagen: venta.tproductos?.imagen,
      imagenUrl: venta.tproductos?.imagenUrl,
      precioVenta: venta.tproductos?.precioVenta,
    }));

    return { pago: pagoPlano, items };
  };

  router.get('/verPagos', authenticateToken, requireAdmin, async (req, res) => {
    const prisma = require('../config/prisma');
    try {
      const pagos = await prisma.tpagos.findMany({ orderBy: { fechaRegistro: 'desc' } });
      const enriched = await CommerceService.attachPaymentRelations(pagos, { includeSales: true });
      res.json(enriched.map((pago) => ({
        ...pago,
        usuario_nombre: pago.tusuarios?.nombre,
        usuario_correo: pago.tusuarios?.correo,
        productos: pago.tventas?.length || 0,
        unidades: (pago.tventas || []).reduce((sum, item) => sum + Number(item.cantidad || 0), 0),
      })));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/verPago/:id(\\d+)', authenticateToken, requireAdmin, async (req, res) => {
    const prisma = require('../config/prisma');
    try {
      const detail = await buildPaymentDetail(prisma, req.params.id);
      if (!detail) return res.status(404).json({ error: 'Pago no encontrado' });
      res.json(detail);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/misPagos/:usuario(\\d+)', authenticateToken, async (req, res) => {
    const prisma = require('../config/prisma');
    try {
      const pagos = await prisma.tpagos.findMany({
        where: { usuario: Number(req.params.usuario) },
        orderBy: { fechaRegistro: 'desc' }
      });
      const enriched = await CommerceService.attachPaymentRelations(pagos, { includeSales: true });
      res.json(enriched.map((pago) => ({
        ...pago,
        productos: pago.tventas?.length || 0,
        unidades: (pago.tventas || []).reduce((sum, item) => sum + Number(item.cantidad || 0), 0),
      })));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/miPago/:usuario(\\d+)/:id(\\d+)', authenticateToken, async (req, res) => {
    const prisma = require('../config/prisma');
    try {
      const detail = await buildPaymentDetail(prisma, req.params.id, req.params.usuario);
      if (!detail) return res.status(404).json({ error: 'Pago no encontrado' });
      res.json(detail);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.put('/actualizarSeguimientoPago/:id(\\d+)', authenticateToken, requireAdmin, async (req, res) => {
    const prisma = require('../config/prisma');
    try {
      const { estadoEntrega, fechaEstimadaEntrega, guiaEntrega, notasEntrega } = req.body;
      const seguimiento = await prisma.tpagos.update({
        where: { id: Number(req.params.id) },
        data: {
          estadoEntrega,
          fechaEstimadaEntrega: fechaEstimadaEntrega ? new Date(`${fechaEstimadaEntrega}T00:00:00`) : null,
          guiaEntrega: guiaEntrega || null,
          notasEntrega: notasEntrega || null,
          fechaActualizacion: new Date(),
        }
      });
      res.json({ seguimiento });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};

module.exports = createPaymentRoutes;
