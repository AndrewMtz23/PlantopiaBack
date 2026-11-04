const messages = { 400: 'Solicitud invalida.', 401: 'Sesion invalida o expirada.', 403: 'Sin permisos.', 404: 'Recurso no encontrado.', 409: 'La operacion entra en conflicto con el estado actual.', 429: 'Demasiados intentos. Intenta mas tarde.', 500: 'Error interno del servidor.' };
const codes = { 400: 'BAD_REQUEST', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 429: 'RATE_LIMITED', 500: 'INTERNAL_ERROR' };
function errorContract(req, res, next) {
  const json = res.json.bind(res);
  res.json = body => {
    if (res.statusCode >= 400 && body?.error) {
      const status = res.statusCode;
      const raw = typeof body.error === 'string' ? body.error : body.error.message;
      const structured = typeof body.error === 'object';
      body = { error: { code: body.error.code || codes[status] || 'REQUEST_FAILED', message: status >= 500 || !structured ? messages[status] || messages[500] : raw || messages[status], ...(body.error.fields ? { fields: body.error.fields } : {}), requestId: req.requestId } };
    }
    return json(body);
  };
  next();
}
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  require('../infrastructure/logging/logger').writeTechnicalLog({ level: 'error', event: 'request_failed', requestId: req.requestId });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'La solicitud excede el limite permitido.' } });
  if (['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'ECONNREFUSED', 'ECONNRESET'].includes(error.code)) return res.status(503).json({ error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Servicio temporalmente no disponible.' } });
  const typed = error instanceof require('../utils/AppError');
  const status = typed ? error.status : error.type === 'entity.parse.failed' ? 400 : error.code === 'P2025' ? 404 : ['P2002', 'P2003'].includes(error.code) ? 409 : 500;
  res.status(status).json({ error: { code: typed ? error.code : codes[status], message: typed ? error.message : messages[status], ...(typed && error.fields ? { fields: error.fields } : {}) } });
}
module.exports = { errorContract, errorHandler };
