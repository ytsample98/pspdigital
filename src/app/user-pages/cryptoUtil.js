const crypto = require("crypto");

const secretKey = "Yaanar";
const algorithm = "aes-256-cbc";

function encryptPassword(password) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    algorithm,
    crypto.scryptSync(secretKey, "salt", 32),
    iv
  );
  let encrypted = cipher.update(password, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}