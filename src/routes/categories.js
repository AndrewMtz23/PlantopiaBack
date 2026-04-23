const express = require("express");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

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
    db.query(
      "INSERT INTO tcategorias(nombre, descripcion) VALUES(?, ?)",
      [nombre, descripcion || ""],
      (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).send("Error al crear categoria");
        }
        res.send(result);
      }
    );
  });

  // PUT: Editar categoria (Solo admin)
  router.put("/editarCategoria", authenticateToken, requireAdmin, (req, res) => {
    const { id, nombre, descripcion } = req.body;
    db.query(
      "UPDATE tcategorias SET nombre=?, descripcion=? WHERE id=?",
      [nombre, descripcion || "", id],
      (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).send("Error al editar categoria");
        }
        res.send(result);
      }
    );
  });

  // DELETE: Eliminar categoria (Solo admin)
  router.delete("/eliminarCategoria/:id", authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    db.query("DELETE FROM tcategorias WHERE id = ?", [id], (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Error al eliminar categoria");
      }
      res.send(result);
    });
  });

  return router;
};

module.exports = createCategoryRoutes;
