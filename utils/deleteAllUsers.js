const { connect } = require("getstream");
const StreamChat = require("stream-chat").StreamChat;
require("dotenv").config();
const db = require("../db");

const api_key = process.env.STREAM_API_KEY;
const api_secret = process.env.STREAM_API_SECRET;
const app_id = process.env.STREAM_APP_ID;

// Function to get all users except zacheryconverse
const getAllUsers = (cb) => {
  const sql = "SELECT id FROM users WHERE id != 'zacheryconverse'";
  db.all(sql, [], (err, rows) => {
    if (err) {
      return cb(err);
    }
    cb(
      null,
      rows.map((row) => row.id)
    );
  });
};

// Function to delete a user from the database
const deleteUserFromDb = (userId, cb) => {
  const sql = "DELETE FROM users WHERE id = ?";
  db.run(sql, [userId], function (err) {
    cb(err);
  });
};

// Sleep function to handle rate limits
const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Function to delete all users except zacheryconverse and handle rate limits
const deleteAllUsers = async () => {
  try {
    getAllUsers(async (err, userIds) => {
      if (err) {
        console.error("Error fetching users from the database:", err);
        return;
      }

      const feedClient = connect(api_key, api_secret, app_id, {
        location: "us-east",
      });
      const chatClient = StreamChat.getInstance(api_key, api_secret);

      for (const userId of userIds) {
        try {
          await chatClient.deleteUsers([userId], {
            user: "hard",
            messages: "hard",
            conversations: "hard",
          });

          deleteUserFromDb(userId, (dbErr) => {
            if (dbErr) {
              console.error(
                `Error deleting user ${userId} from the database:`,
                dbErr
              );
            } else {
              console.log(`User ${userId} deleted successfully.`);
            }
          });
        } catch (error) {
          console.error(
            `Error deleting user ${userId} from Stream Chat:`,
            error
          );
        }
        // Sleep for 11 seconds to stay within rate limits (6 requests per minute)
        await sleep(11000);
      }

      console.log("All users except zacheryconverse have been processed.");
    });
  } catch (error) {
    console.error("Error deleting all users:", error);
  }
};

// deleteAllUsers();
// GET all users
getAllUsers((err, userIds) => {
  if (err) {
    console.error("Error fetching users from the database:", err);
    return;
  }

  console.log("All users except zacheryconverse:", userIds);
});

module.exports = { deleteAllUsers };


// const db = require("./db");

// db.serialize(() => {
//   db.run("DELETE FROM users", (err) => {
//     if (err) {
//       console.error("Error deleting users:", err.message);
//     } else {
//       console.log("All users deleted successfully.");
//     }
//   });
// });

// db.close();
