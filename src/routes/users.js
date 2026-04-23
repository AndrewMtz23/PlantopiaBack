const express = require("express");
const { authenticateToken, requireAdmin } = require("../middleware/auth");
const { normalizeEmail, validateUserPayload } = require("../utils/authValidation");
const { hashPassword } = require("../utils/passwords");
const { getRequestIp, writeActivityLog } = require("../utils/activityLog");

const createUserRoutes = (db) => {
  const router = express.Router();

  router.post("/crearUsuario", authenticateToken, requireAdmin, async (req, res) => {
    const {
      estatus,
      tipo,
      clave,
      nombre,
      fechaNacimiento,
      genero,
      telefono,
      correo,
      domicilio,
    } = req.body;
    const normalizedPayload = {
      estatus,
      tipo,
      clave,
      nombre,
      fechaNacimiento,
      genero,
      telefono,
      correo: normalizeEmail(correo || ""),
      domicilio,
    };
    const validationError = validateUserPayload(normalizedPayload);
    const requestIp = getRequestIp(req);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    try {
      const [existingUsers] = await db
        .promise()
        .query("SELECT id FROM tusuarios WHERE LOWER(correo) = ? LIMIT 1", [normalizedPayload.correo]);

      if (existingUsers.length > 0) {
        return res.status(409).json({ error: "Ya existe un usuario con ese correo." });
      }

      const hashedPassword = await hashPassword(clave);
      const [result] = await db.promise().query(
        "INSERT INTO tusuarios(estatus,tipo,clave,nombre,fechaNacimiento,genero,telefono,correo,domicilio) VALUES(?,?,?,?,?,?,?,?,?)",
        [
          estatus,
          tipo,
          hashedPassword,
          nombre.trim(),
          fechaNacimiento,
          genero,
          String(telefono).replace(/\D/g, ""),
          normalizedPayload.correo,
          domicilio.trim(),
        ]
      );

      await writeActivityLog(db.promise(), {
        usuario: Number(req.auth?.idUsuario) || null,
        modulo: "usuarios",
        accion: "crear_usuario",
        descripcion: `Se creo el usuario ${nombre.trim()} (${normalizedPayload.correo}).`,
        entidad: "tusuarios",
        entidadId: result.insertId,
        nivel: "info",
        ip: requestIp,
        metadata: {
          tipo,
          estatus,
          correo: normalizedPayload.correo,
        },
      });

      res.send(result);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "Error al crear el usuario." });
    }
  });

  router.get("/verUsuario", authenticateToken, requireAdmin, (req, res) => {
    db.query(
      "SELECT id, estatus, tipo, nombre, fechaNacimiento, genero, telefono, correo, domicilio FROM tusuarios",
      (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Error al obtener usuarios");
      }

      res.send(result);
      }
    );
  });

  router.get("/verUsuario/:id", authenticateToken, (req, res) => {
    const { id } = req.params;
    const isAdmin = Number(req.auth?.tipo) === 1;

    if (!isAdmin && Number(id) !== Number(req.auth?.idUsuario)) {
      return res.status(403).json({ error: "No puedes consultar otro usuario." });
    }

    db.query(
      "SELECT id, estatus, tipo, nombre, fechaNacimiento, genero, telefono, correo, domicilio FROM tusuarios WHERE id = ?",
      [id],
      (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).send("Error al obtener el usuario");
        }

        if (result.length === 0) {
          return res.status(404).json({ error: "Usuario no encontrado" });
        }

        res.json(result[0]);
      }
    );
  });

  router.put("/editarUsuario", authenticateToken, requireAdmin, async (req, res) => {
    const {
      id,
      estatus,
      tipo,
      clave,
      nombre,
      fechaNacimiento,
      genero,
      telefono,
      correo,
      domicilio,
    } = req.body;
    const normalizedEmail = normalizeEmail(correo || "");
    const requestIp = getRequestIp(req);

    if (!nombre || String(nombre).trim().length < 3) {
      return res.status(400).json({ error: "El nombre debe tener al menos 3 caracteres." });
    }

    if (!normalizedEmail) {
      return res.status(400).json({ error: "El correo es obligatorio." });
    }

    try {
      const [existingUsers] = await db.promise().query(
        "SELECT id FROM tusuarios WHERE LOWER(correo) = ? AND id <> ? LIMIT 1",
        [normalizedEmail, id]
      );

      if (existingUsers.length > 0) {
        return res.status(409).json({ error: "Ya existe otro usuario con ese correo." });
      }

      const [targetRows] = await db.promise().query(
        "SELECT id, nombre, correo, estatus, tipo FROM tusuarios WHERE id = ? LIMIT 1",
        [id]
      );

      if (!targetRows.length) {
        return res.status(404).json({ error: "Usuario no encontrado." });
      }

      const previousUser = targetRows[0];

      const values = [
        estatus,
        tipo,
        nombre.trim(),
        fechaNacimiento,
        genero,
        String(telefono).replace(/\D/g, ""),
        normalizedEmail,
        domicilio.trim(),
      ];

      let query =
        "UPDATE tusuarios SET estatus=?,tipo=?,nombre=?,fechaNacimiento=?,genero=?,telefono=?,correo=?,domicilio=?";

      if (clave && clave.trim() !== "") {
        query += ",clave=?";
        values.push(await hashPassword(clave));
      }

      query += " WHERE id=?";
      values.push(id);
      const [result] = await db.promise().query(query, values);

      await writeActivityLog(db.promise(), {
        usuario: Number(req.auth?.idUsuario) || null,
        modulo: "usuarios",
        accion: "editar_usuario",
        descripcion: `Se actualizo el usuario ${previousUser.nombre} (#${id}).`,
        entidad: "tusuarios",
        entidadId: Number(id),
        nivel: "info",
        ip: requestIp,
        metadata: {
          antes: {
            nombre: previousUser.nombre,
            correo: previousUser.correo,
            estatus: previousUser.estatus,
            tipo: previousUser.tipo,
          },
          despues: {
            nombre: nombre.trim(),
            correo: normalizedEmail,
            estatus,
            tipo,
          },
          actualizoClave: Boolean(clave && clave.trim() !== ""),
        },
      });

      res.send(result);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "Error al editar el usuario." });
    }
  });

  router.delete("/eliminarUsuario/:id", authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const targetUserId = Number(id);
    const currentUserId = Number(req.auth?.idUsuario);
    const requestIp = getRequestIp(req);

    if (!Number.isFinite(targetUserId)) {
      return res.status(400).json({ error: "Id de usuario invalido." });
    }

    if (targetUserId === currentUserId) {
      return res.status(400).json({ error: "No puedes desactivar tu propia cuenta desde el panel." });
    }

    db.query("SELECT id, nombre, correo, estatus FROM tusuarios WHERE id = ? LIMIT 1", [id], (findErr, users) => {
      if (findErr) {
        console.log(findErr);
        return res.status(500).json({ error: "Error al validar el usuario." });
      }

      if (!users.length) {
        return res.status(404).json({ error: "Usuario no encontrado." });
      }

      const targetUser = users[0];

      db.query("UPDATE tusuarios SET estatus = 0 WHERE id = ? AND estatus <> 0", [id], async (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ error: "Error al desactivar el usuario." });
        }

        if (!result.affectedRows) {
          return res.status(409).json({ error: "El usuario ya se encuentra inactivo." });
        }

        try {
          await writeActivityLog(db.promise(), {
            usuario: currentUserId || null,
            modulo: "usuarios",
            accion: "desactivar_usuario",
            descripcion: `Se desactivo el usuario ${targetUser.nombre} (#${targetUserId}).`,
            entidad: "tusuarios",
            entidadId: targetUserId,
            nivel: "warning",
            ip: requestIp,
            metadata: {
              correo: targetUser.correo,
              estatusAnterior: targetUser.estatus,
              estatusNuevo: 0,
            },
          });
        } catch (logError) {
          console.log(logError);
        }

        res.json({ ok: true, deactivatedId: targetUserId, estatus: 0 });
      });
    });
  });

  return router;
};

module.exports = createUserRoutes;
