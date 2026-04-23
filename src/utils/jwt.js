const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "plantopia-dev-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

const signAuthToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

const verifyAuthToken = (token) => jwt.verify(token, JWT_SECRET);

module.exports = {
  signAuthToken,
  verifyAuthToken,
};
