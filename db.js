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
      name TEXT,
      profile TEXT
    )`,
    (err) => {
      if (err) {
        console.error(`Error creating users table: ${err.message}`);
      } else {
        console.info("Users table created or already exists.");
      }
    }
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
    [crypto.randomUUID(), "alice", hashedPassword, salt],
    (err) => {
      if (err) {
        console.error(`Error inserting initial user: ${err.message}`);
      } else {
        console.info("Initial user inserted or already exists.");
      }
    }
  );
};

// Function to ensure new columns exist
const columns = [{ name: "profile", type: "TEXT" }];

function columnExists(columnName, callback) {
  db.all(`PRAGMA table_info(users)`, (err, tableInfo) => {
    if (err) {
      console.error(`Error fetching table info for column ${columnName}:`, err);
      callback(false);
    } else {
      const exists =
        Array.isArray(tableInfo) &&
        tableInfo.some((col) => col.name === columnName);
      callback(exists);
    }
  });
}

function addColumn(columnName, columnType, callback) {
  db.run(`ALTER TABLE users ADD COLUMN ${columnName} ${columnType}`, (err) => {
    if (err) {
      console.error(`Error adding column ${columnName}:`, err);
    } else {
      console.log(`Added column ${columnName}`);
    }
    callback(err);
  });
}

function ensureColumnsExist(columns, callback) {
  let completed = 0;

  columns.forEach(({ name, type }) => {
    columnExists(name, (exists) => {
      if (!exists) {
        addColumn(name, type, (err) => {
          if (err) {
            console.error(`Failed to add column ${name}. Aborting.`);
            process.exit(1);
          }
          if (++completed === columns.length) callback();
        });
      } else {
        console.log(`Column ${name} already exists`);
        if (++completed === columns.length) callback();
      }
    });
  });
}

db.serialize(function () {
  createTable();
  createInitialUser();
  ensureColumnsExist(columns, () => {
    console.log("All necessary columns checked/added.");
  });
});

module.exports = db;
