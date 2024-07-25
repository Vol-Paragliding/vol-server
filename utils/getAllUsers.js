const { connect } = require("getstream");
const StreamChat = require("stream-chat").StreamChat;
require("dotenv").config();
const db = require("../db");

const api_key = process.env.STREAM_API_KEY;
const api_secret = process.env.STREAM_API_SECRET;
const app_id = process.env.STREAM_APP_ID;

// const feedClient = connect(api_key, api_secret, app_id, {
//   location: "us-east",
// });
// const chatClient = StreamChat.getInstance(api_key, api_secret);

const updateUserUsername = async (id, newUsername, cb) => {
  // Update SQLite database
  const sql = "UPDATE users SET username = ? WHERE id = ?";
  db.run(sql, [newUsername, id], async function (err) {
    if (err) {
      return cb(err);
    }

    // Update user in Feed
    // try {
    //   await feedClient.user(id).update({ id, username: newUsername });
    // } catch (error) {
    //   console.error("Error updating user in feed database:", error);
    //   return cb(error);
    // }

    // // Update user in Chat
    // try {
    //   await chatClient.upsertUser({ id, username: newUsername });
    // } catch (error) {
    //   console.error("Error updating user in chat database:", error);
    //   return cb(error);
    // }

    cb(null, { message: "Username updated successfully" });
  });
};

const getAllUsers = (cb) => {
  const sql = "SELECT * FROM users WHERE id != 'zacheryconverse'";
  db.all(sql, [], async (err, rows) => {
    if (err) {
      return cb(err);
    }

    const results = await Promise.all(
      rows.map(async (user) => {
        const result = { ...user, existsIn: [] };

        // Check if the user exists in the feed database
        try {
          const feedUser = await feedClient.user(user.id).get();
          if (feedUser) {
            result.existsIn.push("feed");
          }
        } catch (error) {
          // User not found in feed database
        }

        // Check if the user exists in the chat database
        try {
          const { users: chatUsers } = await chatClient.queryUsers({
            id: { $eq: user.id },
          });
          if (chatUsers.length > 0) {
            result.existsIn.push("chat");
          }
        } catch (error) {
          // User not found in chat database
        }

        return result;
      })
    );

    cb(null, results);
  });
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

function columnExists(columnName, callback) {
  db.all(`PRAGMA table_info(users)`, (err, tableInfo) => {
    if (err) {
      console.error(err);
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
  db.run(`ALTER TABLE users ADD COLUMN ${columnName} ${columnType}`, callback);
}

function ensureColumnsExist(columns, callback) {
  let completed = 0;

  columns.forEach(({ name, type }) => {
    columnExists(name, (exists) => {
      if (!exists) {
        addColumn(name, type, (err) => {
          if (err) {
            console.error(`Error adding column ${name}:`, err);
          } else {
            console.log(`Added column ${name}`);
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

// ensureColumnsExist(columns, () => {
//   console.log("Finished ensuring all columns exist");
//   db.close();
// });

getAllUsers((err, users) => {
  if (err) {
    console.error("Error fetching users from the database:", err);
    return;
  }
  console.log("Users and their existence in databases:", users);
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
