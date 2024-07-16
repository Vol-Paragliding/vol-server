const StreamChat = require("stream-chat").StreamChat;
require("dotenv").config();

const api_key = process.env.STREAM_API_KEY;
const api_secret = process.env.STREAM_API_SECRET;
const app_id = process.env.STREAM_APP_ID;

const createAdminUser = async (userId, username) => {
  const chatClient = StreamChat.getInstance(api_key, api_secret);

  try {
    await chatClient.upsertUser({
      id: userId,
      role: "admin",
      username: username,
    });
    console.log(`Admin user ${username} created successfully.`);
  } catch (error) {
    console.error(`Error creating admin user ${username}:`, error);
  }
};
// in case this user is accidentally deleted
createAdminUser("zachery", "zachery");
