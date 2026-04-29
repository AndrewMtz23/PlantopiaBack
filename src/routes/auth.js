const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const AuthController = require('../controllers/AuthController');

// La firma actual en app.js llama a createAuthRoutes(db).
// La mantenemos para que app.js no se rompa mientras terminamos de refactorizar.
const createAuthRoutes = (db) => {
  const router = express.Router();

  router.post('/login', AuthController.login);
  router.post('/register', AuthController.register);
  router.get('/me', authenticateToken, AuthController.getMe);

  return router;
};

module.exports = createAuthRoutes;
