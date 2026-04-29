const express = require("express");
const { authenticateToken, authorizeUserAccess } = require("../middleware/auth");
const { getRequestIp, writeActivityLog } = require("../utils/activityLog");

const createCommerceRoutes = (db) => {
  const router = express.Router();
  const LOW_STOCK_THRESHOLD = 5;
  const normalizeDeliveryAddress = (payload = {}) => ({
    nombre: String(payload.nombre || "").trim(),
    telefono: String(payload.telefono || "").replace(/\D/g, ""),
    correo: String(payload.correo || "").trim().toLowerCase(),
    domicilio: String(payload.domicilio || "").trim(),
    ciudad: String(payload.ciudad || "").trim(),
    estadoDireccion: String(payload.estadoDireccion || "").trim(),
    codigoPostal: String(payload.codigoPostal || "").replace(/\D/g, ""),
    referenciasDomicilio: String(payload.referenciasDomicilio || "").trim(),
  });
  const validateDeliveryAddress = (address) => {
    if (!address.nombre || address.nombre.length < 3) {
      return "El nombre de entrega debe tener al menos 3 caracteres.";
    }

    if (!address.telefono || address.telefono.length < 10) {
      return "El telefono de entrega debe tener al menos 10 digitos.";
    }

    if (!address.correo) {
      return "El correo de entrega es obligatorio.";
    }

    if (!address.domicilio || address.domicilio.length < 8) {
      return "La calle y numero de entrega deben ser mas especificos.";
    }

    if (!address.ciudad || address.ciudad.length < 2) {
      return "La ciudad de entrega es obligatoria.";
    }

    if (!address.estadoDireccion || address.estadoDireccion.length < 2) {
      return "El estado de entrega es obligatorio.";
    }

    if (!address.codigoPostal || address.codigoPostal.length < 5 || address.codigoPostal.length > 10) {
      return "El codigo postal de entrega debe tener entre 5 y 10 digitos.";
    }

    return null;
  };
  const authorizeCommerceUser = authorizeUserAccess(
    (req) => req.params.usuario || req.body.usuario
  );
  const logCommerceAction = async (req, payload) => {
    try {
      await writeActivityLog(db.promise(), {
        ...payload,
        usuario: Number(payload.usuario ?? req.auth?.idUsuario) || null,
        ip: getRequestIp(req),
      });
    } catch (logError) {
      console.log(logError);
    }
  };
  const attachProductImages = async (products = []) => {
    if (!products.length) {
      return products;
    }

    const productIds = [
      ...new Set(products.map((product) => Number(product.producto_id || product.producto)).filter(Boolean)),
    ];

    if (!productIds.length) {
      return products;
    }

    const [images] = await db.promise().query(
      `SELECT id, producto, ruta, nombreOriginal, esPrincipal, orden
       FROM tproducto_imagenes
       WHERE producto IN (?)
       ORDER BY esPrincipal DESC, orden ASC, id ASC`,
      [productIds]
    );

    const imagesByProduct = images.reduce((acc, image) => {
      acc[Number(image.producto)] = acc[Number(image.producto)] || [];
      acc[Number(image.producto)].push(image);
      return acc;
    }, {});

    return products.map((product) => ({
      ...product,
      imagenes: imagesByProduct[Number(product.producto_id || product.producto)] || [],
    }));
  };

  router.get("/obtenerProductos", async (req, res) => {
    try {
      const [result] = await db.promise().query(
      "SELECT ti.*, tp.nombre, tp.detalles, tp.categoria, tp.precioVenta, tp.imagen, tp.imagenUrl, ts.id as sucursal_id, tp.id as producto_id FROM tinventario ti JOIN tproductos tp ON ti.producto = tp.id JOIN tsucursales ts ON ti.sucursal = ts.id WHERE ti.cantidad > 0 and ti.estatus =1",
      );

      res.send(await attachProductImages(result));
    } catch (error) {
      console.log(error);
      return res.status(500).send("Error al obtener los productos del inventario");
    }
  });

  router.post("/crearCarrito", authenticateToken, authorizeCommerceUser, (req, res) => {
    const { inventario, usuario, cantidad, subtotal } = req.body;

    db.query(
      "INSERT INTO tpedido(inventario,usuario,cantidad,subtotal) VALUES(?,?,?,?)",
      [inventario, usuario, cantidad, subtotal],
      async (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).send("Error al crear el carrito");
        }

        await logCommerceAction(req, {
          usuario,
          modulo: "carrito",
          accion: "agregar_carrito",
          descripcion: `Se agrego inventario #${inventario} al carrito del usuario #${usuario}.`,
          entidad: "tpedido",
          entidadId: result.insertId,
          nivel: "info",
          metadata: { inventario, cantidad, subtotal },
        });

        res.send(result);
      }
    );
  });

  router.get("/verCarrito/:usuario", authenticateToken, authorizeCommerceUser, (req, res) => {
    const { usuario } = req.params;

    db.query(
      "select tpe.*, ti.sucursal, ti.producto, tp.nombre, tp.detalles, tp.precioVenta, tp.imagen, tp.imagenUrl, tu.nombre as usuario_nombre, tu.genero, tu.telefono, tu.correo, tu.domicilio, tu.ciudad, tu.estadoDireccion, tu.codigoPostal, tu.referenciasDomicilio, ti.cantidad as inventario_cant, ti.id as inventario_id, tu.id as usuario_id, tp.id as producto_id from tpedido tpe join tinventario ti on tpe.inventario = ti.id join tusuarios tu on tpe.usuario = tu.id join tproductos tp on ti.producto = tp.id where usuario=?",
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
        async (err, result) => {
          if (err) {
            console.log(err);
            return res.status(500).send("Error al editar el carrito");
          }

          await logCommerceAction(req, {
            usuario: currentUserId,
            modulo: "carrito",
            accion: "editar_carrito",
            descripcion: `Se actualizo el item de carrito #${id}.`,
            entidad: "tpedido",
            entidadId: Number(id),
            nivel: "info",
            metadata: { cantidad, subtotal },
          });

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
      db.query("DELETE FROM tpedido WHERE id = ?", [id], async (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).send("Error al eliminar el registro");
        }

        await logCommerceAction(req, {
          usuario: currentUserId,
          modulo: "carrito",
          accion: "eliminar_carrito",
          descripcion: `Se elimino el item de carrito #${id}.`,
          entidad: "tpedido",
          entidadId: Number(id),
          nivel: "warning",
          metadata: { id: Number(id) },
        });

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

    db.query("DELETE FROM tpedido WHERE usuario = ?", [usuario], async (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Error al eliminar el registro");
      }

      await logCommerceAction(req, {
        usuario,
        modulo: "carrito",
        accion: "vaciar_carrito",
        descripcion: `Se vacio el carrito del usuario #${usuario}.`,
        entidad: "tpedido",
        entidadId: null,
        nivel: "warning",
        metadata: { registrosEliminados: result.affectedRows },
      });

      res.send(result);
    });
  });

  router.post("/crearLista", authenticateToken, authorizeCommerceUser, async (req, res) => {
    const { inventario, usuario } = req.body;

    try {
      const [existingRows] = await db.promise().query(
        "SELECT id FROM tlista WHERE inventario = ? AND usuario = ? LIMIT 1",
        [inventario, usuario]
      );

      if (existingRows.length) {
        return res.json({ ok: true, id: existingRows[0].id, alreadyExists: true });
      }

      const [result] = await db.promise().query(
        "INSERT INTO tlista(inventario,usuario) VALUES(?,?)",
        [inventario, usuario]
      );

      await logCommerceAction(req, {
        usuario,
        modulo: "lista_deseos",
        accion: "agregar_lista",
        descripcion: `Se agrego inventario #${inventario} a la lista del usuario #${usuario}.`,
        entidad: "tlista",
        entidadId: result.insertId,
        nivel: "info",
        metadata: { inventario },
      });

      res.json({ ...result, ok: true });
    } catch (error) {
      console.log(error);
      return res.status(500).send("Error al crear el elemento de lista");
    }
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

  router.get("/verLista/:usuario", authenticateToken, authorizeCommerceUser, async (req, res) => {
    const { usuario } = req.params;

    try {
      const [result] = await db.promise().query(
        `select
          ti.id,
          tl.id as wishlist_id,
          tl.inventario,
          tl.usuario,
          ti.sucursal,
          ti.producto,
          ti.cantidad,
          tp.nombre,
          tp.detalles,
          tp.categoria,
          tp.precioVenta,
          tp.imagen,
          tp.imagenUrl,
          ti.id as inventario_id,
          tu.id as usuario_id,
          ts.id as sucursal_id,
          tp.id as producto_id
        from tlista tl
        join tinventario ti on tl.inventario = ti.id
        join tusuarios tu on tl.usuario = tu.id
        JOIN tproductos tp ON ti.producto = tp.id
        JOIN tsucursales ts ON ti.sucursal = ts.id
        where tl.usuario=?
        order by tl.id desc`,
        [usuario]
      );

      res.send(await attachProductImages(result));
    } catch (error) {
      console.log(error);
      return res.status(500).send("Error en el servidor");
    }
  });

  router.delete("/eliminarListaInventario/:usuario/:inventario", authenticateToken, authorizeCommerceUser, async (req, res) => {
    const { usuario, inventario } = req.params;

    try {
      const [targetRows] = await db.promise().query(
        "SELECT id FROM tlista WHERE usuario = ? AND inventario = ? LIMIT 1",
        [usuario, inventario]
      );

      if (!targetRows.length) {
        return res.json({ ok: true, removed: false });
      }

      const wishlistItemId = targetRows[0].id;
      const [result] = await db.promise().query("DELETE FROM tlista WHERE id = ?", [wishlistItemId]);

      await logCommerceAction(req, {
        usuario,
        modulo: "lista_deseos",
        accion: "eliminar_lista",
        descripcion: `Se elimino inventario #${inventario} de la lista del usuario #${usuario}.`,
        entidad: "tlista",
        entidadId: wishlistItemId,
        nivel: "warning",
        metadata: { inventario: Number(inventario), id: wishlistItemId },
      });

      res.json({ ...result, ok: true, removed: true });
    } catch (error) {
      console.log(error);
      return res.status(500).send("Error al eliminar de favoritos");
    }
  });

  router.delete("/eliminarLista/:id", authenticateToken, (req, res) => {
    const { id } = req.params;
    const isAdmin = Number(req.auth?.tipo) === 1;
    const currentUserId = Number(req.auth?.idUsuario);

    const applyDelete = () => {
      db.query("DELETE FROM tlista WHERE id = ?", [id], async (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).send("Error al eliminar el registro");
        }

        await logCommerceAction(req, {
          usuario: currentUserId,
          modulo: "lista_deseos",
          accion: "eliminar_lista",
          descripcion: `Se elimino el item de lista #${id}.`,
          entidad: "tlista",
          entidadId: Number(id),
          nivel: "warning",
          metadata: { id: Number(id) },
        });

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
      async (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).send("Error al procesar la solicitud");
        }

        await logCommerceAction(req, {
          usuario,
          modulo: "ventas",
          accion: "crear_venta",
          descripcion: `Se registro venta del producto #${producto} para usuario #${usuario}.`,
          entidad: "tventas",
          entidadId: result.insertId,
          nivel: "info",
          metadata: { pago, producto, cantidad, total },
        });

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
    const { usuario, metodo = "efectivo", referencia = null, proveedor = null, direccionEntrega = {} } = req.body;
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
          tu.ciudad,
          tu.estadoDireccion,
          tu.codigoPostal,
          tu.referenciasDomicilio,
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

      const baseUserAddress = {
        nombre: cartItems[0].usuario_nombre,
        telefono: cartItems[0].telefono,
        correo: cartItems[0].correo,
        domicilio: cartItems[0].domicilio,
        ciudad: cartItems[0].ciudad,
        estadoDireccion: cartItems[0].estadoDireccion,
        codigoPostal: cartItems[0].codigoPostal,
        referenciasDomicilio: cartItems[0].referenciasDomicilio,
      };
      const normalizedDeliveryAddress = normalizeDeliveryAddress({
        ...baseUserAddress,
        ...direccionEntrega,
      });
      const addressError = validateDeliveryAddress(normalizedDeliveryAddress);

      if (addressError) {
        await connection.rollback();
        return res.status(400).json({ error: addressError });
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
          (usuario, metodo, estado, referencia, subtotal, iva, envio, total, proveedor, direccionEntrega, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          JSON.stringify(normalizedDeliveryAddress),
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

        const remainingStock = Number(item.inventario_cant) - Number(item.cantidad);

        if (remainingStock <= LOW_STOCK_THRESHOLD) {
          await writeActivityLog(connection, {
            usuario,
            modulo: "inventarios",
            accion: "stock_bajo",
            descripcion: `El producto ${item.nombre} quedo con ${remainingStock} unidad(es) en inventario.`,
            entidad: "tinventario",
            entidadId: item.inventario_id,
            nivel: remainingStock <= 0 ? "error" : "warning",
            ip: requestIp,
            metadata: {
              producto: item.producto_id,
              productoNombre: item.nombre,
              sucursal: item.sucursal,
              inventario: item.inventario_id,
              cantidadVendida: item.cantidad,
              stockAnterior: item.inventario_cant,
              stockRestante: remainingStock,
              umbral: LOW_STOCK_THRESHOLD,
              pago: pagoId,
            },
          });
        }
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
          direccionEntrega: normalizedDeliveryAddress,
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
