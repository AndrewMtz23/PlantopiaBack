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

const prisma = require('../config/prisma');

const resetLogSequence = async () => {
  await prisma.$executeRaw`
    SELECT setval(
      pg_get_serial_sequence('"tlogs"', 'id'),
      COALESCE((SELECT MAX(id) FROM "tlogs"), 0) + 1,
      false
    )
  `;
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

  const createLog = () =>
    prisma.tlogs.create({
      data: {
        usuario,
        modulo,
        accion,
        descripcion,
        entidad,
        entidadId,
        nivel,
        ip,
        metadata: metadata ? metadata : null,
      }
    });

  try {
    await createLog();
  } catch (error) {
    if (error?.code === "P2002" || error?.meta?.driverAdapterError) {
      try {
        await resetLogSequence();
        await createLog();
        return;
      } catch (retryError) {
        console.warn("Activity log skipped after sequence repair attempt:", retryError.message);
        return;
      }
    }

    console.warn("Activity log skipped:", error.message);
  }
};

module.exports = {
  getRequestIp,
  writeActivityLog,
};
