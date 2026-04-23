const getRequestIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return (
    req.ip ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    null
  );
};

const writeActivityLog = async (executor, payload) => {
  const {
    usuario = null,
    modulo,
    accion,
    descripcion,
    entidad = null,
    entidadId = null,
    nivel = "info",
    ip = null,
    metadata = null,
  } = payload;

  if (!modulo || !accion || !descripcion) {
    return;
  }

  await executor.query(
    `INSERT INTO tlogs
      (usuario, modulo, accion, descripcion, entidad, entidadId, nivel, ip, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      usuario,
      modulo,
      accion,
      descripcion,
      entidad,
      entidadId,
      nivel,
      ip,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
};

module.exports = {
  getRequestIp,
  writeActivityLog,
};
