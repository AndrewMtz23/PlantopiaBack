const AuthService = require('../services/AuthService');
const { getRequestIp } = require('../utils/activityLog');

class AuthController {
  async login(req, res) {
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
      console.error(error);
      const isAuthError = error.message.includes('incorrectos');
      return res.status(isAuthError ? 401 : 400).json({ error: error.message || "Error en el servidor." });
    }
  }

  async register(req, res) {
    try {
      const requestIp = getRequestIp(req);
      const idUsuario = await AuthService.register(req.body, requestIp);
      
      return res.status(201).json({
        message: "Usuario registrado con exito.",
        idUsuario,
      });
    } catch (error) {
      console.error(error);
      const status = error.message.includes('Ya existe') ? 409 : 400;
      return res.status(status).json({ error: error.message || "No se pudo registrar el usuario." });
    }
  }

  async getMe(req, res) {
    try {
      const session = await AuthService.getMe(req.auth.idUsuario);
      return res.json({ session });
    } catch (error) {
      console.error(error);
      return res.status(401).json({ error: error.message || "No se pudo validar la sesion." });
    }
  }
}

module.exports = new AuthController();
