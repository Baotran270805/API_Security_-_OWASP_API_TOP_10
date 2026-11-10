"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

// Each lab mode uses its own persistent key, stored outside public/.
function getKey(dataDir) {
  const file = path.join(dataDir, "aes-key.bin");
  if (!fs.existsSync(file)) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, crypto.randomBytes(32), { mode: 0o600, flag: "wx" });
  }
  const key = fs.readFileSync(file);
  if (key.length !== 32) throw new Error("Invalid AES key length");
  return key;
}

function encrypt(plain, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(value, key) {
  if (!value || typeof value !== "string" || !value.startsWith("enc:v1:")) return "";
  const segments = value.split(":");
  if (segments.length !== 5) throw new Error("Invalid encrypted value");
  const [, , iv, tag, ciphertext] = segments;
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "hex")), decipher.final()]).toString("utf8");
}

module.exports = { getKey, encrypt, decrypt };
