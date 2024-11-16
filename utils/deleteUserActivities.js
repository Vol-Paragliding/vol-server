const { connect } = require("getstream");
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

const deleteUserActivities = async (userId) => {
  try {
    const feedClient = connect(api_key, api_secret, app_id);
    const allUsersFeed = feedClient.feed("allusers", "allusers");
    let hasMore = true;
    let offset = 0;
    const limit = 100;

    while (hasMore) {
      const response = await allUsersFeed.get({ limit, offset });
      const activities = response.results;

      if (activities.length === 0) {
        hasMore = false;
      } else {
        let activitiesDeleted = 0;

        for (const activity of activities) {
          if (activity.actor === `SU:${userId}`) {
            await allUsersFeed.removeActivity(activity.id);
            activitiesDeleted++;
          }
        }

        if (activitiesDeleted === 0) {
          offset += limit;
        }
      }
    }

    const userFeed = feedClient.feed("user", userId);
    const followers = await userFeed.followers();

    for (const follower of followers.results) {
      const [feedGroup, followerUserId] = follower.feed_id.split(":");
      const followerFeed = feedClient.feed(feedGroup, followerUserId);

      console.log(`Processing follower feed: ${follower.feed_id}`);

      let hasMoreActivities = true;
      let followerOffset = 0;

      while (hasMoreActivities) {
        const followerResponse = await followerFeed.get({
          limit,
          offset: followerOffset,
        });
        const followerActivities = followerResponse.results;

        if (followerActivities.length === 0) {
          hasMoreActivities = false;
        } else {
          for (const activity of followerActivities) {
            if (
              activity.actor === `SU:${userId}`
            ) {
              console.log(
                `Deleting activity ${activity.id} from follower feed`
              );
              await followerFeed.removeActivity(activity.id);
            }
          }
          followerOffset += limit;
        }
      }
    }

    console.log("Successfully deleted user activities from all feeds");
  } catch (error) {
    console.error("Error during deletion", error);
    throw error;
  }
};

// deleteUserActivities("UjSoybN-3AsIY4WBYZP1h");

module.exports = deleteUserActivities;
