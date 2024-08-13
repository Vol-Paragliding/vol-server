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

const deleteUserScript = async () => {
  try {
    console.log("Environment:", process.env.NODE_ENV);
    console.log("API Key:", api_key);
    console.log("API Secret:", api_secret);
    console.log("App ID:", app_id);

    const feedClient = connect(api_key, api_secret, app_id);
    const chatClient = StreamChat.getInstance(api_key, api_secret);

    console.log("Before querying users to delete.");

    // Fetch users to delete from the database
    const result = await db.query("SELECT id FROM users WHERE id != $1", [
      excludedUserId,
    ]);
    const usersToDelete = result.rows.map((row) => row.id);

    console.log("User IDs to delete:", usersToDelete);

    let feedDeletions = 0;
    let chatDeletions = 0;

    for (const userId of usersToDelete) {
      try {
        // Delete from Feed
        await feedClient.user(userId).delete();
        console.log(`Deleted user ${userId} from Feed`);
        feedDeletions++;

        // Delete from Chat
        await chatClient.deleteUser(userId, { mark_messages_deleted: true });
        console.log(`Deleted user ${userId} from Chat`);
        chatDeletions++;

        // Delete from PostgreSQL
        await db.query("DELETE FROM users WHERE id = $1", [userId]);
        console.log(`Deleted user ${userId} from PostgreSQL`);

        // Pause if rate limit thresholds are reached
        if (feedDeletions >= 6 || chatDeletions >= 6) {
          console.log("Pausing for rate limits...");
          await new Promise((resolve) => setTimeout(resolve, 60100)); // 60.1 seconds
          feedDeletions = 0;
          chatDeletions = 0;
        }
      } catch (error) {
        console.error(`Error deleting user ${userId}: ${error.message}`);
      }
    }

    // Check remaining users in the database
    const remainingResult = await db.query("SELECT id FROM users");
    const remainingUsers = remainingResult.rows.map((row) => row.id);
    console.log("Remaining user IDs:", remainingUsers);
  } catch (error) {
    console.error("Error executing delete user script:", error);
  }
};

deleteUserScript();
