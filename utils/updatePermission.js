const { StreamChat } = require("stream-chat");
require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";

const apiKey = isProduction
  ? process.env.PROD_STREAM_API_KEY
  : process.env.STREAM_API_KEY;

const apiSecret = isProduction
  ? process.env.PROD_STREAM_API_SECRET
  : process.env.STREAM_API_SECRET;

const serverClient = StreamChat.getInstance(apiKey, apiSecret);

(async () => {
  try {
    // Fetch the current grants for the "messaging" channel type
    const channelType = await serverClient.getChannelType("messaging");
    console.log("Current Grants:", channelType.grants);

    // Update the grants for the "channel_member" role to include "create-attachment"
    const updatedGrants = {
      ...channelType.grants,
      channel_member: [
        ...(channelType.grants.channel_member || []), // Keep existing permissions
        "create-attachment", // Add the create-attachment permission
      ],
    };

    await serverClient.updateChannelType("messaging", {
      grants: updatedGrants,
    });

    console.log("Updated Grants for messaging channel type:", updatedGrants);
  } catch (error) {
    console.error("Error updating grants:", error);
  }
})();
