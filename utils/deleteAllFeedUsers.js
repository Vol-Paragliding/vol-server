const { connect } = require("getstream");
const StreamChat = require("stream-chat").StreamChat;
require("dotenv").config();
const db = require("../db");

const api_key = process.env.STREAM_API_KEY;
const api_secret = process.env.STREAM_API_SECRET;
const app_id = process.env.STREAM_APP_ID;

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

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const deleteUserFromStream = async (userId) => {
  const feedClient = connect(api_key, api_secret, app_id, {
    location: "us-east",
  });
  const chatClient = StreamChat.getInstance(api_key, api_secret);

  try {
    console.log(`Attempting to delete user ${userId} from Stream Chat...`);
    await chatClient.deleteUsers([userId], {
      user: "hard",
      messages: "hard",
      conversations: "hard",
    });
    console.log(`User ${userId} successfully deleted from Stream Chat.`);
  } catch (error) {
    if (error.response?.status !== 404) {
      console.error(`Error deleting user ${userId} from Stream Chat:`, error);
    } else {
      console.log(`User ${userId} not found in Stream Chat, skipping.`);
    }
  }

  try {
    console.log(`Attempting to delete user ${userId} from Stream Feed...`);
    await feedClient.user(userId).delete();
    console.log(`User ${userId} successfully deleted from Stream Feed.`);
  } catch (error) {
    if (error.response?.status !== 404) {
      console.error(`Error deleting user ${userId} from Stream Feed:`, error);
    } else {
      console.log(`User ${userId} not found in Stream Feed, skipping.`);
    }
  }
};

const deleteAllUsersFromStream = async () => {
  try {
    getAllUsers(async (err, userIds) => {
      if (err) {
        console.error("Error fetching users from the database:", err);
        return;
      }

      for (const userId of userIds) {
        await deleteUserFromStream(userId);
        // Sleep for 10 seconds to stay within rate limits
        await sleep(10000);
      }

      console.log(
        "All users except zacheryconverse have been processed from Stream."
      );
    });
  } catch (error) {
    console.error("Error deleting all users from Stream:", error);
  }
};

// Call the deleteAllUsersFromStream function to start the process
deleteAllUsersFromStream();

module.exports = { deleteAllUsersFromStream };
