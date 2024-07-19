const { connect } = require("getstream");
const StreamChat = require("stream-chat").StreamChat;
const bcrypt = require("bcrypt");

const db = require("../db");
require("dotenv").config();

const api_key = process.env.STREAM_API_KEY;
const api_secret = process.env.STREAM_API_SECRET;
const app_id = process.env.STREAM_APP_ID;

const deleteUser = async (userId, cb) => {
  const feedClient = connect(api_key, api_secret, app_id, {
    location: "us-east",
  });

  let feedError = null;
  let chatError = null;
  let dbError = null;

  let feedSuccess = false;
  let chatSuccess = false;
  let dbSuccess = false;

  try {
    // Attempt to delete user from the feed database
    await feedClient.user(userId).delete();
    feedSuccess = true;
  } catch (error) {
    feedError = error;
  }

  try {
    // Attempt to delete user from the chat database
    const chatClient = StreamChat.getInstance(api_key, api_secret);
    await chatClient.deleteUser(userId, { mark_messages_deleted: true });
    chatSuccess = true;
  } catch (error) {
    chatError = error;
  }

  try {
    // Attempt to delete user from the local database
    const sql = "DELETE FROM users WHERE id = ?";
    db.run(sql, [userId], function (err) {
      if (err) {
        dbError = err;
      } else {
        dbSuccess = true;
      }
      generateLogMessage();
    });
  } catch (error) {
    dbError = error;
    generateLogMessage();
  }

  function generateLogMessage() {
    let logMessage = `Deletion results for userId ${userId}: \n`;

    if (feedSuccess) {
      logMessage += "- Successfully deleted from Feed database\n";
    } else {
      logMessage += `- Failed to delete from Feed database: ${feedError}\n`;
    }

    if (chatSuccess) {
      logMessage += "- Successfully deleted from Chat database\n";
    } else {
      logMessage += `- Failed to delete from Chat database: ${chatError}\n`;
    }

    if (dbSuccess) {
      logMessage += "- Successfully deleted from Local database\n";
    } else {
      logMessage += `- Failed to delete from Local database: ${dbError}\n`;
    }

    if (feedError || chatError || dbError) {
      cb(
        {
          feedError,
          chatError,
          dbError,
        },
        logMessage
      );
    } else {
      cb(null, logMessage);
    }
  }
};

// Example usage:
const userToDelete = "zach";

deleteUser(userToDelete, (err, result) => {
  if (err) {
    console.error("Errors encountered while deleting user:", err);
  } else {
    console.log(result);
  }
});
