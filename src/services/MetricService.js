const prisma = require('../config/prisma');

class MetricService {
  async attachUsers(records, userIdField = 'usuario') {
    const userIds = [
      ...new Set(records.map((record) => record[userIdField]).filter(Boolean).map(Number))
    ];

    if (!userIds.length) {
      return records.map((record) => ({ ...record, tusuarios: null, usuario_nombre: null }));
    }

    const users = await prisma.tusuarios.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nombre: true, correo: true, telefono: true }
    });
    const usersById = new Map(users.map((user) => [user.id, user]));

    return records.map((record) => {
      const user = usersById.get(Number(record[userIdField])) || null;
      return {
        ...record,
        tusuarios: user,
        usuario_nombre: user?.nombre || null
      };
    });
  }

  async getDashboardSummary() {
    const LOW_STOCK_THRESHOLD = 5;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Usamos Promise.all para ejecutar múltiples consultas de conteo y sumas
    const [
      usuariosActivos,
      productosActivos,
      sucursalesActivas,
      inventariosCriticos,
      ventasTotales,
      pagosProcesados,
      ventasHoy,
      criticalItems,
      recentPayments,
      recentLogs,
      topProducts
    ] = await Promise.all([
      prisma.tusuarios.count({ where: { estatus: 1 } }),
      prisma.tproductos.count({ where: { estatus: 1 } }),
      prisma.tsucursales.count({ where: { estatus: 1 } }),
      prisma.tinventario.count({ where: { estatus: 1, cantidad: { lte: LOW_STOCK_THRESHOLD } } }),
      prisma.tpagos.aggregate({ _sum: { total: true }, where: { estado: 'pagado' } }),
      prisma.tpagos.count({ where: { estado: 'pagado' } }),
      prisma.tpagos.aggregate({ _sum: { total: true }, _count: { id: true }, where: { estado: 'pagado', fechaRegistro: { gte: today } } }),
      prisma.tinventario.findMany({
        where: { estatus: 1, cantidad: { lte: LOW_STOCK_THRESHOLD } },
        include: { tproductos: true, tsucursales: true },
        take: 5,
        orderBy: { cantidad: 'asc' }
      }),
      prisma.tpagos.findMany({
        take: 5,
        orderBy: { fechaRegistro: 'desc' },
      }),
      prisma.tlogs.findMany({
        take: 6,
        orderBy: { fechaRegistro: 'desc' },
      }),
      // Para Top Products usamos queryRaw para agrupamiento complejo si es necesario, o aggregate
      prisma.tventas.groupBy({
        where: { tpagos: { estado: 'pagado' } },
        by: ['producto'],
        _sum: { cantidad: true, total: true },
        orderBy: { _sum: { cantidad: 'desc' } },
        take: 5,
      })
    ]);

    // Enriquecer topProducts con nombres
    const enrichedTopProducts = await Promise.all(topProducts.map(async (p) => {
      const prod = await prisma.tproductos.findUnique({ where: { id: p.producto }, select: { nombre: true } });
      return {
        producto: p.producto,
        nombre: prod?.nombre,
        cantidad: p._sum.cantidad || 0,
        total: p._sum.total || 0
      };
    }));
    const enrichedRecentPayments = await this.attachUsers(recentPayments);
    const enrichedRecentLogs = await this.attachUsers(recentLogs);
    const salesByBranch = await this.getSalesByBranch();

    return {
      threshold: LOW_STOCK_THRESHOLD,
      ventasTotales: ventasTotales._sum.total || 0,
      pagosProcesados,
      ventasHoy: ventasHoy._sum.total || 0,
      pagosHoy: ventasHoy._count.id || 0,
      rentabilidadPromedio: await this.getAverageProfitability(),
      productosMasVendidos: enrichedTopProducts,
      ventasPorSucursal: salesByBranch,
      resumen: {
        usuariosActivos,
        productosActivos,
        sucursalesActivas,
        inventariosCriticos,
        ventasTotales: ventasTotales._sum.total || 0,
        pagosProcesados,
        ventasHoy: ventasHoy._sum.total || 0,
        pagosHoy: ventasHoy._count.id || 0,
      },
      inventarioCritico: criticalItems,
      pagosRecientes: enrichedRecentPayments,
      logsRecientes: enrichedRecentLogs,
      productosTop: enrichedTopProducts
    };
  }

  async getAverageProfitability() {
    const [row] = await prisma.$queryRaw`SELECT COALESCE(AVG(CASE WHEN v.total > 0 THEN (v.total - COALESCE(v."costoUnitario", p."precioCompra", 0) * v.cantidad) / v.total * 100 ELSE 0 END), 0)::text AS margin FROM tventas v JOIN tpagos pay ON pay.id=v.pago JOIN tproductos p ON p.id=v.producto WHERE pay.estado='pagado'`;
    return Number(row.margin);
  }

  async getSalesByBranch() {
    const rows = await prisma.$queryRaw`SELECT to_char(v."fechaRegistro", 'YYYY-MM-DD') AS fecha, CASE WHEN v.sucursal IS NULL THEN 'Historico sin sucursal registrada' ELSE 'Sucursal ' || v.sucursal::text END AS sucursal, SUM(v.total)::text AS total, SUM(v.cantidad)::text AS cantidad, COALESCE((SUM(v.total) - SUM(COALESCE(v."costoUnitario", p."precioCompra", 0) * v.cantidad)) / NULLIF(SUM(v.total), 0) * 100, 0)::text AS rentabilidad FROM tventas v JOIN tpagos pay ON pay.id=v.pago JOIN tproductos p ON p.id=v.producto WHERE pay.estado='pagado' GROUP BY fecha, v.sucursal ORDER BY fecha, v.sucursal LIMIT 1001`;
    if (rows.length > 1000) throw new (require('../utils/AppError'))(409, 'REPORT_TOO_LARGE', 'El reporte requiere un rango de fechas mas acotado.');
    return rows.map(row => ({ ...row, cantidad: Number(row.cantidad), rentabilidad: Number(row.rentabilidad) }));
  }

  async getRecentLogs(limit = 20, filters = {}) {
    const where = {};
    if (filters.modulo) where.modulo = String(filters.modulo);
    if (filters.nivel) where.nivel = String(filters.nivel);
    if (filters.q) {
      where.OR = [
        { descripcion: { contains: String(filters.q), mode: 'insensitive' } },
        { accion: { contains: String(filters.q), mode: 'insensitive' } },
        { modulo: { contains: String(filters.q), mode: 'insensitive' } },
      ];
    }

    const logs = await prisma.tlogs.findMany({
      take: Math.min(Math.max(Number(limit) || 20, 1), 100),
      where,
      orderBy: { fechaRegistro: 'desc' },
    });
    return this.attachUsers(logs);
  }

  async getLogById(id) {
    const logs = await prisma.tlogs.findMany({
      where: { id: Number(id) },
      take: 1
    });
    return (await this.attachUsers(logs))[0] || null;
  }
}

module.exports = new MetricService();
