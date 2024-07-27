const { connect } = require("getstream");
const StreamChat = require("stream-chat").StreamChat;
require("dotenv").config();
const db = require("../db");

const isProduction = process.env.NODE_ENV === "production";

const api_key = isProduction
  ? process.env.PROD_STREAM_API_KEY
  : process.env.STREAM_API_KEY;
const api_secret = isProduction
  ? process.env.PROD_STREAM_API_SECRET
  : process.env.STREAM_API_SECRET;
const app_id = isProduction
  ? process.env.PROD_STREAM_APP_ID
  : process.env.STREAM_APP_ID;

const excludedUserId = "zacheryconverse";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const deleteUserScript = async () => {
  try {
    const feedClient = connect(api_key, api_secret, app_id);
    const chatClient = StreamChat.getInstance(api_key, api_secret);

    const usersToDelete = await new Promise((resolve, reject) => {
      db.all(
        "SELECT id FROM users WHERE id != ?",
        [excludedUserId],
        (err, rows) => {
          if (err) {
            return reject(err);
          }
          resolve(rows.map((row) => row.id));
        }
      );
    });

    console.log("User IDs to delete:", usersToDelete);

    let feedDeletions = 0;
    let chatDeletions = 0;
    const deletePromises = [];

    for (const userId of usersToDelete) {
      deletePromises.push(
        (async () => {
          try {
            await feedClient.user(userId).delete();
            console.log(`Deleted user ${userId} from Feed`);
            feedDeletions++;
          } catch (error) {
            console.error(
              `Failed to delete user ${userId} from Feed: ${error.message}`
            );
          }

          try {
            await chatClient.deleteUser(userId, {
              mark_messages_deleted: true,
            });
            console.log(`Deleted user ${userId} from Chat`);
            chatDeletions++;
          } catch (error) {
            console.error(
              `Failed to delete user ${userId} from Chat: ${error.message}`
            );
          }

          db.run("DELETE FROM users WHERE id = ?", [userId], (err) => {
            if (err) {
              console.error(
                `Failed to delete user ${userId} from SQLite: ${err.message}`
              );
            } else {
              console.log(`Deleted user ${userId} from SQLite`);
            }
          });

          if (feedDeletions >= 6 || chatDeletions >= 6) {
            await delay(60100); // 60.1 seconds
            feedDeletions = 0;
            chatDeletions = 0;
          }
        })()
      );

      // Ensure we wait after every batch of 6 deletions
      if (deletePromises.length >= 6) {
        await Promise.all(deletePromises);
        deletePromises.length = 0;
      }
    }

    // Wait for any remaining deletions
    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
    }

    const remainingUsers = await new Promise((resolve, reject) => {
      db.all("SELECT id FROM users", (err, rows) => {
        if (err) {
          return reject(err);
        }
        resolve(rows.map((row) => row.id));
      });
    });

    console.log("Remaining user IDs:", remainingUsers);
  } catch (error) {
    console.error("Error executing delete user script:", error);
  }
};

deleteUserScript();
