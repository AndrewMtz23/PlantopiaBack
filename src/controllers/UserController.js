const UserService = require('../services/UserService');
const { getRequestIp } = require('../utils/activityLog');

class UserController {
  async createUser(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const result = await UserService.createUser(req.body, req.file, requestIp, adminId);
      return res.status(201).json(result);
    } catch (error) {
      console.error(error);
      const status = error.message.includes('Ya existe') ? 409 : 400;
      return res.status(status).json({ error: error.message || 'Error al crear el usuario.' });
    }
  }

  async getAllUsers(req, res) {
    try {
      const users = await UserService.getAllUsers();
      return res.json(users);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Error al obtener usuarios' });
    }
  }

  async getProfile(req, res) {
    try {
      const user = await UserService.getProfile(Number(req.auth.idUsuario));
      return res.json({ usuario: user });
    } catch (error) {
      console.error(error);
      const status = error.message.includes('No encontrado') ? 404 : 500;
      return res.status(status).json({ error: error.message || 'No se pudo obtener el perfil.' });
    }
  }

  async updateProfile(req, res) {
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
      console.error(error);
      const status = error.message.includes('Ya existe') ? 409 : (error.message.includes('encontrado') ? 404 : 400);
      return res.status(status).json({ error: error.message || 'No se pudo actualizar el perfil.' });
    }
  }

  async changePassword(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const { claveActual, nuevaClave, confirmarClave } = req.body;
      await UserService.changePassword(Number(req.auth.idUsuario), claveActual, nuevaClave, confirmarClave, requestIp);
      return res.json({ ok: true, message: 'Contrasena actualizada correctamente.' });
    } catch (error) {
      console.error(error);
      const status = error.message.includes('encontrado') ? 404 : (error.message.includes('correcta') ? 401 : 400);
      return res.status(status).json({ error: error.message || 'No se pudo cambiar la contrasena.' });
    }
  }

  async getUserById(req, res) {
    try {
      const isAdmin = Number(req.auth?.tipo) === 1;
      const user = await UserService.getUserById(req.params.id, req.auth?.idUsuario, isAdmin);
      return res.json(user);
    } catch (error) {
      console.error(error);
      const status = error.message.includes('No puedes') ? 403 : (error.message.includes('encontrado') ? 404 : 500);
      return res.status(status).json({ error: error.message || 'Error al obtener el usuario' });
    }
  }

  async updateUser(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      const updatedUser = await UserService.updateUser(req.body.id, req.body, req.file, requestIp, adminId);
      return res.json(updatedUser);
    } catch (error) {
      console.error(error);
      const status = error.message.includes('Ya existe') ? 409 : (error.message.includes('encontrado') ? 404 : 400);
      return res.status(status).json({ error: error.message || 'Error al editar el usuario.' });
    }
  }

  async deleteUser(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const adminId = Number(req.auth?.idUsuario);
      await UserService.deleteUser(req.params.id, adminId, requestIp);
      return res.json({ ok: true, deactivatedId: Number(req.params.id), estatus: 0 });
    } catch (error) {
      console.error(error);
      const status = error.message.includes('inactivo') ? 409 : (error.message.includes('encontrado') ? 404 : 400);
      return res.status(status).json({ error: error.message || 'Error al desactivar el usuario.' });
    }
  }
}

module.exports = new UserController();
