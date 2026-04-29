const express = require("express");
const { authenticateToken, requireAdmin } = require("../middleware/auth");
const { normalizeEmail, validateUserPayload } = require("../utils/authValidation");
const { comparePassword, hashPassword } = require("../utils/passwords");
const { getRequestIp, writeActivityLog } = require("../utils/activityLog");
const { handleProfileImageUpload } = require("../middleware/upload");
const { cleanupTempFile, storeUserProfileImage } = require("../utils/imageStorage");

const createUserRoutes = (db) => {
  const router = express.Router();
  const profileSelectFields =
    "id, estatus, tipo, nombre, fechaNacimiento, genero, telefono, correo, domicilio, ciudad, estadoDireccion, codigoPostal, referenciasDomicilio, fotoPerfil";

  router.post("/crearUsuario", authenticateToken, requireAdmin, handleProfileImageUpload, async (req, res) => {
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
      await cleanupTempFile(req.file);
      return res.status(400).json({ error: validationError });
    }

    try {
      const [existingUsers] = await db
        .promise()
        .query("SELECT id FROM tusuarios WHERE LOWER(correo) = ? LIMIT 1", [normalizedPayload.correo]);

      if (existingUsers.length > 0) {
        await cleanupTempFile(req.file);
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

      const fotoPerfil = await storeUserProfileImage({
        userId: result.insertId,
        name: nombre.trim(),
        tempFilePath: req.file?.path,
        originalName: req.file?.originalname,
      });

      await db.promise().query("UPDATE tusuarios SET fotoPerfil = ? WHERE id = ?", [
        fotoPerfil,
        result.insertId,
      ]);

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
          fotoPerfil,
        },
      });

      res.send({ ...result, fotoPerfil });
    } catch (error) {
      await cleanupTempFile(req.file);
      console.log(error);
      return res.status(500).json({ error: "Error al crear el usuario." });
    }
  });

  router.get("/verUsuario", authenticateToken, requireAdmin, (req, res) => {
    db.query(
      "SELECT id, estatus, tipo, nombre, fechaNacimiento, genero, telefono, correo, domicilio, fotoPerfil FROM tusuarios",
      (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Error al obtener usuarios");
      }

      res.send(result);
      }
    );
  });

  router.get("/perfil", authenticateToken, async (req, res) => {
    try {
      const [rows] = await db.promise().query(
        `SELECT ${profileSelectFields} FROM tusuarios WHERE id = ? LIMIT 1`,
        [req.auth.idUsuario]
      );

      if (!rows.length || Number(rows[0].estatus) !== 1) {
        return res.status(404).json({ error: "Usuario no encontrado." });
      }

      res.json({ usuario: rows[0] });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "No se pudo obtener el perfil." });
    }
  });

  router.put("/perfil", authenticateToken, handleProfileImageUpload, async (req, res) => {
    const {
      nombre,
      fechaNacimiento,
      genero,
      telefono,
      correo,
      domicilio,
      ciudad = "",
      estadoDireccion = "",
      codigoPostal = "",
      referenciasDomicilio = "",
    } = req.body;
    const normalizedEmail = normalizeEmail(correo || "");
    const normalizedPostalCode = String(codigoPostal || "").replace(/\D/g, "");
    const userId = Number(req.auth.idUsuario);
    const requestIp = getRequestIp(req);

    if (!nombre || String(nombre).trim().length < 3) {
      await cleanupTempFile(req.file);
      return res.status(400).json({ error: "El nombre debe tener al menos 3 caracteres." });
    }

    if (!fechaNacimiento) {
      await cleanupTempFile(req.file);
      return res.status(400).json({ error: "La fecha de nacimiento es obligatoria." });
    }

    if (!genero) {
      await cleanupTempFile(req.file);
      return res.status(400).json({ error: "Selecciona un genero valido." });
    }

    if (!telefono || String(telefono).replace(/\D/g, "").length < 10) {
      await cleanupTempFile(req.file);
      return res.status(400).json({ error: "El telefono debe tener al menos 10 digitos." });
    }

    if (!normalizedEmail) {
      await cleanupTempFile(req.file);
      return res.status(400).json({ error: "El correo es obligatorio." });
    }

    if (!domicilio || String(domicilio).trim().length < 8) {
      await cleanupTempFile(req.file);
      return res.status(400).json({ error: "El domicilio debe tener al menos 8 caracteres." });
    }

    if (normalizedPostalCode && (normalizedPostalCode.length < 5 || normalizedPostalCode.length > 10)) {
      await cleanupTempFile(req.file);
      return res.status(400).json({ error: "El codigo postal debe tener entre 5 y 10 digitos." });
    }

    try {
      const [existingUsers] = await db.promise().query(
        "SELECT id FROM tusuarios WHERE LOWER(correo) = ? AND id <> ? LIMIT 1",
        [normalizedEmail, userId]
      );

      if (existingUsers.length > 0) {
        await cleanupTempFile(req.file);
        return res.status(409).json({ error: "Ya existe otro usuario con ese correo." });
      }

      const [targetRows] = await db.promise().query(
        "SELECT id, nombre, correo, estatus, tipo, fotoPerfil FROM tusuarios WHERE id = ? LIMIT 1",
        [userId]
      );

      if (!targetRows.length || Number(targetRows[0].estatus) !== 1) {
        await cleanupTempFile(req.file);
        return res.status(404).json({ error: "Usuario no encontrado." });
      }

      const previousUser = targetRows[0];
      let fotoPerfil = previousUser.fotoPerfil;

      await db.promise().query(
        `UPDATE tusuarios
         SET nombre=?,fechaNacimiento=?,genero=?,telefono=?,correo=?,domicilio=?,ciudad=?,estadoDireccion=?,codigoPostal=?,referenciasDomicilio=?
         WHERE id=?`,
        [
          String(nombre).trim(),
          fechaNacimiento,
          genero,
          String(telefono).replace(/\D/g, ""),
          normalizedEmail,
          String(domicilio).trim(),
          String(ciudad || "").trim() || null,
          String(estadoDireccion || "").trim() || null,
          normalizedPostalCode || null,
          String(referenciasDomicilio || "").trim() || null,
          userId,
        ]
      );

      if (req.file) {
        fotoPerfil = await storeUserProfileImage({
          userId,
          name: String(nombre).trim(),
          tempFilePath: req.file.path,
          originalName: req.file.originalname,
        });

        await db.promise().query("UPDATE tusuarios SET fotoPerfil = ? WHERE id = ?", [
          fotoPerfil,
          userId,
        ]);
      }

      const [updatedRows] = await db.promise().query(
        `SELECT ${profileSelectFields} FROM tusuarios WHERE id = ? LIMIT 1`,
        [userId]
      );

      await writeActivityLog(db.promise(), {
        usuario: userId,
        modulo: "usuarios",
        accion: "actualizar_perfil",
        descripcion: `El usuario ${previousUser.nombre} actualizo su perfil.`,
        entidad: "tusuarios",
        entidadId: userId,
        nivel: "info",
        ip: requestIp,
        metadata: {
          antes: {
            nombre: previousUser.nombre,
            correo: previousUser.correo,
          },
          despues: {
            nombre: String(nombre).trim(),
            correo: normalizedEmail,
            ciudad: String(ciudad || "").trim() || null,
            estadoDireccion: String(estadoDireccion || "").trim() || null,
            codigoPostal: normalizedPostalCode || null,
          },
          actualizoFoto: Boolean(req.file),
        },
      });

      const usuario = updatedRows[0];
      res.json({
        ok: true,
        usuario,
        session: {
          idUsuario: usuario.id,
          tipo: usuario.tipo,
          nombre: usuario.nombre,
          correo: usuario.correo,
          fotoPerfil: usuario.fotoPerfil,
        },
      });
    } catch (error) {
      await cleanupTempFile(req.file);
      console.log(error);
      return res.status(500).json({ error: "No se pudo actualizar el perfil." });
    }
  });

  router.put("/perfil/password", authenticateToken, async (req, res) => {
    const { claveActual = "", nuevaClave = "", confirmarClave = "" } = req.body;
    const userId = Number(req.auth.idUsuario);
    const requestIp = getRequestIp(req);

    if (!claveActual || !nuevaClave || !confirmarClave) {
      return res.status(400).json({ error: "Completa todos los campos de contrasena." });
    }

    if (String(nuevaClave).length < 8) {
      return res.status(400).json({ error: "La nueva contrasena debe tener al menos 8 caracteres." });
    }

    if (nuevaClave !== confirmarClave) {
      return res.status(400).json({ error: "La confirmacion no coincide con la nueva contrasena." });
    }

    if (claveActual === nuevaClave) {
      return res.status(400).json({ error: "La nueva contrasena debe ser diferente a la actual." });
    }

    try {
      const [rows] = await db.promise().query(
        "SELECT id, nombre, correo, clave, estatus FROM tusuarios WHERE id = ? LIMIT 1",
        [userId]
      );

      if (!rows.length || Number(rows[0].estatus) !== 1) {
        return res.status(404).json({ error: "Usuario no encontrado." });
      }

      const user = rows[0];
      const isCurrentPasswordValid = await comparePassword(claveActual, user.clave);

      if (!isCurrentPasswordValid) {
        return res.status(401).json({ error: "La contrasena actual no es correcta." });
      }

      const hashedPassword = await hashPassword(nuevaClave);
      await db.promise().query("UPDATE tusuarios SET clave = ? WHERE id = ?", [
        hashedPassword,
        userId,
      ]);

      await writeActivityLog(db.promise(), {
        usuario: userId,
        modulo: "usuarios",
        accion: "cambiar_contrasena",
        descripcion: `El usuario ${user.nombre} cambio su contrasena.`,
        entidad: "tusuarios",
        entidadId: userId,
        nivel: "info",
        ip: requestIp,
        metadata: {
          correo: user.correo,
        },
      });

      res.json({ ok: true, message: "Contrasena actualizada correctamente." });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "No se pudo cambiar la contrasena." });
    }
  });

  router.get("/verUsuario/:id", authenticateToken, (req, res) => {
    const { id } = req.params;
    const isAdmin = Number(req.auth?.tipo) === 1;

    if (!isAdmin && Number(id) !== Number(req.auth?.idUsuario)) {
      return res.status(403).json({ error: "No puedes consultar otro usuario." });
    }

    db.query(
      "SELECT id, estatus, tipo, nombre, fechaNacimiento, genero, telefono, correo, domicilio, fotoPerfil FROM tusuarios WHERE id = ?",
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

  router.put("/editarUsuario", authenticateToken, requireAdmin, handleProfileImageUpload, async (req, res) => {
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
      await cleanupTempFile(req.file);
      return res.status(400).json({ error: "El nombre debe tener al menos 3 caracteres." });
    }

    if (!normalizedEmail) {
      await cleanupTempFile(req.file);
      return res.status(400).json({ error: "El correo es obligatorio." });
    }

    try {
      const [existingUsers] = await db.promise().query(
        "SELECT id FROM tusuarios WHERE LOWER(correo) = ? AND id <> ? LIMIT 1",
        [normalizedEmail, id]
      );

      if (existingUsers.length > 0) {
        await cleanupTempFile(req.file);
        return res.status(409).json({ error: "Ya existe otro usuario con ese correo." });
      }

      const [targetRows] = await db.promise().query(
        "SELECT id, nombre, correo, estatus, tipo, fotoPerfil FROM tusuarios WHERE id = ? LIMIT 1",
        [id]
      );

      if (!targetRows.length) {
        await cleanupTempFile(req.file);
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
      let fotoPerfil = previousUser.fotoPerfil;

      if (req.file) {
        fotoPerfil = await storeUserProfileImage({
          userId: id,
          name: nombre.trim(),
          tempFilePath: req.file.path,
          originalName: req.file.originalname,
        });

        await db.promise().query("UPDATE tusuarios SET fotoPerfil = ? WHERE id = ?", [
          fotoPerfil,
          id,
        ]);
      }

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
          actualizoFoto: Boolean(req.file),
        },
      });

      res.send({ ...result, fotoPerfil });
    } catch (error) {
      await cleanupTempFile(req.file);
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
