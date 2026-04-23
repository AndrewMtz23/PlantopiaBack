const express = require("express");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

const createLogRoutes = (db) => {
  const router = express.Router();

  router.get("/verLogs", authenticateToken, requireAdmin, (req, res) => {
    const {
      modulo,
      accion,
      nivel,
      usuario,
      entidad,
      entidadId,
      fechaDesde,
      fechaHasta,
      q,
      limit,
    } = req.query;

    const conditions = [];
    const params = [];

    if (modulo) {
      conditions.push("tl.modulo = ?");
      params.push(String(modulo).trim());
    }

    if (accion) {
      conditions.push("tl.accion = ?");
      params.push(String(accion).trim());
    }

    if (nivel) {
      conditions.push("tl.nivel = ?");
      params.push(String(nivel).trim());
    }

    if (usuario && Number.isFinite(Number(usuario))) {
      conditions.push("tl.usuario = ?");
      params.push(Number(usuario));
    }

    if (entidad) {
      conditions.push("tl.entidad = ?");
      params.push(String(entidad).trim());
    }

    if (entidadId && Number.isFinite(Number(entidadId))) {
      conditions.push("tl.entidadId = ?");
      params.push(Number(entidadId));
    }

    if (fechaDesde) {
      conditions.push("DATE(tl.fechaRegistro) >= DATE(?)");
      params.push(String(fechaDesde).trim());
    }

    if (fechaHasta) {
      conditions.push("DATE(tl.fechaRegistro) <= DATE(?)");
      params.push(String(fechaHasta).trim());
    }

    if (q) {
      conditions.push(
        "(tl.descripcion LIKE ? OR tl.accion LIKE ? OR tl.modulo LIKE ? OR tu.nombre LIKE ? OR tu.correo LIKE ?)"
      );
      const pattern = `%${String(q).trim()}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const safeLimit = Number.isFinite(Number(limit))
      ? Math.min(Math.max(Number(limit), 1), 500)
      : 200;

    const query = `
      SELECT
        tl.id,
        tl.usuario,
        tu.nombre AS usuario_nombre,
        tu.correo AS usuario_correo,
        tl.modulo,
        tl.accion,
        tl.descripcion,
        tl.entidad,
        tl.entidadId,
        tl.nivel,
        tl.ip,
        tl.metadata,
        tl.fechaRegistro
      FROM tlogs tl
      LEFT JOIN tusuarios tu ON tl.usuario = tu.id
      ${whereClause}
      ORDER BY tl.fechaRegistro DESC, tl.id DESC
      LIMIT ?
    `;

    db.query(query, [...params, safeLimit], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "No se pudieron obtener los logs." });
      }

      res.json(result);
    });
  });

  router.get("/verLog/:id", authenticateToken, requireAdmin, (req, res) => {
    const logId = Number(req.params.id);

    if (!Number.isFinite(logId)) {
      return res.status(400).json({ error: "Id de log invalido." });
    }

    const query = `
      SELECT
        tl.id,
        tl.usuario,
        tu.nombre AS usuario_nombre,
        tu.correo AS usuario_correo,
        tl.modulo,
        tl.accion,
        tl.descripcion,
        tl.entidad,
        tl.entidadId,
        tl.nivel,
        tl.ip,
        tl.metadata,
        tl.fechaRegistro
      FROM tlogs tl
      LEFT JOIN tusuarios tu ON tl.usuario = tu.id
      WHERE tl.id = ?
      LIMIT 1
    `;

    db.query(query, [logId], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "No se pudo obtener el log." });
      }

      if (!result.length) {
        return res.status(404).json({ error: "Log no encontrado." });
      }

      res.json(result[0]);
    });
  });

  return router;
};

module.exports = createLogRoutes;
