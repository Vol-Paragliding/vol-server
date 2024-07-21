const sqlite3 = require("sqlite3");
const mkdirp = require("mkdirp");
const crypto = require("crypto");
require("dotenv").config();

mkdirp.sync("./var/db");

const db = new sqlite3.Database("./var/db/vol.db");

const createTable = () => {
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT,
      username TEXT UNIQUE NOT NULL,
      hashed_password BLOB NULL,
      salt BLOB NULL,
      email TEXT,
      googleId TEXT UNIQUE,
      name TEXT
    )`
  );
};

// create an initial user (username: alice, password: letmein)
const createInitialUser = () => {
  const salt = crypto.randomBytes(16);
  const hashedPassword = crypto.pbkdf2Sync(
    "letmein",
    salt,
    310000,
    32,
    "sha256"
  );
  db.run(
    "INSERT OR IGNORE INTO users (id, username, hashed_password, salt) VALUES (?, ?, ?, ?)",
    [crypto.randomUUID(), "alice", hashedPassword, salt]
  );
};

db.serialize(function () {
  createTable();
  createInitialUser();
});

module.exports = db;
