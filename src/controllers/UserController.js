const UserService = require('../services/UserService');
const { getRequestIp } = require('../utils/activityLog');

class UserController {
  async createUser(req, res, next) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const result = await UserService.createUser(req.body, req.file, requestIp, adminId);
      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  }

  async getAllUsers(req, res, next) {
    try {
      const users = await UserService.getAllUsers();
      return res.json(users);
    } catch (error) {
      return next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      const user = await UserService.getProfile(Number(req.auth.idUsuario));
      return res.json({ usuario: user });
    } catch (error) {
      return next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const requestIp = getRequestIp(req);
      const updatedUser = await UserService.updateProfile(Number(req.auth.idUsuario), req.body, req.file, requestIp);
      
      return res.json({
        ok: true,
        usuario: updatedUser,
        session: {
          idUsuario: updatedUser.id,
          tipo: updatedUser.tipo,
          nombre: updatedUser.nombre,
          correo: updatedUser.correo,
          fotoPerfil: updatedUser.fotoPerfil,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      const requestIp = getRequestIp(req);
      const { claveActual, nuevaClave, confirmarClave } = req.body;
      await UserService.changePassword(Number(req.auth.idUsuario), claveActual, nuevaClave, confirmarClave, requestIp);
      return res.json({ ok: true, message: 'Contrasena actualizada correctamente.' });
    } catch (error) {
      return next(error);
    }
  }

  async getUserById(req, res, next) {
    try {
      const isAdmin = Number(req.auth?.tipo) === 1;
      const user = await UserService.getUserById(req.params.id, req.auth?.idUsuario, isAdmin);
      return res.json(user);
    } catch (error) {
      return next(error);
    }
  }

  async updateUser(req, res, next) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const updatedUser = await UserService.updateUser(req.body.id, req.body, req.file, requestIp, adminId);
      return res.json(updatedUser);
    } catch (error) {
      return next(error);
    }
  }

  async deleteUser(req, res, next) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      await UserService.deleteUser(req.params.id, adminId, requestIp);
      return res.json({ ok: true, deactivatedId: Number(req.params.id), estatus: 0 });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new UserController();
