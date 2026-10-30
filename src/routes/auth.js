const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const AuthController = require('../controllers/AuthController');
const { rateLimit } = require('express-rate-limit');

// La firma actual en app.js llama a createAuthRoutes(db).
// La mantenemos para que app.js no se rompa mientras terminamos de refactorizar.
const createAuthRoutes = (db) => {
  const router = express.Router();
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: Number(process.env.AUTH_RATE_LIMIT || 20), standardHeaders: 'draft-7', legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: 'Demasiados intentos. Intenta mas tarde.' }) });

  router.post('/login', limiter, AuthController.login);
  router.post('/register', limiter, AuthController.register);
  router.get('/me', authenticateToken, AuthController.getMe);

  return router;
};

module.exports = createAuthRoutes;
