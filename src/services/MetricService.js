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
    const sales = await prisma.tventas.findMany({
      include: {
        tproductos: {
          select: { precioCompra: true, precioVenta: true }
        }
      }
    });

    if (!sales.length) {
      return 0;
    }

    const margins = sales.map((sale) => {
      const revenue = Number(sale.total || 0);
      const cost = Number(sale.tproductos?.precioCompra || 0) * Number(sale.cantidad || 0);

      if (revenue <= 0) {
        return 0;
      }

      return ((revenue - cost) / revenue) * 100;
    });

    return margins.reduce((sum, margin) => sum + margin, 0) / margins.length;
  }

  async getSalesByBranch() {
    const sales = await prisma.tventas.findMany({
      include: {
        tproductos: true
      },
      orderBy: { fechaRegistro: 'asc' }
    });

    if (!sales.length) {
      return [];
    }

    const productIds = [...new Set(sales.map((sale) => sale.producto).filter(Boolean))];
    const inventory = await prisma.tinventario.findMany({
      where: { producto: { in: productIds } },
      include: { tsucursales: true }
    });

    const branchByProduct = new Map();
    inventory.forEach((item) => {
      if (!branchByProduct.has(item.producto)) {
        branchByProduct.set(item.producto, item.tsucursales?.nombre || `Sucursal ${item.sucursal}`);
      }
    });

    const grouped = new Map();

    sales.forEach((sale) => {
      const date = sale.fechaRegistro
        ? new Date(sale.fechaRegistro).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const branch = branchByProduct.get(sale.producto) || "Sucursal general";
      const key = `${date}::${branch}`;
      const total = Number(sale.total || 0);
      const cost = Number(sale.tproductos?.precioCompra || 0) * Number(sale.cantidad || 0);

      const current = grouped.get(key) || {
        fecha: date,
        sucursal: branch,
        total: 0,
        costo: 0,
        cantidad: 0
      };

      current.total += total;
      current.costo += cost;
      current.cantidad += Number(sale.cantidad || 0);
      grouped.set(key, current);
    });

    return [...grouped.values()].map((item) => ({
      fecha: item.fecha,
      sucursal: item.sucursal,
      total: Number(item.total.toFixed(2)),
      cantidad: item.cantidad,
      rentabilidad: item.total > 0
        ? Number((((item.total - item.costo) / item.total) * 100).toFixed(2))
        : 0
    }));
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
      take: limit,
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
