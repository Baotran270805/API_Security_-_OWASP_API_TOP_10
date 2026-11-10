"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { DatabaseSync } = require("node:sqlite");
const { getKey, encrypt } = require("./encryption");

const mode = process.env.LAB_MODE === "vulnerable" ? "vulnerable" : "secure";
const dataDir = path.join(__dirname, "data", mode);
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, "lab.db"));
db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
const encryptionKey = getKey(dataDir);

function getJwtSecret() {
  const secretPath = path.join(dataDir, "jwt-secret.bin");
  if (!fs.existsSync(secretPath)) {
    fs.writeFileSync(secretPath, crypto.randomBytes(48), { mode: 0o600, flag: "wx" });
  }
  return fs.readFileSync(secretPath).toString("hex");
}

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'USER',
      phone_encrypted TEXT NOT NULL DEFAULT '',
      national_id_encrypted TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      is_public INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const existing = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  if (existing) return;
  const addUser = db.prepare(`INSERT INTO users
    (id,username,email,full_name,password_hash,role,phone_encrypted,national_id_encrypted)
    VALUES (?,?,?,?,?,?,?,?)`);
  addUser.run(1,"alice","alice@example.test","Alice Nguyen",bcrypt.hashSync("Alice@123",10),"USER",encrypt("DEMO-PHONE-01",encryptionKey),encrypt("DEMO-ID-A001",encryptionKey));
  addUser.run(2,"bob","bob@example.test","Bob Tran",bcrypt.hashSync("Bob@123",10),"USER",encrypt("DEMO-PHONE-02",encryptionKey),encrypt("DEMO-ID-B002",encryptionKey));
  addUser.run(3,"admin","admin@example.test","System Admin",bcrypt.hashSync("Admin@123",10),"ADMIN",encrypt("DEMO-PHONE-03",encryptionKey),encrypt("DEMO-ID-C003",encryptionKey));
  const addDoc = db.prepare("INSERT INTO documents (id,owner_id,title,content,is_public) VALUES (?,?,?,?,?)");
  addDoc.run(101,1,"Báo cáo bảo mật API","Tài liệu riêng của Alice: ghi chú về JWT và xác thực.",0);
  addDoc.run(102,2,"Kế hoạch nghiên cứu Bob","Tài liệu riêng của Bob: chỉ Bob có quyền xem.",0);
  addDoc.run(103,1,"Checklist kiểm thử","Kiểm thử đăng nhập, phân quyền, dữ liệu trả về.",0);
  addDoc.run(104,3,"Tài liệu quản trị","Tài liệu phục vụ đội quản trị hệ thống.",0);
}

initDatabase();
module.exports = { db, mode, dataDir, encryptionKey, jwtSecret: getJwtSecret() };
