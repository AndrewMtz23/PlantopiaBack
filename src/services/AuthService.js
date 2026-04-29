const UserRepository = require('../repositories/UserRepository');
const { comparePassword, hashPassword, isHashedPassword } = require('../utils/passwords');
const { signAuthToken } = require('../utils/jwt');
const { writeActivityLog } = require('../utils/activityLog');
const { normalizeEmail, validateLoginPayload } = require('../utils/authValidation');
const UserService = require('./UserService');

class AuthService {
  createSessionPayload(user) {
    return {
      idUsuario: user.id,
      tipo: user.tipo,
      nombre: user.nombre,
      correo: user.correo,
      fotoPerfil: user.fotoPerfil,
    };
  }

  async login(correo, clave, requestIp) {
    const normalizedEmail = normalizeEmail(correo);
    const validationError = validateLoginPayload({ correo, clave });

    if (validationError) throw new Error(validationError);

    const user = await UserRepository.findByEmail(normalizedEmail);

    if (!user || user.estatus !== 1) {
      await writeActivityLog(null, {
        usuario: null,
        modulo: "auth",
        accion: "login_fallido",
        descripcion: `Intento de inicio de sesion fallido para ${normalizedEmail}.`,
        entidad: "tusuarios",
        nivel: "warning",
        ip: requestIp,
        metadata: { correo: normalizedEmail, motivo: "usuario_inexistente_o_inactivo" },
      });
      throw new Error("Correo o contrasena incorrectos.");
    }

    const isValidPassword = await comparePassword(clave, user.clave);

    if (!isValidPassword) {
      await writeActivityLog(null, {
        usuario: user.id,
        modulo: "auth",
        accion: "login_fallido",
        descripcion: `Intento de inicio de sesion fallido para ${user.correo}.`,
        entidad: "tusuarios",
        entidadId: user.id,
        nivel: "warning",
        ip: requestIp,
        metadata: { correo: user.correo, motivo: "clave_incorrecta" },
      });
      throw new Error("Correo o contrasena incorrectos.");
    }

    // Migración de contraseñas legacy a hash
    if (!isHashedPassword(user.clave)) {
      try {
        const hashedPassword = await hashPassword(clave);
        await UserRepository.update(user.id, { clave: hashedPassword });
      } catch (hashError) {
        console.error("Error hasheando clave legacy:", hashError);
      }
    }

    const session = this.createSessionPayload(user);
    const token = signAuthToken(session);

    await writeActivityLog(null, {
      usuario: user.id,
      modulo: "auth",
      accion: "login_exitoso",
      descripcion: `Inicio de sesion de ${user.nombre}.`,
      entidad: "tusuarios",
      entidadId: user.id,
      nivel: "info",
      ip: requestIp,
      metadata: { correo: user.correo, tipo: user.tipo },
    });

    return { token, session };
  }

  async register(payload, requestIp) {
    // Forzamos estatus 1 y tipo 2 (Cliente) para registros públicos
    const dataToCreate = {
      ...payload,
      estatus: 1,
      tipo: 2,
    };
    
    // Delegamos la creación al UserService
    const newUser = await UserService.createUser(dataToCreate, null, requestIp, null);
    
    // Cambiar la acción en el log si es necesario, UserService ya crea un log, 
    // pero podemos dejar el que hace UserService para simplificar.
    return newUser.id;
  }

  async getMe(userId) {
    const user = await UserRepository.findById(userId);
    if (!user || user.estatus !== 1) {
      throw new Error("La sesion ya no es valida.");
    }
    return this.createSessionPayload(user);
  }
}

module.exports = new AuthService();
