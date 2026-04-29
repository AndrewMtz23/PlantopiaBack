const { verifyAuthToken } = require("../utils/jwt");

const extractBearerToken = (authorization = "") => {
  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice(7).trim();
};

const authenticateToken = (req, res, next) => {
  const token = extractBearerToken(req.headers.authorization || "");

  if (!token) {
    return res.status(401).json({ error: "Token de acceso requerido." });
  }

  try {
    req.auth = verifyAuthToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Token invalido o expirado." });
  }
};

const requireAdmin = (req, res, next) => {
  if (Number(req.auth?.tipo) !== 1) {
    return res.status(403).json({ error: "No tienes permisos de administrador." });
  }

  return next();
};

/**
 * Middleware para autorizar múltiples roles
 * @param {Array<number>} allowedRoles - Lista de tipos permitidos (1: Admin, 2: Cliente, 3: Empleado, 4: Repartidor)
 */
const authorizeRole = (allowedRoles = []) => (req, res, next) => {
  const userType = Number(req.auth?.tipo);

  if (allowedRoles.includes(userType)) {
    return next();
  }

  return res.status(403).json({ error: "No tienes los permisos necesarios para acceder a este recurso." });
};

const authorizeUserAccess = (getTargetUserId) => (req, res, next) => {
  const targetUserId = Number(getTargetUserId(req));
  const currentUserId = Number(req.auth?.idUsuario);
  const isAdmin = Number(req.auth?.tipo) === 1;

  if (isAdmin || (targetUserId && currentUserId === targetUserId)) {
    return next();
  }

  return res.status(403).json({ error: "No puedes acceder a recursos de otro usuario." });
};

module.exports = {
  authenticateToken,
  authorizeUserAccess,
  requireAdmin,
  authorizeRole,
};
