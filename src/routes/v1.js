const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { list } = require('../modules/catalog/listService');
const AppError = require('../utils/AppError');
const collections = [
  ['users', '/verUsuario', [1]], ['products', '/verProducto', [1, 3]],
  ['inventory', '/verInventario', [1, 3]], ['catalog', '/obtenerProductos', null],
  ['payments', '/verPagos', [1]], ['logs', '/verLogs', [1]],
];
function registerCollections(router, legacy = false) {
  for (const [kind, alias, roles] of collections) {
    const middleware = roles ? [authenticateToken, authorizeRole(roles)] : [];
    router.get(legacy ? alias : `/${kind}`, ...middleware, async (req, res, next) => {
      try {
        const unpaged = legacy && req.query.page === undefined && req.query.pageSize === undefined;
        const result = await list(kind, unpaged ? { ...req.query, pageSize: 100 } : req.query);
        if (legacy) res.set('Deprecation', 'true');
        if (unpaged && result.total > result.pageSize) throw new AppError(409, 'PAGINATION_REQUIRED', 'Esta lista requiere paginacion. Actualiza el cliente.');
        res.json(unpaged ? result.items : result);
      } catch (error) { next(error); }
    });
  }
  return router;
}
function v1() {
  const router = registerCollections(express.Router());
  registerCollections(router, true);
  router.use((req, res, next) => {
    const fields = { "/crearCarrito": ["inventario", "cantidad"], "/editarCarrito": ["id", "cantidad"], "/crearLista": ["inventario"], "/procesarCompra": ["quoteHash", "metodo", "direccionEntrega"] }[req.path];
    try { if (fields && ["POST", "PUT"].includes(req.method)) require("../shared/http/validate").object(req.body, fields); next(); } catch (error) { next(error); }
  });
  router.get('/my-payments', authenticateToken, async (req, res, next) => { try { res.json(await list('payments', req.query, req.auth.idUsuario)); } catch (error) { next(error); } });
  router.use('/auth', require('./auth')());
  // Versioned aliases reuse the same application policies and command handlers.
  for (const name of ['users', 'products', 'inventory', 'commerce', 'payments', 'logs', 'metrics']) router.use(require(`./${name}`)());
  return router;
}
module.exports = { v1, legacyCollections: () => registerCollections(express.Router(), true) };
