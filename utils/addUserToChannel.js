const { StreamChat } = require("stream-chat");
require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";

const apiKey = isProduction
  ? process.env.PROD_STREAM_API_KEY
  : process.env.STREAM_API_KEY;

const apiSecret = isProduction
  ? process.env.PROD_STREAM_API_SECRET
  : process.env.STREAM_API_SECRET;

const serverClient = StreamChat.getInstance(apiKey, apiSecret, {
  allowServerSideConnect: true,
});

async function addUserToChannel(userId) {
  try {
    // Get or create the channel
    const channel = serverClient.channel("messaging", "one", {
      created_by_id: "zacheryconverse", // Replace with your admin or bot ID
    });
    await channel.create();

    // Add user to the channel
    await channel.addMembers([userId]);

    console.log(`User ${userId} successfully added to channel.`);
  } catch (error) {
    console.error(`Error adding user ${userId}:`, error.message);
  }
}

// Example usage
addUserToChannel("5sm1JlYKMnkkGWZMx-Izu");
