const express = require("express");
const fileUpload = require("express-fileupload");
const path = require("path");
const { authenticateToken, requireAdmin } = require("../middleware/auth");
const { handleProductImagesUpload } = require("../middleware/upload");
const { getRequestIp, writeActivityLog } = require("../utils/activityLog");
const { cleanupTempFiles, storeProductImages } = require("../utils/imageStorage");

const CATEGORY_OPTIONS = new Set([
  "Desinfectantes",
  "Plantas de Interior",
  "Plantas de Exterior",
  "Productos para Plantas",
  "Productos especializados",
  "Plantas Jardineria",
  "Productos Jardineria",
]);

const normalizeImagePath = (value = "") => String(value).trim();
const normalizeExternalImageUrl = (value = "") => String(value).trim();

const isValidExternalImageUrl = (value = "") => {
  if (!value) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
};

const validateProductPayload = ({
  nombre,
  detalles,
  categoria,
  precioCompra,
  precioVenta,
  imagenUrl,
}) => {
  if (!nombre || String(nombre).trim().length < 3) {
    return "El nombre debe tener al menos 3 caracteres.";
  }

  if (!detalles || String(detalles).trim().length < 8) {
    return "Los detalles deben tener al menos 8 caracteres.";
  }

  if (!CATEGORY_OPTIONS.has(String(categoria).trim())) {
    return "Selecciona una categoria valida.";
  }

  const purchasePrice = Number(precioCompra);
  const salePrice = Number(precioVenta);

  if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
    return "El precio de compra es invalido.";
  }

  if (!Number.isFinite(salePrice) || salePrice < 0) {
    return "El precio de venta es invalido.";
  }

  if (purchasePrice > salePrice) {
    return "El precio de compra no puede ser mayor que el precio de venta.";
  }

  if (!isValidExternalImageUrl(imagenUrl)) {
    return "La URL de imagen de respaldo no es valida.";
  }

  return null;
};

const attachProductImages = async (dbPromise, products = []) => {
  if (!products.length) {
    return products;
  }

  const productIds = [...new Set(products.map((product) => Number(product.producto_id || product.id)).filter(Boolean))];

  if (!productIds.length) {
    return products;
  }

  const [images] = await dbPromise.query(
    `SELECT id, producto, ruta, nombreOriginal, esPrincipal, orden
     FROM tproducto_imagenes
     WHERE producto IN (?)
     ORDER BY esPrincipal DESC, orden ASC, id ASC`,
    [productIds]
  );

  const imagesByProduct = images.reduce((acc, image) => {
    const productId = Number(image.producto);
    acc[productId] = acc[productId] || [];
    acc[productId].push(image);
    return acc;
  }, {});

  return products.map((product) => ({
    ...product,
    imagenes: imagesByProduct[Number(product.producto_id || product.id)] || [],
  }));
};

const createProductRoutes = (db, publicDirectoryPath) => {
  const router = express.Router();

  router.post("/crearProducto", authenticateToken, requireAdmin, async (req, res) => {
    const {
      estatus,
      nombre,
      detalles,
      categoria,
      precioCompra,
      precioVenta,
      imagen,
      imagenUrl,
    } = req.body;
    const requestIp = getRequestIp(req);

    const normalizedImage = normalizeImagePath(imagen);
    const normalizedImageUrl = normalizeExternalImageUrl(imagenUrl);
    const validationError = validateProductPayload({
      nombre,
      detalles,
      categoria,
      precioCompra,
      precioVenta,
      imagenUrl: normalizedImageUrl,
    });

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    try {
      const [existingProducts] = await db.promise().query(
        "SELECT id FROM tproductos WHERE LOWER(nombre) = ? LIMIT 1",
        [String(nombre).trim().toLowerCase()]
      );

      if (existingProducts.length > 0) {
        return res.status(409).json({ error: "Ya existe un producto con ese nombre." });
      }
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "No se pudo validar el producto." });
    }

    try {
      const [result] = await db.promise().query(
        `INSERT INTO tproductos
        (estatus,nombre,detalles,categoria,precioCompra,precioVenta,imagen,imagenUrl)
        VALUES(?,?,?,?,?,?,?,?)`,
        [
          estatus,
          String(nombre).trim(),
          String(detalles).trim(),
          String(categoria).trim(),
          Number(precioCompra),
          Number(precioVenta),
          normalizedImage || null,
          normalizedImageUrl || null,
        ]
      );

      await writeActivityLog(db.promise(), {
        usuario: Number(req.auth?.idUsuario) || null,
        modulo: "productos",
        accion: "crear_producto",
        descripcion: `Se creo el producto ${String(nombre).trim()}.`,
        entidad: "tproductos",
        entidadId: result.insertId,
        nivel: "info",
        ip: requestIp,
        metadata: {
          categoria: String(categoria).trim(),
          precioCompra: Number(precioCompra),
          precioVenta: Number(precioVenta),
          estatus,
        },
      });

      res.json({ ok: true, id: result.insertId });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "Error al crear el producto." });
    }
  });

  router.get("/verProducto", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const [products] = await db.promise().query("SELECT * FROM tproductos");
      res.send(await attachProductImages(db.promise(), products));
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "Error al obtener productos." });
    }
  });

  router.post(
    "/productoImagenes/:id",
    authenticateToken,
    requireAdmin,
    handleProductImagesUpload,
    async (req, res) => {
      const productId = Number(req.params.id);
      const requestIp = getRequestIp(req);

      if (!Number.isFinite(productId)) {
        await cleanupTempFiles(req.files || []);
        return res.status(400).json({ error: "Id de producto invalido." });
      }

      if (!req.files?.length) {
        return res.status(400).json({ error: "Selecciona al menos una imagen." });
      }

      try {
        const [products] = await db.promise().query(
          "SELECT id, nombre, imagen FROM tproductos WHERE id = ? LIMIT 1",
          [productId]
        );

        if (!products.length) {
          await cleanupTempFiles(req.files || []);
          return res.status(404).json({ error: "Producto no encontrado." });
        }

        const [countRows] = await db.promise().query(
          "SELECT COUNT(*) AS total FROM tproducto_imagenes WHERE producto = ?",
          [productId]
        );
        const currentTotal = Number(countRows[0]?.total || 0);

        if (currentTotal + req.files.length > 20) {
          await cleanupTempFiles(req.files || []);
          return res.status(400).json({ error: "Cada producto puede tener maximo 20 imagenes." });
        }

        const storedImages = await storeProductImages({
          productId,
          name: products[0].nombre,
          files: req.files,
          startOrder: currentTotal,
        });

        for (const [index, image] of storedImages.entries()) {
          await db.promise().query(
            `INSERT INTO tproducto_imagenes
              (producto, ruta, nombreOriginal, esPrincipal, orden)
             VALUES (?, ?, ?, ?, ?)`,
            [
              productId,
              image.ruta,
              image.nombreOriginal,
              currentTotal === 0 && index === 0 ? 1 : 0,
              image.orden,
            ]
          );
        }

        if (!products[0].imagen && storedImages[0]?.ruta) {
          await db.promise().query("UPDATE tproductos SET imagen = ? WHERE id = ?", [
            storedImages[0].ruta,
            productId,
          ]);
        }

        await writeActivityLog(db.promise(), {
          usuario: Number(req.auth?.idUsuario) || null,
          modulo: "productos",
          accion: "subir_galeria_producto",
          descripcion: `Se subieron ${storedImages.length} imagen(es) para ${products[0].nombre}.`,
          entidad: "tproductos",
          entidadId: productId,
          nivel: "info",
          ip: requestIp,
          metadata: { imagenes: storedImages.map((image) => image.ruta) },
        });

        res.json({ ok: true, imagenes: storedImages });
      } catch (error) {
        await cleanupTempFiles(req.files || []);
        console.log(error);
        return res.status(500).json({ error: "No se pudieron guardar las imagenes." });
      }
    }
  );

  router.delete("/productoImagen/:imageId", authenticateToken, requireAdmin, async (req, res) => {
    const imageId = Number(req.params.imageId);

    if (!Number.isFinite(imageId)) {
      return res.status(400).json({ error: "Id de imagen invalido." });
    }

    try {
      const [result] = await db.promise().query(
        "DELETE FROM tproducto_imagenes WHERE id = ?",
        [imageId]
      );

      res.json({ ok: true, deleted: result.affectedRows });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "No se pudo eliminar la imagen." });
    }
  });

  router.get("/productoDetalle/:inventarioId", async (req, res) => {
    const inventoryId = Number(req.params.inventarioId);

    if (!Number.isFinite(inventoryId)) {
      return res.status(400).json({ error: "Id de inventario invalido." });
    }

    try {
      const [rows] = await db.promise().query(
        `SELECT
          ti.*,
          tp.nombre,
          tp.detalles,
          tp.categoria,
          tp.precioVenta,
          tp.precioCompra,
          tp.imagen,
          tp.imagenUrl,
          tp.estatus AS producto_estatus,
          ts.id AS sucursal_id,
          ts.nombre AS sucursal_nombre,
          ts.direccion AS sucursal_direccion,
          tp.id AS producto_id
         FROM tinventario ti
         JOIN tproductos tp ON ti.producto = tp.id
         JOIN tsucursales ts ON ti.sucursal = ts.id
         WHERE ti.id = ?
           AND ti.estatus = 1
           AND ti.cantidad > 0
         LIMIT 1`,
        [inventoryId]
      );

      if (!rows.length) {
        return res.status(404).json({ error: "Producto no encontrado o sin inventario." });
      }

      const [withImages] = await attachProductImages(db.promise(), rows);
      const [availability] = await db.promise().query(
        `SELECT ti.id, ti.cantidad, ts.nombre AS sucursal_nombre
         FROM tinventario ti
         JOIN tsucursales ts ON ti.sucursal = ts.id
         WHERE ti.producto = ?
           AND ti.estatus = 1
           AND ti.cantidad > 0
         ORDER BY ti.cantidad DESC`,
        [withImages.producto_id]
      );

      res.json({
        ...withImages,
        disponibilidad: availability,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "No se pudo obtener el detalle del producto." });
    }
  });

  router.put("/editarProducto", authenticateToken, requireAdmin, async (req, res) => {
    const {
      id,
      estatus,
      nombre,
      detalles,
      categoria,
      precioCompra,
      precioVenta,
      imagen,
      imagenUrl,
    } = req.body;
    const requestIp = getRequestIp(req);

    const normalizedImage = normalizeImagePath(imagen);
    const normalizedImageUrl = normalizeExternalImageUrl(imagenUrl);
    const validationError = validateProductPayload({
      nombre,
      detalles,
      categoria,
      precioCompra,
      precioVenta,
      imagenUrl: normalizedImageUrl,
    });

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    try {
      const [existingProducts] = await db.promise().query(
        "SELECT id FROM tproductos WHERE LOWER(nombre) = ? AND id <> ? LIMIT 1",
        [String(nombre).trim().toLowerCase(), id]
      );

      if (existingProducts.length > 0) {
        return res.status(409).json({ error: "Ya existe otro producto con ese nombre." });
      }
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "No se pudo validar el producto." });
    }

    try {
      const [rows] = await db.promise().query(
        "SELECT id, nombre, categoria, precioCompra, precioVenta, estatus FROM tproductos WHERE id = ? LIMIT 1",
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({ error: "Producto no encontrado." });
      }

      const previous = rows[0];
      await db.promise().query(
        `UPDATE tproductos
         SET estatus=?,nombre=?,detalles=?,categoria=?,precioCompra=?,precioVenta=?,imagen=?,imagenUrl=?
         WHERE id=?`,
        [
          estatus,
          String(nombre).trim(),
          String(detalles).trim(),
          String(categoria).trim(),
          Number(precioCompra),
          Number(precioVenta),
          normalizedImage || null,
          normalizedImageUrl || null,
          id,
        ]
      );

      await writeActivityLog(db.promise(), {
        usuario: Number(req.auth?.idUsuario) || null,
        modulo: "productos",
        accion: "editar_producto",
        descripcion: `Se actualizo el producto ${previous.nombre} (#${id}).`,
        entidad: "tproductos",
        entidadId: Number(id),
        nivel: "info",
        ip: requestIp,
        metadata: {
          antes: previous,
          despues: {
            nombre: String(nombre).trim(),
            categoria: String(categoria).trim(),
            precioCompra: Number(precioCompra),
            precioVenta: Number(precioVenta),
            estatus,
          },
        },
      });

      res.json({ ok: true, id: Number(id) });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "Error al editar el producto." });
    }
  });

  router.delete("/eliminarProducto/:id", authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const productId = Number(id);
    const requestIp = getRequestIp(req);

    if (!Number.isFinite(productId)) {
      return res.status(400).json({ error: "Id de producto invalido." });
    }

    db.query("SELECT id, nombre, estatus, categoria FROM tproductos WHERE id = ? LIMIT 1", [id], (findErr, products) => {
      if (findErr) {
        console.log(findErr);
        return res.status(500).json({ error: "Error al validar el producto." });
      }

      if (!products.length) {
        return res.status(404).json({ error: "Producto no encontrado." });
      }

      const targetProduct = products[0];

      db.query("UPDATE tproductos SET estatus = 0 WHERE id = ? AND estatus <> 0", [id], async (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ error: "Error al desactivar el producto." });
      }

      if (!result.affectedRows) {
        return res.status(409).json({ error: "El producto ya se encuentra inactivo." });
      }

      try {
        await writeActivityLog(db.promise(), {
          usuario: Number(req.auth?.idUsuario) || null,
          modulo: "productos",
          accion: "desactivar_producto",
          descripcion: `Se desactivo el producto ${targetProduct.nombre} (#${productId}).`,
          entidad: "tproductos",
          entidadId: productId,
          nivel: "warning",
          ip: requestIp,
          metadata: {
            categoria: targetProduct.categoria,
            estatusAnterior: targetProduct.estatus,
            estatusNuevo: 0,
          },
        });
      } catch (logError) {
        console.log(logError);
      }

      res.json({ ok: true, deactivatedId: productId, estatus: 0 });
      });
    });
  });

  router.post("/upload", authenticateToken, requireAdmin, fileUpload(), (req, res) => {
    const requestIp = getRequestIp(req);

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: "No se recibio ninguna imagen." });
    }

    const image = req.files.image;
    const safeBaseName = path
      .basename(image.name)
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "");
    const extension = path.extname(safeBaseName || "").toLowerCase();
    const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

    if (!allowedExtensions.has(extension)) {
      return res.status(400).json({ error: "Formato de imagen no permitido." });
    }

    const finalName = `${Date.now()}-${safeBaseName}`;
    const uploadPath = path.join(publicDirectoryPath, "images", finalName);

    image.mv(uploadPath, async (err) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ error: "No se pudo subir la imagen." });
      }

      try {
        await writeActivityLog(db.promise(), {
          usuario: Number(req.auth?.idUsuario) || null,
          modulo: "productos",
          accion: "subir_imagen",
          descripcion: `Se subio la imagen ${finalName}.`,
          entidad: "tproductos",
          entidadId: null,
          nivel: "info",
          ip: requestIp,
          metadata: {
            nombreOriginal: image.name,
            nombreFinal: finalName,
            ruta: `/images/${finalName}`,
            mimetype: image.mimetype,
            size: image.size,
          },
        });
      } catch (logError) {
        console.log(logError);
      }

      res.json({
        ok: true,
        path: `/images/${finalName}`,
        fileName: finalName,
      });
    });
  });

  return router;
};

module.exports = createProductRoutes;
