const { connect } = require("getstream");
const StreamChat = require("stream-chat").StreamChat;

require("dotenv").config();

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

/**
 * Generates Stream tokens (feedToken and chatToken) for a user.
 * @param {string} userId - The ID of the user.
 * @returns {Object} An object containing feedToken and chatToken.
 */
const generateStreamTokens = (userId) => {
  const feedClient = connect(api_key, api_secret, app_id, {
    location: "us-east",
  });
  const chatClient = StreamChat.getInstance(api_key, api_secret);

  const feedToken = feedClient.createUserToken(userId);
  const chatToken = chatClient.createToken(userId);

  return { feedToken, chatToken };
};

module.exports = { generateStreamTokens };
