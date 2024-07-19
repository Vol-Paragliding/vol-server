const { connect } = require("getstream");
const StreamChat = require("stream-chat").StreamChat;
require("dotenv").config();
const db = require("../db");

const api_key = process.env.STREAM_API_KEY;
const api_secret = process.env.STREAM_API_SECRET;
const app_id = process.env.STREAM_APP_ID;

const getAllUsers = (cb) => {
  const sql = "SELECT id FROM users WHERE id != 'zacheryconverse'";
  db.all(sql, [], async (err, rows) => {
    if (err) {
      return cb(err);
    }

    const users = rows.map((row) => row.id);
    const feedClient = connect(api_key, api_secret, app_id, {
      location: "us-east",
    });
    const chatClient = StreamChat.getInstance(api_key, api_secret);

    const results = await Promise.all(
      users.map(async (userId) => {
        const result = { userId, existsIn: [] };

        // Check if the user exists in the feed database
        try {
          const feedUser = await feedClient.user(userId).get();
          if (feedUser) {
            result.existsIn.push("feed");
          }
        } catch (error) {
          // User not found in feed database
        }

        // Check if the user exists in the chat database
        try {
          const { users: chatUsers } = await chatClient.queryUsers({
            id: { $eq: userId },
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

// Example usage:
getAllUsers((err, users) => {
  if (err) {
    console.error("Error fetching users from the database:", err);
    return;
  }
  console.log("Users and their existence in databases:", users);
});

module.exports = getAllUsers;
