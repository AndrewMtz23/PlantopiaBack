const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const { normalizeEmail, validateLoginPayload, validateUserPayload } = require("../utils/authValidation");
const { comparePassword, hashPassword, isHashedPassword } = require("../utils/passwords");
const { signAuthToken } = require("../utils/jwt");

const createSessionPayload = (user) => ({
  idUsuario: user.id,
  tipo: user.tipo,
  nombre: user.nombre,
  correo: user.correo,
});

const createAuthRoutes = (db) => {
  const router = express.Router();

  router.post("/login", (req, res) => {
    const { correo = "", clave = "" } = req.body;
    const validationError = validateLoginPayload({ correo, clave });

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    db.query(
      "SELECT id, tipo, nombre, correo, clave, estatus FROM tusuarios WHERE LOWER(correo) = ? LIMIT 1",
      [normalizeEmail(correo)],
      async (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ error: "Error en el servidor." });
        }

        if (result.length === 0 || Number(result[0].estatus) !== 1) {
          return res.status(401).json({ error: "Correo o contrasena incorrectos." });
        }

        const user = result[0];
        const isValidPassword = await comparePassword(clave, user.clave);

        if (!isValidPassword) {
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

        return res.json({
          message: "Inicio de sesion exitoso.",
          token,
          session,
        });
      }
    );
  });

  router.post("/register", async (req, res) => {
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
      "SELECT id, tipo, nombre, correo, estatus FROM tusuarios WHERE id = ? LIMIT 1",
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
