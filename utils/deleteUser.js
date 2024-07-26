const { connect } = require("getstream");
const StreamChat = require("stream-chat").StreamChat;
const db = require("../db");
require("dotenv").config();

const api_key = process.env.STREAM_API_KEY;
const api_secret = process.env.STREAM_API_SECRET;
const app_id = process.env.STREAM_APP_ID;

const deleteUsers = async (userIds, cb) => {
  // const feedClient = connect(api_key, api_secret, app_id, {
  //   location: "us-east",
  // });

  // const chatClient = StreamChat.getInstance(api_key, api_secret);

  // let feedError = null;
  // let chatError = null;
  // let dbError = null;

  // let feedSuccess = false;
  // let chatSuccess = false;
  // let dbSuccess = false;

  // try {
  //   // Attempt to delete users from the chat database
  //   await chatClient.deleteUsers(userIds, {
  //     hard_delete: true,
  //     mark_messages_deleted: true,
  //     delete_conversation_channels: true,
  //   });
  //   chatSuccess = true;
  // } catch (error) {
  //   chatError = error;
  // }

  // try {
  //   // Attempt to delete users from the feed database
  //   for (const userId of userIds) {
  //     await feedClient.user(userId).delete();
  //   }
  //   feedSuccess = true;
  // } catch (error) {
  //   feedError = error;
  // }

  try {
    // Attempt to delete users from the local database
    const placeholders = userIds.map(() => "?").join(",");
    const sql = `DELETE FROM users WHERE id IN (${placeholders})`;
    db.run(sql, userIds, function (err) {
      if (err) {
        dbError = err;
      } else {
        dbSuccess = true;
      }
      // generateLogMessage();
    });
  } catch (error) {
    dbError = error;
    // generateLogMessage();
  }

  function generateLogMessage() {
    let logMessage = `Deletion results for userIds ${userIds.join(", ")}: \n`;

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

// const restoreUser = async (userId) => {
//   const chatClient = StreamChat.getInstance(api_key, api_secret);

//   try {
//     const response = await chatClient.restoreUsers([userId]);
//     console.log(`User ${userId} successfully restored:`, response);
//   } catch (error) {
//     console.error(`Error restoring user ${userId}:`, error.message);
//   }
// };

// const userId = "102852313246785808615";

// restoreUser(userId);

const usersToDelete = ["5ba1e24a-0ef1-408e-8851-808c6af0fda5"];
deleteUsers(usersToDelete, (err, result) => {
  if (err) {
    console.error("Errors encountered while deleting users:", err);
  } else {
    console.log(result);
  }
});
