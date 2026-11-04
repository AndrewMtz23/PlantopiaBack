const AppError = require('../utils/AppError');
const { userSchema } = require('../modules/identity/userSchemas');
const { withTransaction } = require('../infrastructure/db/transaction');
const { changeAccountAccess } = require('../modules/identity/accountPolicy');
const { appendAudit } = require('../modules/audit/auditService');
const UserRepository = require('../repositories/UserRepository');
const { hashPassword, comparePassword } = require('../utils/passwords');
const { writeActivityLog } = require('../utils/activityLog');
const { storeUserProfileImage, cleanupTempFile } = require('../utils/imageStorage');
const { normalizeEmail, validateUserPayload } = require('../utils/authValidation');

const normalizeCoordinate = (value, { min, max, label }) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const coordinate = Number(value);
  if (!Number.isFinite(coordinate) || coordinate < min || coordinate > max) {
    throw new AppError(400, 'INVALID_INPUT', `${label} no es valida.`);
  }

  return Number(coordinate.toFixed(8));
};

const normalizeLocation = ({ latitud, longitud }) => {
  const normalizedLatitude = normalizeCoordinate(latitud, {
    min: -90,
    max: 90,
    label: "La latitud",
  });
  const normalizedLongitude = normalizeCoordinate(longitud, {
    min: -180,
    max: 180,
    label: "La longitud",
  });

  if (
    (normalizedLatitude === null && normalizedLongitude !== null) ||
    (normalizedLatitude !== null && normalizedLongitude === null)
  ) {
    throw new AppError(400, 'INVALID_INPUT', "Completa latitud y longitud para guardar la ubicacion.");
  }

  return {
    latitud: normalizedLatitude,
    longitud: normalizedLongitude,
  };
};

const hasLocationInput = (payload = {}) => (
  Object.prototype.hasOwnProperty.call(payload, "latitud") ||
  Object.prototype.hasOwnProperty.call(payload, "longitud")
);

class UserService {
  async createUser(payload, file, requestIp, adminId) {
    payload = userSchema(payload, { admin: true, create: true });
    const {
      estatus,
      tipo,
      clave,
      nombre,
      fechaNacimiento,
      genero,
      telefono,
      correo,
      domicilio,
      ciudad = "",
      estadoDireccion = "",
      codigoPostal = "",
      referenciasDomicilio = "",
    } = payload;
    const location = normalizeLocation(payload);
    const normalizedPostalCode = String(codigoPostal || "").replace(/\D/g, "");
    
    const normalizedPayload = {
      estatus: Number(estatus),
      tipo: Number(tipo),
      clave,
      nombre: nombre ? nombre.trim() : '',
      fechaNacimiento,
      genero,
      telefono: telefono ? String(telefono).replace(/\D/g, "") : '',
      correo: normalizeEmail(correo || ""),
      domicilio: domicilio ? domicilio.trim() : '',
      ciudad: String(ciudad).trim() || null,
      estadoDireccion: String(estadoDireccion).trim() || null,
      codigoPostal: normalizedPostalCode || null,
      referenciasDomicilio: String(referenciasDomicilio).trim() || null,
      ...location,
    };

    const validationError = validateUserPayload(normalizedPayload);
    if (validationError) {
      if (file) await cleanupTempFile(file);
      throw new AppError(400, 'INVALID_INPUT', validationError);
    }

    // Verificar duplicado
    const existingUser = await UserRepository.findByEmail(normalizedPayload.correo);
    if (existingUser) {
      if (file) await cleanupTempFile(file);
      throw new AppError(409, 'CONFLICT', 'Ya existe un usuario con ese correo.');
    }

    const hashedPassword = await hashPassword(clave);

    // Crear usuario
    const fotoPerfil = file ? await storeUserProfileImage({ file }) : null;
    const newUser = await UserRepository.create({
      estatus: normalizedPayload.estatus,
      tipo: normalizedPayload.tipo,
      clave: hashedPassword,
      nombre: normalizedPayload.nombre,
      fechaNacimiento: normalizedPayload.fechaNacimiento,
      genero: normalizedPayload.genero,
      telefono: normalizedPayload.telefono,
      correo: normalizedPayload.correo,
      domicilio: normalizedPayload.domicilio,
      ciudad: normalizedPayload.ciudad,
      estadoDireccion: normalizedPayload.estadoDireccion,
      codigoPostal: normalizedPayload.codigoPostal,
      referenciasDomicilio: normalizedPayload.referenciasDomicilio,
      latitud: normalizedPayload.latitud,
      longitud: normalizedPayload.longitud,
      fotoPerfil,
    });

    if (file) file.committed = true;

    await writeActivityLog(null, {
      usuario: adminId || null,
      modulo: "usuarios",
      accion: "crear_usuario",
      descripcion: `Se creo el usuario ${newUser.nombre} (${newUser.correo}).`,
      entidad: "tusuarios",
      entidadId: newUser.id,
      nivel: "info",
      ip: requestIp,
      metadata: { tipo: newUser.tipo, estatus: newUser.estatus, correo: newUser.correo, fotoPerfil },
    });

    const { clave: _secret, tokenVersion: _version, ...safeUser } = newUser;
    return { ...safeUser, fotoPerfil };
  }

  async getAllUsers() {
    return require('../modules/catalog/listService').smallLegacyList('users');
  }

  async getProfile(userId) {
    const user = await UserRepository.getProfile(userId);
    if (!user || user.estatus !== 1) throw new AppError(404, 'NOT_FOUND', 'Usuario no encontrado.');
    return user;
  }

  async getUserById(userId, requesterId, isAdmin) {
    if (!isAdmin && Number(userId) !== Number(requesterId)) {
      throw new AppError(403, 'FORBIDDEN', 'No puedes consultar otro usuario.');
    }
    const user = await UserRepository.findById(userId, {
      select: {
        id: true,
        estatus: true,
        tipo: true,
        nombre: true,
        fechaNacimiento: true,
        genero: true,
        telefono: true,
        correo: true,
        domicilio: true,
        ciudad: true,
        estadoDireccion: true,
        codigoPostal: true,
        referenciasDomicilio: true,
        latitud: true,
        longitud: true,
        fotoPerfil: true
      }
    });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'Usuario no encontrado');
    return user;
  }

  async updateProfile(userId, payload, file, requestIp) {
    payload = userSchema(payload, {});
    const { nombre, fechaNacimiento, genero, telefono, correo, domicilio, ciudad = "", estadoDireccion = "", codigoPostal = "", referenciasDomicilio = "" } = payload;
    const normalizedEmail = normalizeEmail(correo || "");
    const normalizedPostalCode = String(codigoPostal || "").replace(/\D/g, "");

    // Validaciones
    if (!nombre || String(nombre).trim().length < 3) throw new AppError(400, 'INVALID_INPUT', "El nombre debe tener al menos 3 caracteres.");
    if (!fechaNacimiento) throw new AppError(400, 'INVALID_INPUT', "La fecha de nacimiento es obligatoria.");
    if (!genero) throw new AppError(400, 'INVALID_INPUT', "Selecciona un genero valido.");
    if (!telefono || String(telefono).replace(/\D/g, "").length < 10) throw new AppError(400, 'INVALID_INPUT', "El telefono debe tener al menos 10 digitos.");
    if (!normalizedEmail) throw new AppError(400, 'INVALID_INPUT', "El correo es obligatorio.");
    if (!domicilio || String(domicilio).trim().length < 8) throw new AppError(400, 'INVALID_INPUT', "El domicilio debe tener al menos 8 caracteres.");
    if (normalizedPostalCode && (normalizedPostalCode.length < 5 || normalizedPostalCode.length > 10)) throw new AppError(400, 'INVALID_INPUT', "El codigo postal debe tener entre 5 y 10 digitos.");

    const existingUsers = await UserRepository.findAll({ where: { correo: normalizedEmail, id: { not: Number(userId) } } });
    if (existingUsers.length > 0) {
      if (file) await cleanupTempFile(file);
      throw new AppError(409, 'CONFLICT', "Ya existe otro usuario con ese correo.");
    }

    const previousUser = await UserRepository.findById(userId);
    if (!previousUser || previousUser.estatus !== 1) {
      if (file) await cleanupTempFile(file);
      throw new AppError(404, 'NOT_FOUND', "Usuario no encontrado.");
    }

    const location = hasLocationInput(payload)
      ? normalizeLocation(payload)
      : {
          latitud: previousUser.latitud,
          longitud: previousUser.longitud,
        };

    let fotoPerfil = previousUser.fotoPerfil;
    if (file) {
      fotoPerfil = await storeUserProfileImage({
        file,
        userId,
        name: String(nombre).trim(),
        tempFilePath: file.path,
        originalName: file.originalname,
      });
    }

    await UserRepository.update(userId, {
      nombre: String(nombre).trim(),
      fechaNacimiento,
      genero,
      telefono: String(telefono).replace(/\D/g, ""),
      correo: normalizedEmail,
      domicilio: String(domicilio).trim(),
      ciudad: String(ciudad).trim() || null,
      estadoDireccion: String(estadoDireccion).trim() || null,
      codigoPostal: normalizedPostalCode || null,
      referenciasDomicilio: String(referenciasDomicilio).trim() || null,
      latitud: location.latitud,
      longitud: location.longitud,
      fotoPerfil
    });

    if (file) file.committed = true;
    const updatedUser = await UserRepository.getProfile(userId);

    await writeActivityLog(null, {
      usuario: userId,
      modulo: "usuarios",
      accion: "actualizar_perfil",
      descripcion: `El usuario ${previousUser.nombre} actualizo su perfil.`,
      entidad: "tusuarios",
      entidadId: userId,
      nivel: "info",
      ip: requestIp,
      metadata: { antes: { nombre: previousUser.nombre, correo: previousUser.correo }, despues: { nombre: updatedUser.nombre, correo: updatedUser.correo }, actualizoFoto: Boolean(file) },
    });

    return updatedUser;
  }

  async changePassword(userId, claveActual, nuevaClave, confirmarClave, requestIp) {
    for (const [field, value] of Object.entries({ claveActual, nuevaClave, confirmarClave })) {
      if (typeof value !== 'string' || Buffer.byteLength(value) > 72) require('../shared/http/validate').invalid(field);
    }
    if (!claveActual || !nuevaClave || !confirmarClave) throw new AppError(400, 'INVALID_INPUT', "Completa todos los campos de contrasena.");
    if (String(nuevaClave).length < 8) throw new AppError(400, 'INVALID_INPUT', "La nueva contrasena debe tener al menos 8 caracteres.");
    if (nuevaClave !== confirmarClave) throw new AppError(400, 'INVALID_INPUT', "La confirmacion no coincide con la nueva contrasena.");
    if (claveActual === nuevaClave) throw new AppError(400, 'INVALID_INPUT', "La nueva contrasena debe ser diferente a la actual.");

    const user = await UserRepository.findById(userId);
    if (!user || user.estatus !== 1) throw new AppError(404, 'NOT_FOUND', "Usuario no encontrado.");

    const isCurrentValid = await comparePassword(claveActual, user.clave);
    if (!isCurrentValid) throw new AppError(401, 'INVALID_CREDENTIALS', "La contrasena actual no es correcta.");

    const hashedPassword = await hashPassword(nuevaClave);
    await UserRepository.update(userId, { clave: hashedPassword, tokenVersion: { increment: 1 } });

    await writeActivityLog(null, {
      usuario: userId,
      modulo: "usuarios",
      accion: "cambiar_contrasena",
      descripcion: `El usuario ${user.nombre} cambio su contrasena.`,
      entidad: "tusuarios",
      entidadId: userId,
      nivel: "info",
      ip: requestIp,
      metadata: { correo: user.correo },
    });

    return true;
  }

  async updateUser(userId, payload, file, requestIp, adminId) {
    payload = userSchema(payload, { admin: true });
    const {
      estatus,
      tipo,
      clave,
      nombre,
      fechaNacimiento,
      genero,
      telefono,
      correo,
      domicilio,
      ciudad = "",
      estadoDireccion = "",
      codigoPostal = "",
      referenciasDomicilio = "",
    } = payload;
    const normalizedEmail = normalizeEmail(correo || "");
    const normalizedPostalCode = String(codigoPostal || "").replace(/\D/g, "");

    if (!nombre || String(nombre).trim().length < 3) throw new AppError(400, 'INVALID_INPUT', "El nombre debe tener al menos 3 caracteres.");
    if (!normalizedEmail) throw new AppError(400, 'INVALID_INPUT', "El correo es obligatorio.");

    const existingUsers = await UserRepository.findAll({ where: { correo: normalizedEmail, id: { not: Number(userId) } } });
    if (existingUsers.length > 0) {
      if (file) await cleanupTempFile(file);
      throw new AppError(409, 'CONFLICT', "Ya existe otro usuario con ese correo.");
    }

    const previousUser = await UserRepository.findById(userId);
    if (!previousUser) {
      if (file) await cleanupTempFile(file);
      throw new AppError(404, 'NOT_FOUND', "Usuario no encontrado.");
    }

    const location = hasLocationInput(payload)
      ? normalizeLocation(payload)
      : {
          latitud: previousUser.latitud,
          longitud: previousUser.longitud,
        };

    let fotoPerfil = previousUser.fotoPerfil;
    if (file) {
      fotoPerfil = await storeUserProfileImage({
        file,
        userId,
        name: nombre.trim(),
        tempFilePath: file.path,
        originalName: file.originalname,
      });
    }

    const dataToUpdate = {
      nombre: nombre.trim(),
      fechaNacimiento,
      genero,
      telefono: String(telefono).replace(/\D/g, ""),
      correo: normalizedEmail,
      domicilio: domicilio.trim(),
      ciudad: String(ciudad).trim() || null,
      estadoDireccion: String(estadoDireccion).trim() || null,
      codigoPostal: normalizedPostalCode || null,
      referenciasDomicilio: String(referenciasDomicilio).trim() || null,
      latitud: location.latitud,
      longitud: location.longitud,
      fotoPerfil
    };

    if (clave && clave.trim() !== "") {
      dataToUpdate.clave = await hashPassword(clave);
      dataToUpdate.tokenVersion = { increment: 1 };
    }

    const updated = await withTransaction(async tx => {
      await changeAccountAccess(tx, { targetId: userId, actorId: adminId, role: tipo, status: estatus });
      const result = await tx.tusuarios.update({ where: { id: Number(userId) }, data: dataToUpdate });
      await appendAudit(tx, { actorId: adminId, action: 'editar_usuario', entity: 'tusuarios', entityId: Number(userId) });
      return result;
    });

    if (file) file.committed = true;
    const { clave: _secret, tokenVersion: _version, ...safeUser } = updated;
    return safeUser;
  }

  async deleteUser(userId, adminId, requestIp) {
    await withTransaction(tx => changeAccountAccess(tx, { targetId: userId, actorId: adminId, status: 0 }));
    return true;
  }
}

const service = new UserService();
for (const name of ['createUser', 'updateUser', 'updateProfile']) {
  const method = service[name].bind(service);
  service[name] = async (...args) => {
    const file = name === 'createUser' ? args[1] : args[2];
    try { return await method(...args); }
    catch (error) { await cleanupTempFile(file); throw error; }
  };
}
module.exports = service;
