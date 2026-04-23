require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const path = require("path");
const bodyParser = require("body-parser");
const db = require("./db/connection");
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

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(fileUpload());

app.use("/auth", createAuthRoutes(db));
app.use(createUserRoutes(db));
app.use(createBranchRoutes(db));
app.use(createProviderRoutes(db));
app.use(createProductRoutes(db, publicDirectoryPath));
app.use(createInventoryRoutes(db));
app.use(createCommerceRoutes(db));
app.use(createPaymentRoutes(db));
app.use(createLogRoutes(db));
app.use(createMetricsRoutes(db));
app.use(createCategoryRoutes(db));

module.exports = {
  app,
  db,
  port,
};
