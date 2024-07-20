const sqlite3 = require("sqlite3");
const mkdirp = require("mkdirp");
const crypto = require("crypto");

mkdirp.sync("./var/db");

const db = new sqlite3.Database("./var/db/vol.db");

const createTable = () => {
  db.run(
    "CREATE TABLE IF NOT EXISTS users ( \
      id TEXT PRIMARY KEY NOT NULL, \
      username TEXT UNIQUE NOT NULL, \
      hashed_password BLOB, \
      salt BLOB, \
      email TEXT, \
      googleId TEXT UNIQUE \
    )"
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

const addGoogleIdColumn = () => {
  db.all("PRAGMA table_info(users);", (err, columns) => {
    if (err) {
      console.error("Error checking table schema:", err.message);
      return;
    }

    const columnExists = columns.some((column) => column.name === "googleId");
    if (!columnExists) {
      db.run("ALTER TABLE users ADD COLUMN googleId TEXT UNIQUE", (err) => {
        if (err) {
          console.error("Error adding googleId column:", err.message);
        } else {
          console.log("googleId column added successfully.");
        }
      });
    } else {
      console.log("googleId column already exists.");
    }
  });
};

const addEmailColumn = () => {
  db.all("PRAGMA table_info(users);", (err, columns) => {
    if (err) {
      console.error("Error checking table schema:", err.message);
      return;
    }

    const columnExists = columns.some((column) => column.name === "email");
    if (!columnExists) {
      db.run("ALTER TABLE users ADD COLUMN email TEXT", (err) => {
        if (err) {
          console.error("Error adding email column:", err.message);
        } else {
          console.log("email column added successfully.");
        }
      });
    } else {
      console.log("email column already exists.");
    }
  });
};

const updateSchema = () => {
  db.all("PRAGMA table_info(users);", (err, columns) => {
    if (err) {
      console.error("Error checking table schema:", err.message);
      return;
    }

    const hashedPasswordColumn = columns.find(
      (column) => column.name === "hashed_password"
    );
    const saltColumn = columns.find((column) => column.name === "salt");

    if (hashedPasswordColumn && hashedPasswordColumn.notnull) {
      db.run(
        "CREATE TABLE IF NOT EXISTS users_temp ( \
        id TEXT PRIMARY KEY NOT NULL, \
        username TEXT UNIQUE NOT NULL, \
        hashed_password BLOB NULL, \
        salt BLOB NULL, \
        email TEXT, \
        googleId TEXT UNIQUE \
      )",
        (err) => {
          if (err) {
            console.error("Error creating temporary table:", err.message);
            return;
          }

          db.run(
            "INSERT INTO users_temp SELECT id, username, hashed_password, salt, email, googleId FROM users",
            (err) => {
              if (err) {
                console.error(
                  "Error copying data to temporary table:",
                  err.message
                );
                return;
              }

              db.run("DROP TABLE users", (err) => {
                if (err) {
                  console.error("Error dropping old users table:", err.message);
                  return;
                }

                db.run("ALTER TABLE users_temp RENAME TO users", (err) => {
                  if (err) {
                    console.error(
                      "Error renaming temporary table:",
                      err.message
                    );
                    return;
                  }

                  console.log("Schema updated successfully.");
                });
              });
            }
          );
        }
      );
    }
  });
};

db.serialize(function () {
  createTable();
  addGoogleIdColumn();
  addEmailColumn();
  updateSchema();
  createInitialUser();
});

module.exports = db;
