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
    throw new Error(`${label} no es valida.`);
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
    throw new Error("Completa latitud y longitud para guardar la ubicacion.");
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
      throw new Error(validationError);
    }

    // Verificar duplicado
    const existingUser = await UserRepository.findByEmail(normalizedPayload.correo);
    if (existingUser) {
      if (file) await cleanupTempFile(file);
      throw new Error('Ya existe un usuario con ese correo.');
    }

    const hashedPassword = await hashPassword(clave);

    // Crear usuario
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
    });

    let fotoPerfil = null;
    if (file) {
      fotoPerfil = await storeUserProfileImage({
        userId: newUser.id,
        name: newUser.nombre,
        tempFilePath: file.path,
        originalName: file.originalname,
      });
      await UserRepository.update(newUser.id, { fotoPerfil });
    }

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

    return { ...newUser, fotoPerfil };
  }

  async getAllUsers() {
    return await UserRepository.findAll({
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
  }

  async getProfile(userId) {
    const user = await UserRepository.getProfile(userId);
    if (!user || user.estatus !== 1) throw new Error('Usuario no encontrado.');
    return user;
  }

  async getUserById(userId, requesterId, isAdmin) {
    if (!isAdmin && Number(userId) !== Number(requesterId)) {
      throw new Error('No puedes consultar otro usuario.');
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
    if (!user) throw new Error('Usuario no encontrado');
    return user;
  }

  async updateProfile(userId, payload, file, requestIp) {
    const { nombre, fechaNacimiento, genero, telefono, correo, domicilio, ciudad = "", estadoDireccion = "", codigoPostal = "", referenciasDomicilio = "" } = payload;
    const normalizedEmail = normalizeEmail(correo || "");
    const normalizedPostalCode = String(codigoPostal || "").replace(/\D/g, "");

    // Validaciones
    if (!nombre || String(nombre).trim().length < 3) throw new Error("El nombre debe tener al menos 3 caracteres.");
    if (!fechaNacimiento) throw new Error("La fecha de nacimiento es obligatoria.");
    if (!genero) throw new Error("Selecciona un genero valido.");
    if (!telefono || String(telefono).replace(/\D/g, "").length < 10) throw new Error("El telefono debe tener al menos 10 digitos.");
    if (!normalizedEmail) throw new Error("El correo es obligatorio.");
    if (!domicilio || String(domicilio).trim().length < 8) throw new Error("El domicilio debe tener al menos 8 caracteres.");
    if (normalizedPostalCode && (normalizedPostalCode.length < 5 || normalizedPostalCode.length > 10)) throw new Error("El codigo postal debe tener entre 5 y 10 digitos.");

    const existingUsers = await UserRepository.findAll({ where: { correo: normalizedEmail, id: { not: Number(userId) } } });
    if (existingUsers.length > 0) {
      if (file) await cleanupTempFile(file);
      throw new Error("Ya existe otro usuario con ese correo.");
    }

    const previousUser = await UserRepository.findById(userId);
    if (!previousUser || previousUser.estatus !== 1) {
      if (file) await cleanupTempFile(file);
      throw new Error("Usuario no encontrado.");
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
    if (!claveActual || !nuevaClave || !confirmarClave) throw new Error("Completa todos los campos de contrasena.");
    if (String(nuevaClave).length < 8) throw new Error("La nueva contrasena debe tener al menos 8 caracteres.");
    if (nuevaClave !== confirmarClave) throw new Error("La confirmacion no coincide con la nueva contrasena.");
    if (claveActual === nuevaClave) throw new Error("La nueva contrasena debe ser diferente a la actual.");

    const user = await UserRepository.findById(userId);
    if (!user || user.estatus !== 1) throw new Error("Usuario no encontrado.");

    const isCurrentValid = await comparePassword(claveActual, user.clave);
    if (!isCurrentValid) throw new Error("La contrasena actual no es correcta.");

    const hashedPassword = await hashPassword(nuevaClave);
    await UserRepository.update(userId, { clave: hashedPassword });

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

    if (!nombre || String(nombre).trim().length < 3) throw new Error("El nombre debe tener al menos 3 caracteres.");
    if (!normalizedEmail) throw new Error("El correo es obligatorio.");

    const existingUsers = await UserRepository.findAll({ where: { correo: normalizedEmail, id: { not: Number(userId) } } });
    if (existingUsers.length > 0) {
      if (file) await cleanupTempFile(file);
      throw new Error("Ya existe otro usuario con ese correo.");
    }

    const previousUser = await UserRepository.findById(userId);
    if (!previousUser) {
      if (file) await cleanupTempFile(file);
      throw new Error("Usuario no encontrado.");
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
        userId,
        name: nombre.trim(),
        tempFilePath: file.path,
        originalName: file.originalname,
      });
    }

    const dataToUpdate = {
      estatus: Number(estatus),
      tipo: Number(tipo),
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
    }

    const updated = await UserRepository.update(userId, dataToUpdate);

    await writeActivityLog(null, {
      usuario: adminId || null,
      modulo: "usuarios",
      accion: "editar_usuario",
      descripcion: `Se actualizo el usuario ${previousUser.nombre} (#${userId}).`,
      entidad: "tusuarios",
      entidadId: Number(userId),
      nivel: "info",
      ip: requestIp,
      metadata: { antes: { nombre: previousUser.nombre }, despues: { nombre: updated.nombre }, actualizoClave: Boolean(clave), actualizoFoto: Boolean(file) },
    });

    return updated;
  }

  async deleteUser(userId, adminId, requestIp) {
    if (!Number.isFinite(Number(userId))) throw new Error("Id de usuario invalido.");
    if (Number(userId) === Number(adminId)) throw new Error("No puedes desactivar tu propia cuenta desde el panel.");

    const user = await UserRepository.findById(userId);
    if (!user) throw new Error("Usuario no encontrado.");
    if (user.estatus === 0) throw new Error("El usuario ya se encuentra inactivo.");

    await UserRepository.update(userId, { estatus: 0 });

    await writeActivityLog(null, {
      usuario: adminId || null,
      modulo: "usuarios",
      accion: "desactivar_usuario",
      descripcion: `Se desactivo el usuario ${user.nombre} (#${userId}).`,
      entidad: "tusuarios",
      entidadId: Number(userId),
      nivel: "warning",
      ip: requestIp,
      metadata: { correo: user.correo, estatusAnterior: user.estatus, estatusNuevo: 0 },
    });

    return true;
  }
}

module.exports = new UserService();
