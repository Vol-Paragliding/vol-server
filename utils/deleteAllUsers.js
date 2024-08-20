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

    // Fetch all users from PostgreSQL database
    const result = await db.query("SELECT id FROM users WHERE id != $1", [
      excludedUserId,
    ]);
    const postgresUsers = result.rows.map((row) => row.id);

    console.log("PostgreSQL User IDs:", postgresUsers);

    // Fetch all users from Chat
    const chatUsers = await chatClient.queryUsers({});
    const chatUserIds = chatUsers.users.map((user) => user.id);

    console.log("Chat User IDs:", chatUserIds);

    let feedDeletions = 0;
    let chatDeletions = 0;

    // Combine users from all sources and create a unique set
    const usersToDelete = new Set([...postgresUsers, ...chatUserIds]);

    for (const userId of usersToDelete) {
      if (userId === excludedUserId) {
        console.log(`Skipping deletion of excluded user ${userId}`);
        continue;
      }

      try {
        // Check if the user exists in Feed before deletion
        const feedUserExists = await feedClient
          .user(userId)
          .get()
          .then(() => true)
          .catch(() => false);

        // Check if the user exists in Chat before deletion
        const chatUserExists = await chatClient
          .queryUsers({ id: { $eq: userId } })
          .then((res) => res.users.length > 0);

        // Delete from Feed if exists
        if (feedUserExists) {
          await feedClient.user(userId).delete();
          console.log(`Deleted user ${userId} from Feed`);
          feedDeletions++;
        } else {
          console.log(`User ${userId} does not exist in Feed`);
        }

        // Delete from Chat if exists
        if (chatUserExists) {
          await chatClient.deleteUser(userId, { mark_messages_deleted: true });
          console.log(`Deleted user ${userId} from Chat`);
          chatDeletions++;
        } else {
          console.log(`User ${userId} does not exist in Chat`);
        }

        // Delete from PostgreSQL regardless if exists
        if (postgresUsers.includes(userId)) {
          await db.query("DELETE FROM users WHERE id = $1", [userId]);
          console.log(`Deleted user ${userId} from PostgreSQL`);
        } else {
          console.log(`User ${userId} does not exist in PostgreSQL`);
        }

        // Pause if rate limit thresholds are reached
        if (feedDeletions >= 6 || chatDeletions >= 6) {
          console.log("Pausing for rate limits...");
          await new Promise((resolve) => setTimeout(resolve, 60100)); // 60.1 seconds
          feedDeletions = 0;
          chatDeletions = 0;
        }
      } catch (error) {
        console.error(
          `Error deleting user ${userId} from PostgreSQL, Chat, or Feed: ${error.message}`
        );
      }
    }

    // Final log of remaining users in PostgreSQL
    const remainingResult = await db.query("SELECT id FROM users");
    const remainingUsers = remainingResult.rows.map((row) => row.id);
    console.log("Remaining PostgreSQL user IDs:", remainingUsers);
  } catch (error) {
    console.error("Error executing delete user script:", error);
  }
};

deleteUserScript();
