const express = require("express");
const { authenticateToken, authorizeUserAccess } = require("../middleware/auth");
const { getRequestIp, writeActivityLog } = require("../utils/activityLog");

const createCommerceRoutes = (db) => {
  const router = express.Router();
  const authorizeCommerceUser = authorizeUserAccess(
    (req) => req.params.usuario || req.body.usuario
  );

  router.get("/obtenerProductos", (req, res) => {
    db.query(
      "SELECT ti.*, tp.nombre, tp.detalles, tp.categoria, tp.precioVenta, tp.imagen, tp.imagenUrl, ts.id as sucursal_id, tp.id as producto_id FROM tinventario ti JOIN tproductos tp ON ti.producto = tp.id JOIN tsucursales ts ON ti.sucursal = ts.id WHERE ti.cantidad > 0 and ti.estatus =1",
      (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).send("Error al obtener los productos del inventario");
        }

        res.send(result);
      }
    );
  });

  router.post("/crearCarrito", authenticateToken, authorizeCommerceUser, (req, res) => {
    const { inventario, usuario, cantidad, subtotal } = req.body;

    db.query(
      "INSERT INTO tpedido(inventario,usuario,cantidad,subtotal) VALUES(?,?,?,?)",
      [inventario, usuario, cantidad, subtotal],
      (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).send("Error al crear el carrito");
        }

        res.send(result);
      }
    );
  });

  router.get("/verCarrito/:usuario", authenticateToken, authorizeCommerceUser, (req, res) => {
    const { usuario } = req.params;

    db.query(
      "select tpe.*, ti.sucursal, ti.producto, tp.nombre, tp.detalles, tp.precioVenta, tp.imagen, tp.imagenUrl, tu.nombre as usuario_nombre, tu.genero, tu.telefono, tu.correo, tu.domicilio, ti.cantidad as inventario_cant, ti.id as inventario_id, tu.id as usuario_id, tp.id as producto_id from tpedido tpe join tinventario ti on tpe.inventario = ti.id join tusuarios tu on tpe.usuario = tu.id join tproductos tp on ti.producto = tp.id where usuario=?",
      [usuario],
      (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).send("Error en el servidor");
        }

        res.send(result);
      }
    );
  });

  router.put("/editarCarrito", authenticateToken, (req, res) => {
    const { id, cantidad, subtotal } = req.body;
    const isAdmin = Number(req.auth?.tipo) === 1;
    const currentUserId = Number(req.auth?.idUsuario);

    const applyUpdate = () => {
      db.query(
        "UPDATE tpedido SET cantidad=?,subtotal=? WHERE id=?",
        [cantidad, subtotal, id],
        (err, result) => {
          if (err) {
            console.log(err);
            return res.status(500).send("Error al editar el carrito");
          }

          res.send(result);
        }
      );
    };

    if (isAdmin) {
      return applyUpdate();
    }

    db.query("SELECT usuario FROM tpedido WHERE id = ? LIMIT 1", [id], (err, rows) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Error al validar el carrito");
      }

      if (rows.length === 0 || Number(rows[0].usuario) !== currentUserId) {
        return res.status(403).json({ error: "No puedes editar un carrito que no te pertenece." });
      }

      return applyUpdate();
    });
  });

  router.delete("/eliminarCarrito/:id", authenticateToken, (req, res) => {
    const { id } = req.params;
    const isAdmin = Number(req.auth?.tipo) === 1;
    const currentUserId = Number(req.auth?.idUsuario);

    const applyDelete = () => {
      db.query("DELETE FROM tpedido WHERE id = ?", [id], (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).send("Error al eliminar el registro");
        }

        res.send(result);
      });
    };

    if (isAdmin) {
      return applyDelete();
    }

    db.query("SELECT usuario FROM tpedido WHERE id = ? LIMIT 1", [id], (err, rows) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Error al validar el carrito");
      }

      if (rows.length === 0 || Number(rows[0].usuario) !== currentUserId) {
        return res.status(403).json({ error: "No puedes eliminar un carrito que no te pertenece." });
      }

      return applyDelete();
    });
  });

  router.delete("/vaciarCarrito/:usuario", authenticateToken, authorizeCommerceUser, (req, res) => {
    const { usuario } = req.params;

    db.query("DELETE FROM tpedido WHERE usuario = ?", [usuario], (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Error al eliminar el registro");
      }

      res.send(result);
    });
  });

  router.post("/crearLista", authenticateToken, authorizeCommerceUser, (req, res) => {
    const { inventario, usuario } = req.body;

    db.query(
      "INSERT INTO tlista(inventario,usuario) VALUES(?,?)",
      [inventario, usuario],
      (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).send("Error al crear el elemento de lista");
        }

        res.send(result);
      }
    );
  });

  router.get("/verAgregados/:usuario", authenticateToken, authorizeCommerceUser, (req, res) => {
    const { usuario } = req.params;

    db.query("SELECT * FROM tlista WHERE usuario = ?", [usuario], (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Error en el servidor");
      }

      const idsEnLista = result.map((item) => item.inventario);
      res.send(idsEnLista);
    });
  });

  router.get("/verLista/:usuario", authenticateToken, authorizeCommerceUser, (req, res) => {
    const { usuario } = req.params;

    db.query(
      "select tl.*, ti.sucursal, ti.producto, ti.cantidad, tp.nombre, tp.detalles, tp.categoria, tp.precioVenta, tp.imagen, tp.imagenUrl, ti.id as inventario_id, tu.id as usuario_id, ts.id as sucursal_id, tp.id as producto_id from tlista tl join tinventario ti on tl.inventario = ti.id join tusuarios tu on tl.usuario = tu.id JOIN tproductos tp ON ti.producto = tp.id JOIN tsucursales ts ON ti.sucursal = ts.id where usuario=?",
      [usuario],
      (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).send("Error en el servidor");
        }

        res.send(result);
      }
    );
  });

  router.delete("/eliminarLista/:id", authenticateToken, (req, res) => {
    const { id } = req.params;
    const isAdmin = Number(req.auth?.tipo) === 1;
    const currentUserId = Number(req.auth?.idUsuario);

    const applyDelete = () => {
      db.query("DELETE FROM tlista WHERE id = ?", [id], (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).send("Error al eliminar el registro");
        }

        res.send(result);
      });
    };

    if (isAdmin) {
      return applyDelete();
    }

    db.query("SELECT usuario FROM tlista WHERE id = ? LIMIT 1", [id], (err, rows) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Error al validar la lista");
      }

      if (rows.length === 0 || Number(rows[0].usuario) !== currentUserId) {
        return res.status(403).json({ error: "No puedes modificar una lista que no te pertenece." });
      }

      return applyDelete();
    });
  });

  router.post("/crearVenta", authenticateToken, authorizeCommerceUser, (req, res) => {
    const { usuario, pago = null, producto, cantidad, total } = req.body;

    db.query(
      "INSERT INTO tventas(usuario, pago, producto, cantidad, total) VALUES(?,?,?,?,?)",
      [usuario, pago, producto, cantidad, total],
      (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).send("Error al procesar la solicitud");
        }

        res.send(result);
      }
    );
  });

  router.get("/verVenta/:usuario", authenticateToken, authorizeCommerceUser, (req, res) => {
    const { usuario } = req.params;

    db.query(
      "select tv.*, tp.nombre, tp.imagen, tp.imagenUrl, tp.detalles, tp.id as producto_id from tventas tv join tproductos tp on tv.producto = tp.id where usuario = ?;",
      [usuario],
      (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).send("Error en el servidor");
        }

        res.send(result);
      }
    );
  });

  router.post("/procesarCompra", authenticateToken, authorizeCommerceUser, async (req, res) => {
    const { usuario, metodo = "efectivo", referencia = null, proveedor = null } = req.body;
    let connection;
    const requestIp = getRequestIp(req);

    if (!usuario) {
      return res.status(400).json({ error: "El usuario es obligatorio." });
    }

    try {
      connection = await db.promise().getConnection();
      await connection.beginTransaction();

      const [cartItems] = await connection.query(
        `select
          tpe.*,
          ti.sucursal,
          ti.producto,
          tp.nombre,
          tp.detalles,
          tp.precioVenta,
          tp.imagen,
          tp.imagenUrl,
          tu.nombre as usuario_nombre,
          tu.genero,
          tu.telefono,
          tu.correo,
          tu.domicilio,
          ti.cantidad as inventario_cant,
          ti.id as inventario_id,
          tu.id as usuario_id,
          tp.id as producto_id
        from tpedido tpe
        join tinventario ti on tpe.inventario = ti.id
        join tusuarios tu on tpe.usuario = tu.id
        join tproductos tp on ti.producto = tp.id
        where tpe.usuario = ?
        for update`,
        [usuario]
      );

      if (cartItems.length === 0) {
        await connection.rollback();
        return res.status(400).json({ error: "El carrito esta vacio." });
      }

      const insufficientStockItem = cartItems.find(
        (item) => item.cantidad > item.inventario_cant
      );

      if (insufficientStockItem) {
        await connection.rollback();
        return res.status(409).json({
          error: `No hay stock suficiente para ${insufficientStockItem.nombre}.`,
        });
      }

      const subtotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
      const iva = Number((subtotal * 0.16).toFixed(2));
      const envio = 50;
      const total = Number((subtotal + iva + envio).toFixed(2));

      const [paymentResult] = await connection.query(
        `INSERT INTO tpagos
          (usuario, metodo, estado, referencia, subtotal, iva, envio, total, proveedor, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          usuario,
          String(metodo || "efectivo").trim().toLowerCase(),
          "pagado",
          referencia ? String(referencia).trim() : null,
          subtotal,
          iva,
          envio,
          total,
          proveedor ? String(proveedor).trim() : null,
          JSON.stringify({
            productos: cartItems.length,
            origen: "procesarCompra",
          }),
        ]
      );

      const pagoId = paymentResult.insertId;

      for (const item of cartItems) {
        await connection.query(
          "INSERT INTO tventas(usuario, pago, producto, cantidad, total) VALUES(?,?,?,?,?)",
          [usuario, pagoId, item.producto_id, item.cantidad, item.subtotal]
        );

        await connection.query(
          "UPDATE tinventario SET cantidad = cantidad - ? WHERE id = ?",
          [item.cantidad, item.inventario_id]
        );
      }

      await writeActivityLog(connection, {
        usuario,
        modulo: "pagos",
        accion: "compra_procesada",
        descripcion: `Pago ${pagoId} procesado con ${cartItems.length} producto(s).`,
        entidad: "tpagos",
        entidadId: pagoId,
        nivel: "info",
        ip: requestIp,
        metadata: {
          metodo,
          referencia,
          subtotal,
          iva,
          envio,
          total,
        },
      });

      await connection.query("DELETE FROM tpedido WHERE usuario = ?", [usuario]);
      await connection.commit();

      res.json({
        message: "Compra procesada correctamente.",
        items: cartItems,
        pagoId,
        total,
      });
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      console.error("Error al procesar la compra:", error);

      try {
        await writeActivityLog(db.promise(), {
          usuario,
          modulo: "pagos",
          accion: "compra_fallida",
          descripcion: "Fallo al procesar la compra.",
          entidad: "tpagos",
          entidadId: null,
          nivel: "error",
          ip: requestIp,
          metadata: {
            metodo,
            referencia,
            error: error.message,
          },
        });
      } catch (logError) {
        console.error("Error al registrar el log de compra fallida:", logError);
      }

      res.status(500).json({ error: "Error al procesar la compra." });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  });

  return router;
};

module.exports = createCommerceRoutes;
