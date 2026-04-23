const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10,15}$/;

const normalizeEmail = (value = "") => value.trim().toLowerCase();

const validateLoginPayload = ({ correo, clave }) => {
  if (!correo || !clave) {
    return "Correo y contrasena son obligatorios.";
  }

  if (!EMAIL_REGEX.test(normalizeEmail(correo))) {
    return "Ingresa un correo electronico valido.";
  }

  if (String(clave).trim().length < 1) {
    return "La contrasena es obligatoria.";
  }

  return null;
};

const validateUserPayload = ({
  nombre,
  clave,
  fechaNacimiento,
  genero,
  telefono,
  correo,
  domicilio,
}) => {
  if (!nombre || String(nombre).trim().length < 3) {
    return "El nombre debe tener al menos 3 caracteres.";
  }

  if (!clave || String(clave).length < 8) {
    return "La contrasena debe tener al menos 8 caracteres.";
  }

  if (!fechaNacimiento) {
    return "La fecha de nacimiento es obligatoria.";
  }

  if (!genero) {
    return "Selecciona un genero valido.";
  }

  if (!telefono || !PHONE_REGEX.test(String(telefono).replace(/\D/g, ""))) {
    return "El telefono debe contener entre 10 y 15 digitos.";
  }

  if (!correo || !EMAIL_REGEX.test(normalizeEmail(correo))) {
    return "Ingresa un correo electronico valido.";
  }

  if (!domicilio || String(domicilio).trim().length < 8) {
    return "El domicilio debe tener al menos 8 caracteres.";
  }

  return null;
};

module.exports = {
  normalizeEmail,
  validateLoginPayload,
  validateUserPayload,
};
