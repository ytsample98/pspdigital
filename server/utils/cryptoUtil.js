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

function decryptPassword(encryptedData) {
  const [ivHex, encrypted] = encryptedData.split(":");
  const decipher = crypto.createDecipheriv(
    algorithm,
    crypto.scryptSync(secretKey, "salt", 32),
    Buffer.from(ivHex, "hex")
  );
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

module.exports = { encryptPassword, decryptPassword };