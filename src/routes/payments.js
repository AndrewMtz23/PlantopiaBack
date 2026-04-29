const express = require("express");
const { authenticateToken, authorizeUserAccess, requireAdmin } = require("../middleware/auth");

const createPaymentRoutes = (db) => {
  const router = express.Router();
  const authorizePaymentUser = authorizeUserAccess((req) => req.params.usuario);
  const deliveryStatuses = new Set(["preparando", "enviado", "entregado", "cancelado"]);

  const normalizeTrackingPayload = (payload = {}) => ({
    estadoEntrega: String(payload.estadoEntrega || "preparando").trim().toLowerCase(),
    fechaEstimadaEntrega: payload.fechaEstimadaEntrega ? String(payload.fechaEstimadaEntrega).trim() : null,
    guiaEntrega: payload.guiaEntrega ? String(payload.guiaEntrega).trim() : null,
    notasEntrega: payload.notasEntrega ? String(payload.notasEntrega).trim() : null,
  });

  const validateTrackingPayload = (tracking) => {
    if (!deliveryStatuses.has(tracking.estadoEntrega)) {
      return "Estado de entrega invalido.";
    }

    if (tracking.fechaEstimadaEntrega && !/^\d{4}-\d{2}-\d{2}$/.test(tracking.fechaEstimadaEntrega)) {
      return "La fecha estimada debe usar formato YYYY-MM-DD.";
    }

    if (tracking.guiaEntrega && tracking.guiaEntrega.length > 120) {
      return "La guia de entrega no debe superar 120 caracteres.";
    }

    if (tracking.notasEntrega && tracking.notasEntrega.length > 500) {
      return "Las notas de entrega no deben superar 500 caracteres.";
    }

    return null;
  };

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
        tp.estadoEntrega,
        tp.fechaEstimadaEntrega,
        tp.guiaEntrega,
        tp.notasEntrega,
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
        tp.estadoEntrega,
        tp.fechaEstimadaEntrega,
        tp.guiaEntrega,
        tp.notasEntrega,
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
            tu.domicilio AS usuario_domicilio,
            tu.ciudad AS usuario_ciudad,
            tu.estadoDireccion AS usuario_estadoDireccion,
            tu.codigoPostal AS usuario_codigoPostal,
            tu.referenciasDomicilio AS usuario_referenciasDomicilio
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

  router.put("/actualizarSeguimientoPago/:id", authenticateToken, requireAdmin, async (req, res) => {
    const pagoId = Number(req.params.id);
    const tracking = normalizeTrackingPayload(req.body);
    const validationError = validateTrackingPayload(tracking);

    if (!Number.isFinite(pagoId)) {
      return res.status(400).json({ error: "Id de pago invalido." });
    }

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    try {
      const [existingRows] = await db.promise().query(
        "SELECT id FROM tpagos WHERE id = ? LIMIT 1",
        [pagoId]
      );

      if (!existingRows.length) {
        return res.status(404).json({ error: "Pago no encontrado." });
      }

      await db.promise().query(
        `UPDATE tpagos
         SET estadoEntrega = ?, fechaEstimadaEntrega = ?, guiaEntrega = ?, notasEntrega = ?
         WHERE id = ?`,
        [
          tracking.estadoEntrega,
          tracking.fechaEstimadaEntrega || null,
          tracking.guiaEntrega || null,
          tracking.notasEntrega || null,
          pagoId,
        ]
      );

      const [updatedRows] = await db.promise().query(
        "SELECT id, estadoEntrega, fechaEstimadaEntrega, guiaEntrega, notasEntrega FROM tpagos WHERE id = ? LIMIT 1",
        [pagoId]
      );

      res.json({ ok: true, seguimiento: updatedRows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "No se pudo actualizar el seguimiento." });
    }
  });

  router.get("/misPagos/:usuario", authenticateToken, authorizePaymentUser, (req, res) => {
    const userId = Number(req.params.usuario);

    if (!Number.isFinite(userId)) {
      return res.status(400).json({ error: "Id de usuario invalido." });
    }

    const query = `
      SELECT
        tp.id,
        tp.usuario,
        tp.metodo,
        tp.estado,
        tp.referencia,
        tp.subtotal,
        tp.iva,
        tp.envio,
        tp.total,
        tp.proveedor,
        tp.estadoEntrega,
        tp.fechaEstimadaEntrega,
        tp.guiaEntrega,
        tp.notasEntrega,
        tp.fechaRegistro,
        tp.fechaActualizacion,
        COUNT(tv.id) AS productos,
        COALESCE(SUM(tv.cantidad), 0) AS unidades
      FROM tpagos tp
      LEFT JOIN tventas tv ON tv.pago = tp.id
      WHERE tp.usuario = ?
      GROUP BY
        tp.id,
        tp.usuario,
        tp.metodo,
        tp.estado,
        tp.referencia,
        tp.subtotal,
        tp.iva,
        tp.envio,
        tp.total,
        tp.proveedor,
        tp.estadoEntrega,
        tp.fechaEstimadaEntrega,
        tp.guiaEntrega,
        tp.notasEntrega,
        tp.fechaRegistro,
        tp.fechaActualizacion
      ORDER BY tp.fechaRegistro DESC
    `;

    db.query(query, [userId], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "No se pudieron obtener tus compras." });
      }

      res.json(result);
    });
  });

  router.get("/miPago/:usuario/:id", authenticateToken, authorizePaymentUser, async (req, res) => {
    const userId = Number(req.params.usuario);
    const pagoId = Number(req.params.id);

    if (!Number.isFinite(userId) || !Number.isFinite(pagoId)) {
      return res.status(400).json({ error: "Datos de consulta invalidos." });
    }

    try {
      const [paymentRows] = await db.promise().query(
        `
          SELECT
            tp.*,
            tu.nombre AS usuario_nombre,
            tu.correo AS usuario_correo,
            tu.telefono AS usuario_telefono,
            tu.domicilio AS usuario_domicilio,
            tu.ciudad AS usuario_ciudad,
            tu.estadoDireccion AS usuario_estadoDireccion,
            tu.codigoPostal AS usuario_codigoPostal,
            tu.referenciasDomicilio AS usuario_referenciasDomicilio
          FROM tpagos tp
          LEFT JOIN tusuarios tu ON tp.usuario = tu.id
          WHERE tp.id = ? AND tp.usuario = ?
          LIMIT 1
        `,
        [pagoId, userId]
      );

      if (!paymentRows.length) {
        return res.status(404).json({ error: "Compra no encontrada." });
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

      res.json({
        pago: paymentRows[0],
        items: itemRows,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "No se pudo obtener el detalle de tu compra." });
    }
  });

  return router;
};

module.exports = createPaymentRoutes;
