const express = require("express");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

const createMetricsRoutes = (db) => {
  const router = express.Router();

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
