const express = require("express");
const { authenticateToken, requireAdmin } = require("../middleware/auth");
const { getRequestIp, writeActivityLog } = require("../utils/activityLog");

const createBranchRoutes = (db) => {
  const router = express.Router();

  const normalizePhone = (value = "") => String(value).replace(/\D/g, "");

  const validateBranchPayload = ({ gerente, nombre, telefono, direccion }) => {
    if (!gerente) {
      return "Debes seleccionar un gerente.";
    }

    if (!nombre || String(nombre).trim().length < 3) {
      return "El nombre de la sucursal debe tener al menos 3 caracteres.";
    }

    if (normalizePhone(telefono).length < 10) {
      return "El telefono debe tener al menos 10 digitos.";
    }

    if (!direccion || String(direccion).trim().length < 8) {
      return "La direccion debe ser mas especifica.";
    }

    return null;
  };

  router.get("/verGerente", authenticateToken, requireAdmin, (req, res) => {
    db.query(
      "SELECT id, nombre, correo FROM tusuarios WHERE tipo = 1 AND estatus = 1 ORDER BY nombre ASC",
      (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Error al obtener gerentes");
      }

      res.send(result);
      }
    );
  });

  router.post("/crearSucursal", authenticateToken, requireAdmin, async (req, res) => {
    const { estatus, gerente, nombre, telefono, direccion } = req.body;
    const validationError = validateBranchPayload({ gerente, nombre, telefono, direccion });
    const requestIp = getRequestIp(req);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    try {
      const [managerRows] = await db
        .promise()
        .query("SELECT id FROM tusuarios WHERE id = ? AND tipo = 1 AND estatus = 1 LIMIT 1", [gerente]);

      if (!managerRows.length) {
        return res.status(400).json({ error: "El gerente seleccionado no es valido o esta inactivo." });
      }
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "No se pudo validar el gerente." });
    }

    try {
      const [result] = await db.promise().query(
        "INSERT INTO tsucursales(estatus,gerente,nombre,telefono,direccion) VALUES(?,?,?,?,?)",
        [estatus, gerente, String(nombre).trim(), normalizePhone(telefono), String(direccion).trim()]
      );

      await writeActivityLog(db.promise(), {
        usuario: Number(req.auth?.idUsuario) || null,
        modulo: "sucursales",
        accion: "crear_sucursal",
        descripcion: `Se creo la sucursal ${String(nombre).trim()}.`,
        entidad: "tsucursales",
        entidadId: result.insertId,
        nivel: "info",
        ip: requestIp,
        metadata: {
          gerente,
          telefono: normalizePhone(telefono),
          estatus,
        },
      });

      res.send(result);
    } catch (error) {
      console.log(error);
      return res.status(500).send("Error al crear la sucursal");
    }
  });

  router.get("/verSucursal", authenticateToken, (req, res) => {
    db.query("SELECT * FROM tsucursales", (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Error al obtener sucursales");
      }

      res.send(result);
    });
  });

  router.put("/editarSucursal", authenticateToken, requireAdmin, async (req, res) => {
    const { id, estatus, gerente, nombre, telefono, direccion } = req.body;
    const validationError = validateBranchPayload({ gerente, nombre, telefono, direccion });
    const requestIp = getRequestIp(req);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    try {
      const [managerRows] = await db
        .promise()
        .query("SELECT id FROM tusuarios WHERE id = ? AND tipo = 1 AND estatus = 1 LIMIT 1", [gerente]);

      if (!managerRows.length) {
        return res.status(400).json({ error: "El gerente seleccionado no es valido o esta inactivo." });
      }
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "No se pudo validar el gerente." });
    }

    try {
      const [rows] = await db.promise().query(
        "SELECT id, gerente, nombre, telefono, direccion, estatus FROM tsucursales WHERE id = ? LIMIT 1",
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({ error: "Sucursal no encontrada." });
      }

      const previous = rows[0];
      const [result] = await db.promise().query(
        "UPDATE tsucursales SET estatus=?,gerente=?,nombre=?,telefono=?,direccion=? WHERE id=?",
        [estatus, gerente, String(nombre).trim(), normalizePhone(telefono), String(direccion).trim(), id]
      );

      await writeActivityLog(db.promise(), {
        usuario: Number(req.auth?.idUsuario) || null,
        modulo: "sucursales",
        accion: "editar_sucursal",
        descripcion: `Se actualizo la sucursal ${previous.nombre} (#${id}).`,
        entidad: "tsucursales",
        entidadId: Number(id),
        nivel: "info",
        ip: requestIp,
        metadata: {
          antes: previous,
          despues: {
            gerente,
            nombre: String(nombre).trim(),
            telefono: normalizePhone(telefono),
            direccion: String(direccion).trim(),
            estatus,
          },
        },
      });

      res.send(result);
    } catch (error) {
      console.log(error);
      return res.status(500).send("Error al editar la sucursal");
    }
  });

  router.delete("/eliminarSucursal/:id", authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const branchId = Number(id);
    const requestIp = getRequestIp(req);

    if (!Number.isFinite(branchId)) {
      return res.status(400).json({ error: "Id de sucursal invalido." });
    }

    db.query("SELECT id, nombre, estatus FROM tsucursales WHERE id = ? LIMIT 1", [id], (findErr, branches) => {
      if (findErr) {
        console.log(findErr);
        return res.status(500).json({ error: "Error al validar la sucursal." });
      }

      if (!branches.length) {
        return res.status(404).json({ error: "Sucursal no encontrada." });
      }

      const targetBranch = branches[0];

      db.query("UPDATE tsucursales SET estatus = 0 WHERE id = ? AND estatus <> 0", [id], async (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ error: "Error al desactivar la sucursal." });
      }

      if (!result.affectedRows) {
        return res.status(409).json({ error: "La sucursal ya se encuentra inactiva." });
      }

      try {
        await writeActivityLog(db.promise(), {
          usuario: Number(req.auth?.idUsuario) || null,
          modulo: "sucursales",
          accion: "desactivar_sucursal",
          descripcion: `Se desactivo la sucursal ${targetBranch.nombre} (#${branchId}).`,
          entidad: "tsucursales",
          entidadId: branchId,
          nivel: "warning",
          ip: requestIp,
          metadata: {
            estatusAnterior: targetBranch.estatus,
            estatusNuevo: 0,
          },
        });
      } catch (logError) {
        console.log(logError);
      }

      res.json({ ok: true, deactivatedId: branchId, estatus: 0 });
      });
    });
  });

  return router;
};

module.exports = createBranchRoutes;
