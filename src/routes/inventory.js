const express = require("express");
const { authenticateToken, requireAdmin } = require("../middleware/auth");
const { getRequestIp, writeActivityLog } = require("../utils/activityLog");

const createInventoryRoutes = (db) => {
  const router = express.Router();
  const LOW_STOCK_THRESHOLD = 5;

  router.post("/crearInventario", authenticateToken, requireAdmin, (req, res) => {
    const { estatus, sucursal, proveedor, producto, cantidad } = req.body;
    const requestIp = getRequestIp(req);

    db.promise()
      .query(
        "INSERT INTO tinventario(estatus,sucursal,proveedor,producto,cantidad) VALUES(?,?,?,?,?)",
        [estatus, sucursal, proveedor, producto, cantidad]
      )
      .then(async ([result]) => {
        await writeActivityLog(db.promise(), {
          usuario: Number(req.auth?.idUsuario) || null,
          modulo: "inventarios",
          accion: "crear_inventario",
          descripcion: `Se creo un registro de inventario para producto #${producto}.`,
          entidad: "tinventario",
          entidadId: result.insertId,
          nivel: "info",
          ip: requestIp,
          metadata: { estatus, sucursal, proveedor, producto, cantidad },
        });

        res.send(result);
      })
      .catch((err) => {
        console.log(err);
        return res.status(500).send("Error al crear el inventario");
      });
  });

  router.get("/verInventario", authenticateToken, requireAdmin, (req, res) => {
    db.query("SELECT * FROM tinventario", (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Error al obtener inventario");
      }

      res.send(result);
    });
  });

  router.get("/inventarioCritico", authenticateToken, requireAdmin, (req, res) => {
    const query = `
      SELECT
        ti.id,
        ti.estatus,
        ti.sucursal,
        ti.proveedor,
        ti.producto,
        ti.cantidad,
        tp.nombre AS producto_nombre,
        ts.nombre AS sucursal_nombre,
        tpr.marca AS proveedor_nombre
      FROM tinventario ti
      LEFT JOIN tproductos tp ON ti.producto = tp.id
      LEFT JOIN tsucursales ts ON ti.sucursal = ts.id
      LEFT JOIN tproveedores tpr ON ti.proveedor = tpr.id
      WHERE ti.estatus = 1 AND ti.cantidad <= ?
      ORDER BY ti.cantidad ASC, tp.nombre ASC
      LIMIT 8
    `;

    db.query(query, [LOW_STOCK_THRESHOLD], (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ error: "Error al obtener inventario critico." });
      }

      res.json({
        threshold: LOW_STOCK_THRESHOLD,
        items: result,
      });
    });
  });

  router.put("/editarInventario", authenticateToken, requireAdmin, (req, res) => {
    const { id, estatus, sucursal, proveedor, producto, cantidad } = req.body;
    const requestIp = getRequestIp(req);

    db.promise()
      .query("SELECT * FROM tinventario WHERE id = ? LIMIT 1", [id])
      .then(async ([rows]) => {
        if (!rows.length) {
          return res.status(404).json({ error: "Inventario no encontrado." });
        }

        const previous = rows[0];
        const [result] = await db.promise().query(
          "UPDATE tinventario SET estatus=?,sucursal=?,proveedor=?,producto=?,cantidad=? WHERE id=?",
          [estatus, sucursal, proveedor, producto, cantidad, id]
        );

        await writeActivityLog(db.promise(), {
          usuario: Number(req.auth?.idUsuario) || null,
          modulo: "inventarios",
          accion: "editar_inventario",
          descripcion: `Se actualizo el inventario #${id}.`,
          entidad: "tinventario",
          entidadId: Number(id),
          nivel: "info",
          ip: requestIp,
          metadata: {
            antes: previous,
            despues: { estatus, sucursal, proveedor, producto, cantidad },
          },
        });

        res.send(result);
      })
      .catch((err) => {
        console.log(err);
        return res.status(500).send("Error al editar el inventario");
      });
  });

  router.delete("/eliminarInventario/:id", authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const requestIp = getRequestIp(req);

    db.promise()
      .query("SELECT * FROM tinventario WHERE id = ? LIMIT 1", [id])
      .then(async ([rows]) => {
        if (!rows.length) {
          return res.status(404).json({ error: "Inventario no encontrado." });
        }

        const previous = rows[0];
        const [result] = await db.promise().query("DELETE FROM tinventario WHERE id = ?", [id]);

        await writeActivityLog(db.promise(), {
          usuario: Number(req.auth?.idUsuario) || null,
          modulo: "inventarios",
          accion: "eliminar_inventario",
          descripcion: `Se elimino el inventario #${id}.`,
          entidad: "tinventario",
          entidadId: Number(id),
          nivel: "warning",
          ip: requestIp,
          metadata: previous,
        });

        res.send(result);
      })
      .catch((err) => {
        console.log(err);
        return res.status(500).send("Error al eliminar el registro");
      });
  });

  router.put("/actualizarInventario", authenticateToken, requireAdmin, (req, res) => {
    const { producto, cantidad, sucursal } = req.body;
    const requestIp = getRequestIp(req);

    db.promise()
      .query("SELECT * FROM tinventario WHERE producto = ? AND sucursal = ? LIMIT 1", [producto, sucursal])
      .then(async ([rows]) => {
        const previous = rows[0] || null;
        const [result] = await db.promise().query(
          "UPDATE tinventario SET cantidad = cantidad - ? WHERE producto = ? AND sucursal = ?",
          [cantidad, producto, sucursal]
        );

        await writeActivityLog(db.promise(), {
          usuario: Number(req.auth?.idUsuario) || null,
          modulo: "inventarios",
          accion: "ajustar_inventario",
          descripcion: `Se desconto inventario del producto #${producto} en sucursal #${sucursal}.`,
          entidad: "tinventario",
          entidadId: previous?.id || null,
          nivel: "info",
          ip: requestIp,
          metadata: {
            inventarioAnterior: previous,
            cantidadDescontada: cantidad,
            producto,
            sucursal,
          },
        });

        res.send(result);
      })
      .catch((err) => {
        console.log(err);
        return res.status(500).send("Error al actualizar el inventario");
      });
  });

  return router;
};

module.exports = createInventoryRoutes;
