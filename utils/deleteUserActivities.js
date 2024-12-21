require("dotenv").config();
const { connect } = require("getstream");
const pLimit = require("p-limit");

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

const streamClient = connect(api_key, api_secret, app_id, {
  location: "us-east",
});

const deleteUserReactions = async (client, userId) => {
  let hasMoreReactions = true;
  let lastReactionId = null;
  const reactionsLimit = 25;
  const concurrencyLimit = 10;

  const limit = pLimit(concurrencyLimit);

  while (hasMoreReactions) {
    const filterParams = {
      user_id: userId,
      limit: reactionsLimit,
    };

    if (lastReactionId) {
      filterParams.id_lt = lastReactionId;
    }

    try {
      const reactionResponse = await client.reactions.filter(filterParams);

      const reactions = reactionResponse.results;
      console.log(
        `[DELETE USER ACTIVITIES] Retrieved ${reactions.length} reactions for userId: ${userId}`
      );

      if (reactions.length === 0) {
        console.log(
          `[DELETE USER ACTIVITIES] No more reactions to delete for userId: ${userId}`
        );
        hasMoreReactions = false;
        break;
      }

      const deletePromises = reactions.map((reaction) =>
        limit(async () => {
          try {
            await client.reactions.delete(reaction.id);
            console.log(
              `[DELETE USER ACTIVITIES] Successfully deleted reactionId: ${reaction.id}`
            );
          } catch (error) {
            console.error(
              `[DELETE USER ACTIVITIES] Failed to delete reactionId: ${reaction.id}. Error: ${error.message}`
            );
          }
        })
      );

      await Promise.all(deletePromises);

      lastReactionId = reactions[reactions.length - 1].id;
      console.log(
        `[DELETE USER ACTIVITIES] Setting lastReactionId to: ${lastReactionId}`
      );
    } catch (error) {
      console.error(
        `[DELETE USER ACTIVITIES] Error fetching reactions for userId: ${userId}. Error: ${error.message}`
      );
      throw error;
    }
  }
};

const deleteUserOwnActivities = async (userFeed, userId) => {
  let hasMoreActivities = true;
  let offset = 0;
  const activitiesLimit = 100;

  while (hasMoreActivities) {
    try {
      const activityResponse = await userFeed.get({
        limit: activitiesLimit,
        offset,
      });

      const activities = activityResponse.results;

      console.log(
        `[DELETE USER ACTIVITIES] Retrieved ${activities.length} activities for userId: ${userId}`
      );

      if (activities.length === 0) {
        console.log(
          `[DELETE USER ACTIVITIES] No more activities to delete for userId: ${userId}`
        );
        hasMoreActivities = false;
        break;
      }

      for (const activity of activities) {
        try {
          await userFeed.removeActivity(activity.id);
          console.log(
            `[DELETE USER ACTIVITIES] Successfully deleted activityId: ${activity.id}`
          );
        } catch (deleteActivityError) {
          console.error(
            `[DELETE USER ACTIVITIES] Failed to delete activityId: ${activity.id}. Error: ${deleteActivityError.message}`
          );
        }
      }

      offset += activitiesLimit;
      console.log(`[DELETE USER ACTIVITIES] Incremented offset to: ${offset}`);
    } catch (error) {
      console.error(
        `[DELETE USER ACTIVITIES] Error fetching activities for userId: ${userId}. Error: ${error.message}`
      );
      throw error;
    }
  }
};

const deleteUserActivities = async (userId) => {
  try {
    await deleteUserReactions(streamClient, userId);

    const userFeed = streamClient.feed("user", userId);
    await deleteUserOwnActivities(userFeed, userId);

    console.log(
      `[DELETE USER ACTIVITIES] Successfully deleted all reactions and activities for userId: ${userId}`
    );
  } catch (error) {
    console.error(
      `[DELETE USER ACTIVITIES] Critical error during deletion process for userId: ${userId}. Error: ${error.message}`
    );
    throw error;
  }
};

// deleteUserActivities("UjSoybN-3AsIY4WBYZP1h");

module.exports = deleteUserActivities;
