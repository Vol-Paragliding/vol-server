const { connect } = require("getstream");
const StreamChat = require("stream-chat").StreamChat;
const bcrypt = require("bcrypt");
const db = require("../db");
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

// Log environment variables
console.log("Environment:", process.env.NODE_ENV);
console.log("API Key:", api_key);
console.log("API Secret:", api_secret);
console.log("App ID:", app_id);

const verifyUser = async (identifier, password, cb) => {
  console.log(`Verifying user: ${identifier}`);
  try {
    const sql = "SELECT * FROM users WHERE username = $1 OR email = $1";
    const result = await db.query(sql, [identifier]);

    if (result.rows.length === 0) {
      console.log("User not found in database");
      return cb("User with this username or email doesn't exist.");
    }

    const user = result.rows[0];
    console.log(`User found: ${user.id}`);

    if (!user.salt || !user.hashed_password) {
      console.log("User account created with Google OAuth");
      return cb(
        "This account was created using Google OAuth. Please log in using Google."
      );
    }

    const hashed_password = bcrypt.hashSync(password, user.salt);
    if (hashed_password === user.hashed_password) {
      console.log("Password match successful");
      cb(null, user);
    } else {
      console.log("Password match failed");
      return cb("Incorrect Password.");
    }
  } catch (err) {
    console.error("Error in verifyUser:", err);
    return cb(
      "An error occurred while processing your login. Please try again later."
    );
  }
};

const registerUser = async (
  id,
  userId,
  username,
  password,
  email,
  name,
  profile,
  cb
) => {
  console.log(`Registering new user: ${username}`);
  try {
    const salt = bcrypt.genSaltSync(10);
    const hashed_password = bcrypt.hashSync(password, salt);

    const sql =
      "INSERT INTO users (id, userId, username, hashed_password, salt, email, name, profile) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)";
    const params = [
      id,
      userId,
      username,
      hashed_password,
      salt,
      email,
      name,
      profile,
    ];

    await db.query(sql, params);
    console.log(`User ${username} inserted into PostgreSQL`);
    cb(null, {
      id,
      userId,
      username,
      hashed_password,
      salt,
      email,
      name,
      profile,
    });
  } catch (err) {
    console.error("Error in registerUser:", err);
    cb(err, null);
  }
};

const searchUsers = async (searchTerm, selfUserId, cb) => {
  console.log(`Searching for users with term: ${searchTerm}`);
  try {
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    const sql =
      "SELECT id, username FROM users WHERE LOWER(username) LIKE $1 AND id != $2";
    const params = [`%${lowercasedSearchTerm}%`, selfUserId];

    const result = await db.query(sql, params);
    console.log(`Search results: ${result.rows.length} users found`);
    cb(null, result.rows);
  } catch (err) {
    console.error("Error in searchUsers:", err);
    cb(err, []);
  }
};

const signupHandler = async (error, result, res) => {
  if (error) {
    console.error("Error in signupHandler:", error);
    res.status(500).json({ message: error });
    return;
  }

  const { username, userId, id, name, email = "", profile } = result;

  console.log(`Handling signup for userId: ${userId}, username: ${username}`);

  const feedClient = connect(api_key, api_secret, app_id, {
    location: "us-east",
  });

  try {
    const chatClient = StreamChat.getInstance(api_key, api_secret);
    await chatClient.upsertUser({
      id,
      userId,
      name: name || username,
      username,
      email,
      profile,
    });

    console.log(`User ${id} created in Chat`);

    const user = await feedClient.user(id).create({
      id,
      userId,
      name: name || username,
      username,
      email,
      profile,
    });

    console.log(`User ${id} created in Feed`);

    const userFeed = feedClient.feed("user", id);
    await userFeed.addActivity({
      actor: user,
      verb: "signup",
      object: `${username} has signed up! 🎉🎉🎉`,
      text: `${username} has signed up! 🎉🎉🎉`,
    });

    const feedToken = feedClient.createUserToken(id);
    const chatToken = chatClient.createToken(id);

    console.log(`Generated feedToken: ${feedToken}`);
    console.log(`Generated chatToken: ${chatToken}`);

    res.status(200).json({
      feedToken,
      chatToken,
      user: {
        id,
        userId,
        name: name || username,
        username,
        email,
        profile,
      },
    });
  } catch (error) {
    console.error("Error in signupHandler:", error.message);
    if (error.code === 16) {
      res.status(409).json({ message: "Username unavailable" });
    } else {
      res.status(500).json({ message: `Error creating user` });
    }
  }
};

const loginHandler = async (error, result, res) => {
  if (error) {
    console.error("Error in loginHandler:", error);
    res.status(400).json({ message: error });
    return;
  }

  const { username, email, id, userId, name, profile } = result;

  console.log(`Handling login for userId: ${userId}, username: ${username}`);

  const feedClient = connect(api_key, api_secret, app_id, {
    location: "us-east",
  });

  try {
    const chatClient = StreamChat.getInstance(api_key, api_secret);
    const { users } = await chatClient.queryUsers({
      id: { $eq: id },
    });
    if (!users.length) {
      console.log("User not found in Chat");
      return res.status(400).json({ message: "User not found" });
    }

    const chatToken = chatClient.createToken(id);
    const feedToken = feedClient.createUserToken(id);

    console.log(`Generated feedToken: ${feedToken}`);
    console.log(`Generated chatToken: ${chatToken}`);

    res.status(200).json({
      feedToken,
      chatToken,
      user: {
        username,
        email,
        userId,
        id,
        name,
        profile,
      },
    });
  } catch (error) {
    console.error("Error in loginHandler:", error);
    res
      .status(500)
      .json({
        message: "An unexpected error occurred. Please try again later",
      });
  }
};

const updateProfile = async (userId, updates) => {
  try {
    const userResult = await db.query(
      "SELECT profile FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error("User not found");
    }

    const user = userResult.rows[0];
    const profile = user.profile || {};

    const updatedProfile = {
      ...profile,
      ...updates.profile,
    };

    await db.query(
      "UPDATE users SET profile = $1, username = $2, email = $3, name = $4 WHERE id = $5",
      [updatedProfile, updates.username, updates.email, updates.name, userId]
    );

    const feedClient = connect(api_key, api_secret, app_id, {
      location: "us-east",
    });
    const currentUserData = await feedClient.user(userId).get();

    const updatedFeedProfile = {
      ...currentUserData.data.profile,
      ...updates.profile,
    };

    await feedClient.user(userId).update({
      ...currentUserData.data,
      username: updates.username,
      email: updates.email,
      name: updates.name,
      profile: updatedFeedProfile,
    });

    const chatClient = StreamChat.getInstance(api_key, api_secret);
    const { users } = await chatClient.queryUsers({
      id: { $eq: userId },
    });

    if (!users.length) {
      throw new Error("User not found in chat database");
    }

    const chatUser = users[0];

    const updatedChatUserProfile = {
      ...chatUser.profile,
      ...updates.profile,
    };

    await chatClient.upsertUser({
      ...chatUser,
      username: updates.username,
      email: updates.email,
      name: updates.name,
      profile: updatedChatUserProfile,
    });

    return { message: "Profile updated successfully" };
  } catch (error) {
    console.error("Error updating profile:", error);
    throw error;
  }
};

const updateUserProfileImage = async (userId, imageUrl) => {
  try {
    // Fetch the current profile JSON string from the PostgreSQL database
    const userResult = await db.query(
      "SELECT profile FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error("User not found");
    }

    const user = userResult.rows[0];
    const profile = user.profile || {};

    // Update the image URL in the profile object
    profile.image = imageUrl;

    // Update the profile JSON string in the PostgreSQL database
    await db.query("UPDATE users SET profile = $1 WHERE id = $2", [
      profile,
      userId,
    ]);

    // Update the feed database
    const feedClient = connect(api_key, api_secret, app_id, {
      location: "us-east",
    });
    const currentUserData = await feedClient.user(userId).get();

    const updatedProfile = {
      ...currentUserData.data.profile,
      image: imageUrl,
    };

    await feedClient.user(userId).update({
      ...currentUserData.data,
      profile: updatedProfile,
    });

    // Update the chat database
    const chatClient = StreamChat.getInstance(api_key, api_secret);

    const { users } = await chatClient.queryUsers({
      id: { $eq: userId },
    });

    if (!users.length) {
      throw new Error("User not found in chat database");
    }

    const chatUser = users[0];

    const updatedChatUserProfile = {
      ...chatUser.profile,
      image: imageUrl,
    };

    await chatClient.upsertUser({
      ...chatUser,
      profile: updatedChatUserProfile,
    });

    return { message: "Profile image updated successfully" };
  } catch (error) {
    console.error("Error updating profile image:", error);
    throw error;
  }
};

const searchUsersHandler = async (err, result, res) => {
  if (err) {
    res.status(500).json({ message: err });
    return;
  }
  res.status(200).json({ results: result });
};

const deleteUser = async (req, res) => {
  const userId = req.params.userId;
  const feedClient = connect(api_key, api_secret, app_id, {
    location: "us-east",
  });

  let feedError = null;
  let chatError = null;
  let dbError = null;

  let feedSuccess = false;
  let chatSuccess = false;
  let dbSuccess = false;

  try {
    // Delete user from the feed database
    await feedClient.user(userId).delete();
    feedSuccess = true;
  } catch (error) {
    feedError = error;
  }

  try {
    // Delete user from the chat database
    const chatClient = StreamChat.getInstance(api_key, api_secret);
    await chatClient.deleteUser(userId, { mark_messages_deleted: true });
    chatSuccess = true;
  } catch (error) {
    chatError = error;
  }

  try {
    // Delete user from the PostgreSQL database
    const sql = "DELETE FROM users WHERE id = $1";
    await db.query(sql, [userId]);
    dbSuccess = true;
    generateLogMessage();
  } catch (error) {
    dbError = error;
    generateLogMessage();
  }

  function generateLogMessage() {
    let logMessage = `Deletion results for userId ${userId}: \n`;

    if (feedSuccess) {
      logMessage += "- Successfully deleted from Feed database\n";
    } else {
      logMessage += `- Failed to delete from Feed database: ${feedError}\n`;
    }

    if (chatSuccess) {
      logMessage += "- Successfully deleted from Chat database\n";
    } else {
      logMessage += `- Failed to delete from Chat database: ${chatError}\n`;
    }

    if (dbSuccess) {
      logMessage += "- Successfully deleted from Local database\n";
    } else {
      logMessage += `- Failed to delete from Local database: ${dbError}\n`;
    }

    if (feedError || chatError || dbError) {
      res.status(500).json({
        feedError,
        chatError,
        dbError,
        logMessage,
      });
    } else {
      res
        .status(200)
        .json({ message: "User deleted successfully", logMessage });
    }
  }
};

module.exports = {
  verifyUser,
  loginHandler,
  registerUser,
  signupHandler,
  searchUsersHandler,
  updateProfile,
  updateUserProfileImage,
  searchUsers,
  deleteUser,
};
