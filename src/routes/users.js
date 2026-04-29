const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { handleProfileImageUpload } = require('../middleware/upload');
const UserController = require('../controllers/UserController');

// La firma actual de las rutas en app.js requiere una función que acepte 'db'.
// Mantenemos la firma para no romper app.js todavía, aunque 'db' ya no se usa aquí.
const createUserRoutes = (db) => {
  const router = express.Router();

  router.post('/crearUsuario', authenticateToken, requireAdmin, handleProfileImageUpload, UserController.createUser);
  router.get('/verUsuario', authenticateToken, requireAdmin, UserController.getAllUsers);
  router.get('/perfil', authenticateToken, UserController.getProfile);
  router.put('/perfil', authenticateToken, handleProfileImageUpload, UserController.updateProfile);
  router.put('/perfil/password', authenticateToken, UserController.changePassword);
  router.get('/verUsuario/:id', authenticateToken, UserController.getUserById);
  router.put('/editarUsuario', authenticateToken, requireAdmin, handleProfileImageUpload, UserController.updateUser);
  router.delete('/eliminarUsuario/:id', authenticateToken, requireAdmin, UserController.deleteUser);

  return router;
};

module.exports = createUserRoutes;
