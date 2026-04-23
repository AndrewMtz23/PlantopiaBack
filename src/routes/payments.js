const express = require("express");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

const createPaymentRoutes = (db) => {
  const router = express.Router();

  router.get("/verPagos", authenticateToken, requireAdmin, (req, res) => {
    const query = `
      SELECT
        tp.id,
        tp.usuario,
        tu.nombre AS usuario_nombre,
        tu.correo AS usuario_correo,
        tp.metodo,
        tp.estado,
        tp.referencia,
        tp.subtotal,
        tp.iva,
        tp.envio,
        tp.total,
        tp.proveedor,
        tp.fechaRegistro,
        tp.fechaActualizacion,
        COUNT(tv.id) AS productos,
        COALESCE(SUM(tv.cantidad), 0) AS unidades
      FROM tpagos tp
      LEFT JOIN tusuarios tu ON tp.usuario = tu.id
      LEFT JOIN tventas tv ON tv.pago = tp.id
      GROUP BY
        tp.id,
        tp.usuario,
        tu.nombre,
        tu.correo,
        tp.metodo,
        tp.estado,
        tp.referencia,
        tp.subtotal,
        tp.iva,
        tp.envio,
        tp.total,
        tp.proveedor,
        tp.fechaRegistro,
        tp.fechaActualizacion
      ORDER BY tp.fechaRegistro DESC
    `;

    db.query(query, (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "No se pudieron obtener los pagos." });
      }

      res.json(result);
    });
  });

  router.get("/verPago/:id", authenticateToken, requireAdmin, async (req, res) => {
    const pagoId = Number(req.params.id);

    if (!Number.isFinite(pagoId)) {
      return res.status(400).json({ error: "Id de pago invalido." });
    }

    try {
      const [paymentRows] = await db.promise().query(
        `
          SELECT
            tp.*,
            tu.nombre AS usuario_nombre,
            tu.correo AS usuario_correo,
            tu.telefono AS usuario_telefono,
            tu.domicilio AS usuario_domicilio
          FROM tpagos tp
          LEFT JOIN tusuarios tu ON tp.usuario = tu.id
          WHERE tp.id = ?
          LIMIT 1
        `,
        [pagoId]
      );

      if (!paymentRows.length) {
        return res.status(404).json({ error: "Pago no encontrado." });
      }

      const [itemRows] = await db.promise().query(
        `
          SELECT
            tv.id,
            tv.producto,
            tv.cantidad,
            tv.total,
            tv.fechaRegistro,
            tp.nombre,
            tp.detalles,
            tp.categoria,
            tp.imagen,
            tp.imagenUrl
          FROM tventas tv
          LEFT JOIN tproductos tp ON tv.producto = tp.id
          WHERE tv.pago = ?
          ORDER BY tv.id ASC
        `,
        [pagoId]
      );

      const [logRows] = await db.promise().query(
        `
          SELECT id, usuario, modulo, accion, descripcion, entidad, entidadId, nivel, ip, metadata, fechaRegistro
          FROM tlogs
          WHERE entidad = 'tpagos' AND entidadId = ?
          ORDER BY fechaRegistro DESC
        `,
        [pagoId]
      );

      res.json({
        pago: paymentRows[0],
        items: itemRows,
        logs: logRows,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "No se pudo obtener el detalle del pago." });
    }
  });

  return router;
};

module.exports = createPaymentRoutes;
