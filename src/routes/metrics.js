const express = require("express");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

const createMetricsRoutes = (db) => {
  const router = express.Router();
  const LOW_STOCK_THRESHOLD = 5;

  router.get("/dashboardResumen", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const dbPromise = db.promise();
      const [
        [summaryRows],
        [todaySalesRows],
        [criticalRows],
        [recentPaymentRows],
        [recentLogRows],
        [topProductRows],
      ] = await Promise.all([
        dbPromise.query(`
          SELECT
            (SELECT COUNT(*) FROM tusuarios WHERE estatus = 1) AS usuariosActivos,
            (SELECT COUNT(*) FROM tproductos WHERE estatus = 1) AS productosActivos,
            (SELECT COUNT(*) FROM tsucursales WHERE estatus = 1) AS sucursalesActivas,
            (SELECT COUNT(*) FROM tinventario WHERE estatus = 1 AND cantidad <= ?) AS inventariosCriticos,
            (SELECT COALESCE(SUM(total), 0) FROM tpagos WHERE estado = 'pagado') AS ventasTotales,
            (SELECT COUNT(*) FROM tpagos WHERE estado = 'pagado') AS pagosProcesados
        `, [LOW_STOCK_THRESHOLD]),
        dbPromise.query(`
          SELECT
            COALESCE(SUM(total), 0) AS ventasHoy,
            COUNT(*) AS pagosHoy
          FROM tpagos
          WHERE estado = 'pagado' AND DATE(fechaRegistro) = CURDATE()
        `),
        dbPromise.query(`
          SELECT
            ti.id,
            ti.cantidad,
            tp.nombre AS producto_nombre,
            ts.nombre AS sucursal_nombre
          FROM tinventario ti
          LEFT JOIN tproductos tp ON ti.producto = tp.id
          LEFT JOIN tsucursales ts ON ti.sucursal = ts.id
          WHERE ti.estatus = 1 AND ti.cantidad <= ?
          ORDER BY ti.cantidad ASC, tp.nombre ASC
          LIMIT 5
        `, [LOW_STOCK_THRESHOLD]),
        dbPromise.query(`
          SELECT
            tp.id,
            tp.total,
            tp.metodo,
            tp.estado,
            tp.fechaRegistro,
            tu.nombre AS usuario_nombre
          FROM tpagos tp
          LEFT JOIN tusuarios tu ON tp.usuario = tu.id
          ORDER BY tp.fechaRegistro DESC
          LIMIT 5
        `),
        dbPromise.query(`
          SELECT
            tl.id,
            tl.modulo,
            tl.accion,
            tl.descripcion,
            tl.nivel,
            tl.fechaRegistro,
            tu.nombre AS usuario_nombre
          FROM tlogs tl
          LEFT JOIN tusuarios tu ON tl.usuario = tu.id
          ORDER BY tl.fechaRegistro DESC
          LIMIT 6
        `),
        dbPromise.query(`
          SELECT
            tp.nombre,
            SUM(tv.cantidad) AS cantidad,
            SUM(tv.total) AS total
          FROM tventas tv
          LEFT JOIN tproductos tp ON tv.producto = tp.id
          GROUP BY tv.producto, tp.nombre
          ORDER BY cantidad DESC
          LIMIT 5
        `),
      ]);

      res.json({
        threshold: LOW_STOCK_THRESHOLD,
        resumen: {
          ...summaryRows[0],
          ...todaySalesRows[0],
        },
        inventarioCritico: criticalRows,
        pagosRecientes: recentPaymentRows,
        logsRecientes: recentLogRows,
        productosTop: topProductRows,
      });
    } catch (error) {
      console.error("Error al cargar dashboard:", error);
      res.status(500).json({ error: "No se pudo cargar el dashboard." });
    }
  });

  router.get("/metricasGenerales", authenticateToken, requireAdmin, (req, res) => {
    const query = `
      SELECT 
        SUM(tv.total) AS ventasTotales,
        AVG((tv.total - (tp.precioCompra * tv.cantidad)) / tv.total * 100) AS rentabilidadPromedio,
        tp.nombre AS nombreProducto,
        SUM(tv.cantidad) AS cantidadVendida
      FROM 
        tventas tv
      JOIN 
        tproductos tp ON tv.producto = tp.id
      WHERE 
        tv.fechaRegistro >= NOW() - INTERVAL 2 WEEK
      GROUP BY 
        tp.id
      ORDER BY 
        cantidadVendida DESC
      LIMIT 5
    `;

    db.query(query, (err, result) => {
      if (err) {
        console.error("Error en la consulta:", err);
        return res.status(500).send("Error al obtener las metricas generales");
      }

      const metricas = {
        ventasTotales: result[0]?.ventasTotales || 0,
        rentabilidadPromedio: result[0]?.rentabilidadPromedio || 0,
        productosMasVendidos: result.map((row) => ({
          nombre: row.nombreProducto,
          cantidad: row.cantidadVendida,
        })),
      };

      res.json(metricas);
    });
  });

  router.get("/ventasPorSucursal", authenticateToken, requireAdmin, (req, res) => {
    const query = `
      SELECT 
        ts.nombre AS sucursal,
        SUM(tv.total) AS total,
        AVG((tv.total - (tp.precioCompra * tv.cantidad)) / tv.total * 100) AS rentabilidad,
        DATE(tv.fechaRegistro) AS fecha
      FROM 
        tventas tv
      JOIN 
        tsucursales ts ON tv.usuario = ts.id
      JOIN 
        tproductos tp ON tv.producto = tp.id
      WHERE 
        tv.fechaRegistro >= NOW() - INTERVAL 2 WEEK
      GROUP BY 
        ts.nombre, DATE(tv.fechaRegistro)
      ORDER BY 
        ts.nombre, DATE(tv.fechaRegistro)
    `;

    db.query(query, (err, result) => {
      if (err) {
        console.error("Error en la consulta:", err.sqlMessage || err);
        return res
          .status(500)
          .send(`Error al obtener los datos de ventas por sucursal: ${err.sqlMessage}`);
      }

      res.json(result);
    });
  });

  return router;
};

module.exports = createMetricsRoutes;
