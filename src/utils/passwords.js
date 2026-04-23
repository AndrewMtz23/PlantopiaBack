const bcrypt = require("bcryptjs");

const HASH_PREFIX = "$2";
const SALT_ROUNDS = 10;

const isHashedPassword = (value = "") =>
  typeof value === "string" && value.startsWith(HASH_PREFIX);

const hashPassword = async (plainPassword) => bcrypt.hash(plainPassword, SALT_ROUNDS);

const comparePassword = async (plainPassword, storedPassword) => {
  if (!storedPassword) {
    return false;
  }

  if (isHashedPassword(storedPassword)) {
    return bcrypt.compare(plainPassword, storedPassword);
  }

  return plainPassword === storedPassword;
};

module.exports = {
  comparePassword,
  hashPassword,
  isHashedPassword,
};
