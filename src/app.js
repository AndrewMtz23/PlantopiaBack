require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");

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
const port = Number(process.env.PORT || 3001);
const publicDirectoryPath = process.env.PUBLIC_PATH || path.join(__dirname, "../public");
const uploadsDirectoryPath = process.env.UPLOADS_PATH || path.join(__dirname, "../uploads");

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(express.static(publicDirectoryPath));
app.use("/uploads", express.static(uploadsDirectoryPath));

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

module.exports = {
  app,
  port,
};
