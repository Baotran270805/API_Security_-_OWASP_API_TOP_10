"use strict";
const express = require("express");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { db, mode, encryptionKey, jwtSecret } = require("./db");
const { decrypt, encrypt } = require("./encryption");

const app = express();
const VULNERABLE = mode === "vulnerable";
const host = "127.0.0.1"; // NEVER expose the intentionally vulnerable demo externally.
const port = Number(process.env.PORT || (VULNERABLE ? 3101 : 3100));
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid port");

app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" })); // operational ceiling: safe even in vulnerable mode
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

function fail(res, status, message) { return res.status(status).json({ message }); }
function safeString(value, max = 100) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function docRow(row) {
  if (!row) return null;
  return { id: row.id, owner_id: row.owner_id, title: row.title, content: row.content,
    is_public: Boolean(row.is_public), created_at: row.created_at, updated_at: row.updated_at };
}
function auth(req, res, next) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || "");
  if (!match) return fail(res, 401, "Missing Bearer token");
  try {
    const payload = jwt.verify(match[1], jwtSecret, { algorithms: ["HS256"] });
    const user = db.prepare("SELECT id,username,email,full_name,role FROM users WHERE id = ?").get(payload.userId);
    if (!user) return fail(res, 401, "Account not found");
    req.user = user;
    next();
  } catch {
    return fail(res, 401, "Invalid or expired token");
  }
}

app.get("/api/config", (_req, res) => res.json({ mode, label: VULNERABLE ? "Chế độ có lỗ hổng (chỉ localhost)" : "Chế độ đã khắc phục" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok", message: "API Security Web Lab is running", mode }));

app.post("/api/register", async (req, res) => {
  const username = safeString(req.body?.username, 40).toLowerCase();
  const email = safeString(req.body?.email, 120).toLowerCase();
  const fullName = safeString(req.body?.full_name, 120);
  const password = req.body?.password;
  if (!/^[a-z0-9_]{3,40}$/.test(username) || !/^\S+@\S+\.\S+$/.test(email) || !fullName || typeof password !== "string" || password.length < 8 || password.length > 128) {
    return fail(res, 400, "Username, email, full name or password is invalid");
  }
  if (db.prepare("SELECT id FROM users WHERE username = ? OR email = ?").get(username, email)) return fail(res, 409, "Username or email already exists");
  const passwordHash = await bcrypt.hash(password, 10);
  const result = db.prepare("INSERT INTO users(username,email,full_name,password_hash,role) VALUES (?,?,?,?,?)").run(username,email,fullName,passwordHash,"USER");
  return res.status(201).json({ id: Number(result.lastInsertRowid), username, role: "USER" });
});

// API2:2023 Broken Authentication: the local vulnerable version omits password verification.
app.post("/api/login", async (req, res) => {
  const username = safeString(req.body?.username, 40).toLowerCase();
  const password = req.body?.password;
  const user = db.prepare("SELECT id,username,password_hash FROM users WHERE username = ?").get(username);
  if (!user) return fail(res, 401, "Invalid credentials");
  if (!VULNERABLE) {
    if (typeof password !== "string" || !await bcrypt.compare(password, user.password_hash)) {
      return fail(res, 401, "Invalid credentials");
    }
  } // VULNERABILITY: password is ignored in vulnerable mode.
  const token = jwt.sign({ userId: user.id }, jwtSecret, { algorithm: "HS256", expiresIn: "15m" });
  return res.json({ message: "Login successful", token });
});

// API3/2019 Excessive Data Exposure: intentionally includes private fields in vulnerable mode.
app.get("/api/profile", auth, (req, res) => {
  if (VULNERABLE) {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    return res.json({ ...user, phone: decrypt(user.phone_encrypted, encryptionKey),
      national_id: decrypt(user.national_id_encrypted, encryptionKey) });
  }
  return res.json({ id: req.user.id, username: req.user.username,
    full_name: req.user.full_name, email: req.user.email, role: req.user.role });
});

app.get("/api/documents", auth, (req, res) => {
  const rows = db.prepare("SELECT * FROM documents WHERE owner_id = ? ORDER BY id DESC").all(req.user.id);
  return res.json({ documents: rows.map(docRow) });
});

// SQL Injection: untrusted search text is concatenated in vulnerable mode.
// This is deliberately limited to local, seeded SQLite data; secure mode uses bound parameters.
app.get("/api/documents/search", auth, (req, res) => {
  const q = safeString(req.query.q, 90);
  if (!q) return res.json({ documents: [] });
  try {
    let rows;
    if (VULNERABLE) {
      const sql = `SELECT * FROM documents WHERE owner_id = ${req.user.id} AND title LIKE '%${q}%' ORDER BY id DESC LIMIT 30`;
      rows = db.prepare(sql).all(); // VULNERABILITY: SQL text composition.
    } else {
      const like = `%${q}%`;
      rows = db.prepare("SELECT * FROM documents WHERE owner_id = ? AND title LIKE ? ORDER BY id DESC LIMIT 30").all(req.user.id, like);
    }
    return res.json({ documents: rows.map(docRow) });
  } catch {
    return fail(res, 400, "Search input could not be processed");
  }
});

app.post("/api/documents", auth, (req, res) => {
  const title = safeString(req.body?.title, 120);
  const content = safeString(req.body?.content, 4000);
  if (!title) return fail(res, 400, "Title is required");
  const result = db.prepare("INSERT INTO documents(owner_id,title,content) VALUES(?,?,?)").run(req.user.id,title,content);
  const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(Number(result.lastInsertRowid));
  return res.status(201).json(docRow(row));
});

// API1:2023 BOLA: deliberately omits owner-level authorization in vulnerable mode.
app.get("/api/documents/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return fail(res, 400, "Invalid document ID");
  const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
  if (!row) return fail(res, 404, "Document not found");
  if (!VULNERABLE && row.owner_id !== req.user.id) return fail(res, 403, "Access denied");
  return res.json(docRow(row));
});

// API3:2023 Mass Assignment: vulnerable mode trusts owner_id and is_public from the client.
app.patch("/api/documents/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return fail(res, 400, "Invalid document ID");
  const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
  if (!row) return fail(res, 404, "Document not found");
  if (row.owner_id !== req.user.id) return fail(res, 403, "Access denied");
  const input = req.body || {};
  if (!VULNERABLE && Object.keys(input).some(k => !["title","content"].includes(k))) {
    return fail(res, 400, "Only title and content can be modified");
  }
  const title = input.title === undefined ? row.title : safeString(input.title, 120);
  const content = input.content === undefined ? row.content : safeString(input.content, 4000);
  if (!title) return fail(res, 400, "Title is required");
  let ownerId = row.owner_id, isPublic = row.is_public;
  if (VULNERABLE) {
    if (input.owner_id !== undefined) {
      const proposed = Number(input.owner_id);
      if (!Number.isSafeInteger(proposed) || !db.prepare("SELECT id FROM users WHERE id = ?").get(proposed)) return fail(res, 400, "Invalid owner_id");
      ownerId = proposed; // VULNERABILITY: an untrusted client changes ownership.
    }
    if (input.is_public !== undefined) isPublic = input.is_public ? 1 : 0;
  }
  db.prepare("UPDATE documents SET title=?,content=?,owner_id=?,is_public=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(title,content,ownerId,isPublic,id);
  return res.json(docRow(db.prepare("SELECT * FROM documents WHERE id=?").get(id)));
});

app.delete("/api/documents/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return fail(res, 400, "Invalid document ID");
  const row = db.prepare("SELECT owner_id FROM documents WHERE id=?").get(id);
  if (!row) return fail(res,404,"Document not found");
  if (row.owner_id !== req.user.id) return fail(res,403,"Access denied");
  db.prepare("DELETE FROM documents WHERE id=?").run(id);
  return res.json({ message: "Document deleted" });
});

// API5:2023 BFLA: ordinary users may call admin-only function in vulnerable mode.
app.get("/api/admin/stats", auth, (req, res) => {
  if (!VULNERABLE && req.user.role !== "ADMIN") return fail(res, 403, "Admin access required");
  const users = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  const docs = db.prepare("SELECT COUNT(*) AS n FROM documents").get().n;
  const byOwner = db.prepare("SELECT u.username, COUNT(d.id) AS document_count FROM users u LEFT JOIN documents d ON d.owner_id=u.id GROUP BY u.id ORDER BY u.id").all();
  return res.json({ total_users: users, total_documents: docs, documents_by_user: byOwner });
});

// API4:2023: per-request business cap absent in vulnerable mode.
// Hard operational ceiling (1200) deliberately prevents stress testing/DoS in a teaching lab.
app.post("/api/reports/preview", auth, (req, res) => {
  const count = Number(req.body?.count);
  if (!Number.isSafeInteger(count) || count < 1) return fail(res, 400, "Count must be a positive integer");
  if (count > 1200) return fail(res, 413, "Demo safety ceiling: max 1200");
  if (!VULNERABLE && count > 50) return fail(res, 413, "Business limit: max 50 items per request");
  const items = Array.from({ length: count }, (_, i) => ({ index: i+1, label: `Bản ghi mô phỏng ${i+1}` }));
  return res.json({ count, items });
});

// Serve a multi-page browser UI with client-side route rendering.
const publicDir = path.resolve(__dirname, "../public");
app.use(express.static(publicDir, { index: false }));
app.get(/^\/(?:|login|register|dashboard|documents|documents\/\d+|profile|admin|lab)\/?$/, (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});
app.use((req, res) => fail(res, 404, "Route not found"));
app.use((err, _req, res, _next) => {
  if (err?.type === "entity.too.large") return fail(res, 413, "Request JSON too large");
  if (err instanceof SyntaxError && "body" in err) return fail(res, 400, "Malformed JSON");
  console.error("Request error:", err?.message);
  return fail(res, 500, "Internal error");
});

app.listen(port, host, () => {
  console.log(`\nAPI Security Web Lab (${mode.toUpperCase()})`);
  console.log(`Website: http://${host}:${port}/`);
  console.log("Localhost only. NEVER deploy vulnerable mode or copy sample credentials to production.\n");
});
