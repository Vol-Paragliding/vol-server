const { connect } = require("getstream");
const StreamChat = require("stream-chat").StreamChat;
require("dotenv").config();
const db = require("../db");

const updateUserUsername = async (id, newUsername, cb) => {
  const sql = "UPDATE users SET username = $1 WHERE id = $2";
  try {
    await db.query(sql, [newUsername, id]);
    cb(null, { message: "Username updated successfully" });
  } catch (err) {
    console.error("Error updating username in PostgreSQL:", err);
    cb(err);
  }
};

const getAllUsers = async (cb) => {
  const sql = "SELECT * FROM users WHERE id != 'zacheryconverse'";
  try {
    const { rows } = await db.query(sql);

    if (rows.length === 0) {
      console.log("No users found in the database.");
      return cb(null, []);
    }

    const results = rows.map((user) => {
      const result = { ...user, existsIn: [] };
      return result;
    });

    cb(null, results);
  } catch (err) {
    console.error("Error fetching users from PostgreSQL:", err);
    cb(err);
  }
};

const columns = [
  { name: "username", type: "TEXT" },
  { name: "name", type: "TEXT" },
  { name: "email", type: "TEXT" },
  { name: "bio", type: "TEXT" },
  { name: "location", type: "TEXT" },
  { name: "image", type: "TEXT" },
  { name: "coverPhoto", type: "TEXT" },
  { name: "yearStartedFlying", type: "INTEGER" },
  { name: "favoriteSites", type: "TEXT" },
  { name: "certifications", type: "TEXT" },
];

async function columnExists(columnName) {
  const sql = `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name=$1`;
  try {
    const { rows } = await db.query(sql, [columnName]);
    return rows.length > 0;
  } catch (err) {
    console.error(`Error checking if column ${columnName} exists:`, err);
    return false;
  }
}

async function addColumn(columnName, columnType) {
  const sql = `ALTER TABLE users ADD COLUMN ${columnName} ${columnType}`;
  try {
    await db.query(sql);
    console.log(`Added column ${columnName}`);
  } catch (err) {
    console.error(`Error adding column ${columnName}:`, err);
  }
}

async function ensureColumnsExist(columns) {
  for (const { name, type } of columns) {
    const exists = await columnExists(name);
    if (!exists) {
      await addColumn(name, type);
    } else {
      console.log(`Column ${name} already exists`);
    }
  }
}

// ensureColumnsExist(columns).then(() => {
//   console.log("Finished ensuring all columns exist");
// });

getAllUsers((err, users) => {
  if (err) {
    console.error("Error fetching users:", err);
  } else {
    console.log("Fetched users:", users);
  }
});

// const userIdToUpdate = "zack102852313246785808615";
// const newUsername = "zack-attack";
// updateUserUsername(userIdToUpdate, newUsername, (err, result) => {
//   if (err) {
//     console.error("Error updating username:", err);
//     return;
//   }
//   console.log(result);
// });

module.exports = { getAllUsers, updateUserUsername };
