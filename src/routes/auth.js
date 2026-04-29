const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const { normalizeEmail, validateLoginPayload, validateUserPayload } = require("../utils/authValidation");
const { comparePassword, hashPassword, isHashedPassword } = require("../utils/passwords");
const { signAuthToken } = require("../utils/jwt");
const { getRequestIp, writeActivityLog } = require("../utils/activityLog");
const { storeUserProfileImage } = require("../utils/imageStorage");

const createSessionPayload = (user) => ({
  idUsuario: user.id,
  tipo: user.tipo,
  nombre: user.nombre,
  correo: user.correo,
  fotoPerfil: user.fotoPerfil,
});

const createAuthRoutes = (db) => {
  const router = express.Router();

  router.post("/login", (req, res) => {
    const { correo = "", clave = "" } = req.body;
    const normalizedEmail = normalizeEmail(correo);
    const requestIp = getRequestIp(req);
    const validationError = validateLoginPayload({ correo, clave });

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    db.query(
      "SELECT id, tipo, nombre, correo, clave, estatus, fotoPerfil FROM tusuarios WHERE LOWER(correo) = ? LIMIT 1",
      [normalizedEmail],
      async (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ error: "Error en el servidor." });
        }

        if (result.length === 0 || Number(result[0].estatus) !== 1) {
          try {
            await writeActivityLog(db.promise(), {
              usuario: null,
              modulo: "auth",
              accion: "login_fallido",
              descripcion: `Intento de inicio de sesion fallido para ${normalizedEmail}.`,
              entidad: "tusuarios",
              entidadId: null,
              nivel: "warning",
              ip: requestIp,
              metadata: { correo: normalizedEmail, motivo: "usuario_inexistente_o_inactivo" },
            });
          } catch (logError) {
            console.log(logError);
          }

          return res.status(401).json({ error: "Correo o contrasena incorrectos." });
        }

        const user = result[0];
        const isValidPassword = await comparePassword(clave, user.clave);

        if (!isValidPassword) {
          try {
            await writeActivityLog(db.promise(), {
              usuario: user.id,
              modulo: "auth",
              accion: "login_fallido",
              descripcion: `Intento de inicio de sesion fallido para ${user.correo}.`,
              entidad: "tusuarios",
              entidadId: user.id,
              nivel: "warning",
              ip: requestIp,
              metadata: { correo: user.correo, motivo: "clave_incorrecta" },
            });
          } catch (logError) {
            console.log(logError);
          }

          return res.status(401).json({ error: "Correo o contrasena incorrectos." });
        }

        if (!isHashedPassword(user.clave)) {
          try {
            const hashedPassword = await hashPassword(clave);
            db.query("UPDATE tusuarios SET clave = ? WHERE id = ?", [hashedPassword, user.id]);
          } catch (hashError) {
            console.log(hashError);
          }
        }

        const session = createSessionPayload(user);
        const token = signAuthToken(session);

        try {
          await writeActivityLog(db.promise(), {
            usuario: user.id,
            modulo: "auth",
            accion: "login_exitoso",
            descripcion: `Inicio de sesion de ${user.nombre}.`,
            entidad: "tusuarios",
            entidadId: user.id,
            nivel: "info",
            ip: requestIp,
            metadata: { correo: user.correo, tipo: user.tipo },
          });
        } catch (logError) {
          console.log(logError);
        }

        return res.json({
          message: "Inicio de sesion exitoso.",
          token,
          session,
        });
      }
    );
  });

  router.post("/register", async (req, res) => {
    const requestIp = getRequestIp(req);
    const payload = {
      estatus: 1,
      tipo: 2,
      ...req.body,
      correo: normalizeEmail(req.body?.correo || ""),
    };

    const validationError = validateUserPayload(payload);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    try {
      const [existingUsers] = await db
        .promise()
        .query("SELECT id FROM tusuarios WHERE LOWER(correo) = ? LIMIT 1", [payload.correo]);

      if (existingUsers.length > 0) {
        return res.status(409).json({ error: "Ya existe una cuenta registrada con ese correo." });
      }

      const hashedPassword = await hashPassword(payload.clave);

      const [result] = await db.promise().query(
        `INSERT INTO tusuarios
          (estatus, tipo, clave, nombre, fechaNacimiento, genero, telefono, correo, domicilio)
        VALUES(?,?,?,?,?,?,?,?,?)`,
        [
          payload.estatus,
          payload.tipo,
          hashedPassword,
          payload.nombre.trim(),
          payload.fechaNacimiento,
          payload.genero,
          String(payload.telefono).replace(/\D/g, ""),
          payload.correo,
          payload.domicilio.trim(),
        ]
      );
      const fotoPerfil = await storeUserProfileImage({
        userId: result.insertId,
        name: payload.nombre.trim(),
      });

      await db.promise().query("UPDATE tusuarios SET fotoPerfil = ? WHERE id = ?", [
        fotoPerfil,
        result.insertId,
      ]);

      try {
        await writeActivityLog(db.promise(), {
          usuario: result.insertId,
          modulo: "auth",
          accion: "registro_usuario",
          descripcion: `Se registro el usuario ${payload.nombre.trim()} (${payload.correo}).`,
          entidad: "tusuarios",
          entidadId: result.insertId,
          nivel: "info",
          ip: requestIp,
          metadata: {
            correo: payload.correo,
            tipo: payload.tipo,
            estatus: payload.estatus,
            fotoPerfil,
          },
        });
      } catch (logError) {
        console.log(logError);
      }

      return res.status(201).json({
        message: "Usuario registrado con exito.",
        idUsuario: result.insertId,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "No se pudo registrar el usuario." });
    }
  });

  router.get("/me", authenticateToken, (req, res) => {
    db.query(
      "SELECT id, tipo, nombre, correo, estatus, fotoPerfil FROM tusuarios WHERE id = ? LIMIT 1",
      [req.auth.idUsuario],
      (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ error: "No se pudo validar la sesion." });
        }

        if (result.length === 0 || Number(result[0].estatus) !== 1) {
          return res.status(401).json({ error: "La sesion ya no es valida." });
        }

        return res.json({
          session: createSessionPayload(result[0]),
        });
      }
    );
  });

  return router;
};

module.exports = createAuthRoutes;
