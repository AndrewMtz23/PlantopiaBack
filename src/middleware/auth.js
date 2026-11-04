const { verifyAuthToken } = require("../utils/jwt");
const prisma = require('../config/prisma');

const extractBearerToken = (authorization = "") => {
  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice(7).trim();
};

const authenticateToken = async (req, res, next) => {
  const token = extractBearerToken(req.headers.authorization || "");

  if (!token) {
    return res.status(401).json({ error: "Token de acceso requerido." });
  }

  let claims;
  try {
    claims = verifyAuthToken(token);
    if (!Number.isInteger(claims.idUsuario)) throw new Error('Invalid identity');
  } catch {
    return res.status(401).json({ error: 'Token invalido o expirado.' });
  }
  try {
    const user = await prisma.tusuarios.findUnique({ where: { id: claims.idUsuario },
      select: { id: true, tipo: true, estatus: true, tokenVersion: true } });
    if (!user || user.estatus !== 1 || claims.tokenVersion !== user.tokenVersion) return res.status(401).json({ error: 'Token invalido o expirado.' });
    req.auth = { ...claims, tipo: user.tipo };
    return next();
  } catch (error) {
    return next(new (require('../utils/AppError'))(503, 'AUTH_UNAVAILABLE', 'No se pudo verificar la sesion. Intenta de nuevo.'));
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

  if (Number.isInteger(targetUserId) && targetUserId > 0 && currentUserId === targetUserId) {
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
