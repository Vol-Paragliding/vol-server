const { StreamChat } = require("stream-chat");
require("dotenv").config();

const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;
const serverClient = StreamChat.getInstance(apiKey, apiSecret);

async function updateUsers() {
  try {
    let offset = 0;
    const limit = 100;
    let usersToUpdate = [];

    while (true) {
      const response = await serverClient.queryUsers(
        {},
        { created_at: -1 },
        { limit, offset }
      );

      const users = response.users;

      if (users.length === 0) {
        break;
      }

      users.forEach((user) => {
        if (!user.image && user.profile?.image) {
          usersToUpdate.push({
            id: user.id,
            image: user.profile.image,
          });
        }
      });

      offset += limit;
    }

    console.log(`Found ${usersToUpdate.length} users to update.`);
    console.log('usersToUpdate:', usersToUpdate);

    const batchSize = 100;
    for (let i = 0; i < usersToUpdate.length; i += batchSize) {
      const batch = usersToUpdate.slice(i, i + batchSize);
      console.log(`Updating users ${i + 1} to ${i + batch.length}`);
      // TODO: test this script
      // await serverClient.upsertUsers(batch);
      console.log(`Updated users ${i + 1} to ${i + batch.length}`);
    }

    console.log("User images updated successfully.");
  } catch (error) {
    console.error("Error updating users:", error);
  }
}

updateUsers();
