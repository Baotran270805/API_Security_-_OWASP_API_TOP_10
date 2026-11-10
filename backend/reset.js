"use strict";
const fs = require("node:fs");
const path = require("node:path");
const mode = process.env.LAB_MODE === "vulnerable" ? "vulnerable" : "secure";
const dir = path.join(__dirname, "data", mode);
for (const name of ["lab.db", "lab.db-wal", "lab.db-shm"]) {
  const p = path.join(dir, name);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
console.log(`Reset ${mode} demo data. Start or restart the server to reseed. Do not reset while server is running.`);
