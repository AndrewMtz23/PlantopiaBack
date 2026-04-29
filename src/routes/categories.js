const express = require("express");
const { authenticateToken, requireAdmin } = require("../middleware/auth");
const { getRequestIp, writeActivityLog } = require("../utils/activityLog");

const createCategoryRoutes = (db) => {
  const router = express.Router();

  // GET: Todas las categorias (público para poder listar en frontend)
  router.get("/categorias", (req, res) => {
    db.query("SELECT * FROM tcategorias", (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Error al obtener categorias");
      }
      res.send(result);
    });
  });

  // POST: Crear categoria (Solo admin)
  router.post("/crearCategoria", authenticateToken, requireAdmin, (req, res) => {
    const { nombre, descripcion } = req.body;
    const requestIp = getRequestIp(req);
    db.query(
      "INSERT INTO tcategorias(nombre, descripcion) VALUES(?, ?)",
      [nombre, descripcion || ""],
      async (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).send("Error al crear categoria");
        }

        try {
          await writeActivityLog(db.promise(), {
            usuario: Number(req.auth?.idUsuario) || null,
            modulo: "categorias",
            accion: "crear_categoria",
            descripcion: `Se creo la categoria ${String(nombre).trim()}.`,
            entidad: "tcategorias",
            entidadId: result.insertId,
            nivel: "info",
            ip: requestIp,
            metadata: { nombre: String(nombre).trim(), descripcion: descripcion || "" },
          });
        } catch (logError) {
          console.log(logError);
        }

        res.send(result);
      }
    );
  });

  // PUT: Editar categoria (Solo admin)
  router.put("/editarCategoria", authenticateToken, requireAdmin, (req, res) => {
    const { id, nombre, descripcion } = req.body;
    const requestIp = getRequestIp(req);

    db.query("SELECT * FROM tcategorias WHERE id = ? LIMIT 1", [id], (findErr, rows) => {
      if (findErr) {
        console.log(findErr);
        return res.status(500).send("Error al validar categoria");
      }

      if (!rows.length) {
        return res.status(404).json({ error: "Categoria no encontrada." });
      }

      const previous = rows[0];

      db.query(
        "UPDATE tcategorias SET nombre=?, descripcion=? WHERE id=?",
        [nombre, descripcion || "", id],
        async (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).send("Error al editar categoria");
        }

        try {
          await writeActivityLog(db.promise(), {
            usuario: Number(req.auth?.idUsuario) || null,
            modulo: "categorias",
            accion: "editar_categoria",
            descripcion: `Se actualizo la categoria ${previous.nombre} (#${id}).`,
            entidad: "tcategorias",
            entidadId: Number(id),
            nivel: "info",
            ip: requestIp,
            metadata: {
              antes: previous,
              despues: { nombre: String(nombre).trim(), descripcion: descripcion || "" },
            },
          });
        } catch (logError) {
          console.log(logError);
        }

        res.send(result);
      }
      );
    });
  });

  // DELETE: Eliminar categoria (Solo admin)
  router.delete("/eliminarCategoria/:id", authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const requestIp = getRequestIp(req);

    db.query("SELECT * FROM tcategorias WHERE id = ? LIMIT 1", [id], (findErr, rows) => {
      if (findErr) {
        console.log(findErr);
        return res.status(500).send("Error al validar categoria");
      }

      if (!rows.length) {
        return res.status(404).json({ error: "Categoria no encontrada." });
      }

      const previous = rows[0];

      db.query("DELETE FROM tcategorias WHERE id = ?", [id], async (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).send("Error al eliminar categoria");
        }

        try {
          await writeActivityLog(db.promise(), {
            usuario: Number(req.auth?.idUsuario) || null,
            modulo: "categorias",
            accion: "eliminar_categoria",
            descripcion: `Se elimino la categoria ${previous.nombre} (#${id}).`,
            entidad: "tcategorias",
            entidadId: Number(id),
            nivel: "warning",
            ip: requestIp,
            metadata: previous,
          });
        } catch (logError) {
          console.log(logError);
        }

        res.send(result);
      });
    });
  });

  return router;
};

module.exports = createCategoryRoutes;
