const AuthService = require('../services/AuthService');
const { getRequestIp } = require('../utils/activityLog');

class AuthController {
  async login(req, res, next) {
    try {
      const requestIp = getRequestIp(req);
      const { correo = "", clave = "" } = req.body;
      const result = await AuthService.login(correo, clave, requestIp);
      
      return res.json({
        message: "Inicio de sesion exitoso.",
        token: result.token,
        session: result.session,
      });
    } catch (error) {
      return next(error);
    }
  }

  async register(req, res, next) {
    try {
      const requestIp = getRequestIp(req);
      const idUsuario = await AuthService.register(req.body, requestIp);
      
      return res.status(201).json({
        message: "Usuario registrado con exito.",
        idUsuario,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getMe(req, res, next) {
    try {
      const session = await AuthService.getMe(req.auth.idUsuario);
      return res.json({ session });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new AuthController();
