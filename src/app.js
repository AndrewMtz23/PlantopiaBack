require("dotenv").config();
const config = require('./config/env').loadConfig();

const express = require("express");
const cors = require("cors");
const path = require("path");
const helmet = require('helmet');
const { requestContext } = require('./shared/http/requestContext');

// Ya no necesitamos la conexión a MySQL
// const db = require("./db/connection");

const createUserRoutes = require("./routes/users");
const createBranchRoutes = require("./routes/branches");
const createProviderRoutes = require("./routes/providers");
const createProductRoutes = require("./routes/products");
const createInventoryRoutes = require("./routes/inventory");
const createAuthRoutes = require("./routes/auth");
const createCommerceRoutes = require("./routes/commerce");
const createMetricsRoutes = require("./routes/metrics");
const createCategoryRoutes = require("./routes/categories");
const createPaymentRoutes = require("./routes/payments");
const createLogRoutes = require("./routes/logs");

const app = express();
const { errorContract, errorHandler } = require('./middleware/errorHandler');
const port = config.port;
const publicDirectoryPath = process.env.PUBLIC_PATH || path.join(__dirname, "../public");
const uploadsDirectoryPath = process.env.UPLOADS_PATH || path.join(__dirname, "../uploads");

app.set('trust proxy', config.trustProxy);
app.use(requestContext);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, strictTransportSecurity: process.env.NODE_ENV === 'production' ? undefined : false }));
app.use(cors({ origin: (origin, done) => done(null, Boolean(origin && config.allowedOrigins.includes(origin))), exposedHeaders: ['X-Request-Id'] }));
app.use(errorContract);
app.use(express.json({ limit: config.bodyLimit }));
app.use(express.static(publicDirectoryPath));
app.use('/uploads/tmp', (req, res) => res.status(404).json({ error: 'Recurso no encontrado.' }));
app.use("/uploads", express.static(uploadsDirectoryPath));
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/ready', async (req, res, next) => {
  try { await require('./config/prisma').$queryRaw`SELECT 1`; res.json({ ok: true }); }
  catch (error) { next(error); }
});

// Ahora las rutas no necesitan pasarles el objeto 'db' de MySQL
app.use("/auth", createAuthRoutes());
app.use(createUserRoutes());
app.use(createBranchRoutes());
app.use(createProviderRoutes());
app.use(createProductRoutes());
app.use(createInventoryRoutes());
app.use(createCommerceRoutes());
app.use("/commerce", createCommerceRoutes());
app.use(createLogRoutes());
app.use(createMetricsRoutes());
app.use(createCategoryRoutes());
app.use(createPaymentRoutes());

app.use((req, res) => {
  console.warn(`Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

app.use(errorHandler);
module.exports = {
  app,
  port,
};
