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
  } catch (error) {
    console.error("Error during deletion", error);
    throw error;
  }
};

// deleteUserActivities("UjSoybN-3AsIY4WBYZP1h");

module.exports = deleteUserActivities;
