const mysql = require("mysql2");

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} no esta configurado.`);
  }

  return value;
};

const db = mysql.createPool({
  host: requireEnv("DB_HOST"),
  user: requireEnv("DB_USER"),
  password: requireEnv("DB_PASSWORD"),
  database: requireEnv("DB_NAME"),
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
});

module.exports = db;
