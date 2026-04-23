const express = require("express");
const { authenticateToken, requireAdmin } = require("../middleware/auth");
const { getRequestIp, writeActivityLog } = require("../utils/activityLog");

const createProviderRoutes = (db) => {
  const router = express.Router();

  const normalizePhone = (value = "") => String(value).replace(/\D/g, "");
  const normalizeEmail = (value = "") => String(value).trim().toLowerCase();
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateProviderPayload = ({
    marca,
    representante,
    telefono,
    correo,
    direccion,
    fechaContrato,
  }) => {
    if (!marca || String(marca).trim().length < 2) {
      return "La marca debe tener al menos 2 caracteres.";
    }

    if (!representante || String(representante).trim().length < 3) {
      return "El representante debe tener al menos 3 caracteres.";
    }

    if (normalizePhone(telefono).length < 10) {
      return "El telefono debe tener al menos 10 digitos.";
    }

    if (!EMAIL_REGEX.test(normalizeEmail(correo))) {
      return "Ingresa un correo valido.";
    }

    if (!direccion || String(direccion).trim().length < 8) {
      return "La direccion debe ser mas especifica.";
    }

    if (!fechaContrato) {
      return "La fecha de contrato es obligatoria.";
    }

    return null;
  };

  router.post("/crearProveedor", authenticateToken, requireAdmin, async (req, res) => {
    const {
      estatus,
      marca,
      representante,
      telefono,
      correo,
      direccion,
      fechaContrato,
    } = req.body;
    const normalizedEmail = normalizeEmail(correo);
    const requestIp = getRequestIp(req);
    const validationError = validateProviderPayload({
      marca,
      representante,
      telefono,
      correo: normalizedEmail,
      direccion,
      fechaContrato,
    });

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    try {
      const [existingProviders] = await db
        .promise()
        .query("SELECT id FROM tproveedores WHERE LOWER(correo) = ? LIMIT 1", [normalizedEmail]);

      if (existingProviders.length > 0) {
        return res.status(409).json({ error: "Ya existe un proveedor con ese correo." });
      }
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "No se pudo validar el proveedor." });
    }

    try {
      const [result] = await db.promise().query(
        "INSERT INTO tproveedores(estatus,marca,representante,telefono,correo,direccion,fechaContrato) VALUES(?,?,?,?,?,?,?)",
        [
          estatus,
          String(marca).trim(),
          String(representante).trim(),
          normalizePhone(telefono),
          normalizedEmail,
          String(direccion).trim(),
          fechaContrato,
        ]
      );

      await writeActivityLog(db.promise(), {
        usuario: Number(req.auth?.idUsuario) || null,
        modulo: "proveedores",
        accion: "crear_proveedor",
        descripcion: `Se creo el proveedor ${String(marca).trim()}.`,
        entidad: "tproveedores",
        entidadId: result.insertId,
        nivel: "info",
        ip: requestIp,
        metadata: {
          representante: String(representante).trim(),
          correo: normalizedEmail,
          estatus,
        },
      });

      res.send(result);
    } catch (error) {
      console.log(error);
      return res.status(500).send("Error al crear el proveedor");
    }
  });

  router.get("/verProveedor", authenticateToken, requireAdmin, (req, res) => {
    db.query("SELECT * FROM tproveedores", (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Error al obtener proveedores");
      }

      res.send(result);
    });
  });

  router.put("/editarProveedor", authenticateToken, requireAdmin, async (req, res) => {
    const {
      id,
      estatus,
      marca,
      representante,
      telefono,
      correo,
      direccion,
      fechaContrato,
    } = req.body;
    const normalizedEmail = normalizeEmail(correo);
    const requestIp = getRequestIp(req);
    const validationError = validateProviderPayload({
      marca,
      representante,
      telefono,
      correo: normalizedEmail,
      direccion,
      fechaContrato,
    });

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    try {
      const [existingProviders] = await db.promise().query(
        "SELECT id FROM tproveedores WHERE LOWER(correo) = ? AND id <> ? LIMIT 1",
        [normalizedEmail, id]
      );

      if (existingProviders.length > 0) {
        return res.status(409).json({ error: "Ya existe otro proveedor con ese correo." });
      }
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "No se pudo validar el proveedor." });
    }

    try {
      const [rows] = await db.promise().query(
        "SELECT id, marca, representante, correo, telefono, direccion, fechaContrato, estatus FROM tproveedores WHERE id = ? LIMIT 1",
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({ error: "Proveedor no encontrado." });
      }

      const previous = rows[0];
      const [result] = await db.promise().query(
        "UPDATE tproveedores SET estatus=?,marca=?,representante=?,telefono=?,correo=?,direccion=?,fechaContrato=? WHERE id=?",
        [
          estatus,
          String(marca).trim(),
          String(representante).trim(),
          normalizePhone(telefono),
          normalizedEmail,
          String(direccion).trim(),
          fechaContrato,
          id,
        ]
      );

      await writeActivityLog(db.promise(), {
        usuario: Number(req.auth?.idUsuario) || null,
        modulo: "proveedores",
        accion: "editar_proveedor",
        descripcion: `Se actualizo el proveedor ${previous.marca} (#${id}).`,
        entidad: "tproveedores",
        entidadId: Number(id),
        nivel: "info",
        ip: requestIp,
        metadata: {
          antes: previous,
          despues: {
            marca: String(marca).trim(),
            representante: String(representante).trim(),
            telefono: normalizePhone(telefono),
            correo: normalizedEmail,
            direccion: String(direccion).trim(),
            fechaContrato,
            estatus,
          },
        },
      });

      res.send(result);
    } catch (error) {
      console.log(error);
      return res.status(500).send("Error al editar el proveedor");
    }
  });

  router.delete("/eliminarProveedor/:id", authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const providerId = Number(id);
    const requestIp = getRequestIp(req);

    if (!Number.isFinite(providerId)) {
      return res.status(400).json({ error: "Id de proveedor invalido." });
    }

    db.query("SELECT id, marca, estatus, correo FROM tproveedores WHERE id = ? LIMIT 1", [id], (findErr, providers) => {
      if (findErr) {
        console.log(findErr);
        return res.status(500).json({ error: "Error al validar el proveedor." });
      }

      if (!providers.length) {
        return res.status(404).json({ error: "Proveedor no encontrado." });
      }

      const targetProvider = providers[0];

      db.query("UPDATE tproveedores SET estatus = 0 WHERE id = ? AND estatus <> 0", [id], async (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ error: "Error al desactivar el proveedor." });
      }

      if (!result.affectedRows) {
        return res.status(409).json({ error: "El proveedor ya se encuentra inactivo." });
      }

      try {
        await writeActivityLog(db.promise(), {
          usuario: Number(req.auth?.idUsuario) || null,
          modulo: "proveedores",
          accion: "desactivar_proveedor",
          descripcion: `Se desactivo el proveedor ${targetProvider.marca} (#${providerId}).`,
          entidad: "tproveedores",
          entidadId: providerId,
          nivel: "warning",
          ip: requestIp,
          metadata: {
            correo: targetProvider.correo,
            estatusAnterior: targetProvider.estatus,
            estatusNuevo: 0,
          },
        });
      } catch (logError) {
        console.log(logError);
      }

      res.json({ ok: true, deactivatedId: providerId, estatus: 0 });
      });
    });
  });

  return router;
};

module.exports = createProviderRoutes;
