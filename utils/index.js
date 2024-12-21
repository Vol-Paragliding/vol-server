const { connect } = require("getstream");
const StreamChat = require("stream-chat").StreamChat;
const bcrypt = require("bcrypt");
const db = require("../db");
const { uploadUserImageToGCP } = require("./imageUpload");
const deleteUserActivities = require("./deleteUserActivities");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { generateStreamTokens } = require("./generateStreamTokens");

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

const generateTokens = async (user) => {
  const accessToken = jwt.sign(
    { user_id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
    // { expiresIn: "24d" }
    // { expiresIn: "6m" }
  );
  const refreshToken = crypto.randomBytes(40).toString("hex");
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 100);
  console.log(`[AUTH] Generated tokens - expire:`, expiresAt.toISOString());
  const decoded = jwt.decode(accessToken);
  console.log(
    `[AUTH] Generated tokens - expiresIn:`,
    new Date(decoded.exp * 1000).toISOString()
  );

  await db.query(
    "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
    [user.id, refreshToken, expiresAt]
  );

  return { accessToken, refreshToken };
};

const refreshTokens = async (refreshToken) => {
  const result = await db.query(
    "SELECT user_id FROM refresh_tokens WHERE token = $1",
    [refreshToken]
  );

  if (result.rows.length === 0) {
    throw new Error("Invalid refresh token");
  }

  const userId = result.rows[0].user_id;
  const userResult = await db.query("SELECT * FROM users WHERE id = $1", [
    userId,
  ]);

  if (userResult.rows.length === 0) {
    throw new Error("User not found");
  }

  const user = userResult.rows[0];
  const tokens = await generateTokens(user);

  const { feedToken, chatToken } = generateStreamTokens(user.id);
  console.log(`[AUTH] Refreshed tokens for user_id: ${user.id}`);

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user,
    feedToken,
    chatToken,
  };
};

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token is required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "Token expired", code: "TOKEN_EXPIRED" });
    }

    return res.status(401).json({ message: "Invalid or expired access token" });
  }
};

const verifyUser = async (identifier, password, cb) => {
  try {
    const sql = "SELECT * FROM users WHERE username = $1 OR email = $1";
    const result = await db.query(sql, [identifier]);

    if (result.rows.length === 0) {
      return cb("User with this username or email doesn't exist.");
    }

    const user = result.rows[0];

    if (!user.hashed_password) {
      return cb(
        "This account was created using Google OAuth. Please log in using Google."
      );
    }

    const storedHashedPassword =
      user.hashed_password instanceof Buffer
        ? user.hashed_password.toString("utf-8")
        : user.hashed_password;

    const passwordMatches = bcrypt.compareSync(password, storedHashedPassword);

    if (passwordMatches) {
      cb(null, user);
    } else {
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
    cb(err, null);
  }
};

const searchUsers = async (searchTerm, selfUserId, cb) => {
  try {
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    const sql =
      "SELECT id, username FROM users WHERE LOWER(username) LIKE $1 AND id != $2";
    const params = [`%${lowercasedSearchTerm}%`, selfUserId];

    const result = await db.query(sql, params);
    cb(null, result.rows);
  } catch (err) {
    cb(err, []);
  }
};

const signupHandler = async (error, result, res) => {
  if (error) {
    res.status(500).json({ message: error });
    return;
  }
  const { username, userId, id, name, email = "", profile } = result;

  try {
    const tokens = await generateTokens({ id, username });

    const feedClient = connect(api_key, api_secret, app_id, {
      location: "us-east",
    });
    const chatClient = StreamChat.getInstance(api_key, api_secret);
    await chatClient.upsertUser({
      id,
      userId,
      name: name || username,
      username,
      email,
      profile,
    });

    const user = await feedClient.user(id).create({
      id,
      userId,
      name: name || username,
      username,
      email,
      profile,
    });

    const userFeed = feedClient.feed("user", id);
    const timelineFeed = feedClient.feed("timeline", id);
    await timelineFeed.follow("user", id);
    const notificationFeed = feedClient.feed("notification", id);

    const { feedToken, chatToken } = generateStreamTokens(id);

    res.status(200).json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
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
    console.error(error.message);
    if (error.code === 16) {
      res.status(409).json({ message: "Username unavailable" });
    } else {
      res.status(500).json({ message: "Error creating user" });
    }
  }
};

const loginHandler = async (error, result, res) => {
  if (error) {
    return res.status(400).json({ message: error });
  }

  try {
    const { username, email, id, userId, name, profile } = result;
    const tokens = await generateTokens({ id, username });
    const { feedToken, chatToken } = generateStreamTokens(id);

    res.status(200).json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
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
    res.status(500).json({ message: "An unexpected error occurred" });
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
      ...updatedProfile,
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

const updateUserProfileImage = async (userId, imageFile) => {
  try {
    const imageUrl = await uploadUserImageToGCP(imageFile, userId);

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

    return { message: "Profile image updated successfully", imageUrl };
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
    await deleteUserActivities(userId);
    // Delete user from the feed database
    console.log('FOOOO')
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
// TODO: test this function
const getUsers = async (offset = 0, limit = 10, searchTerm = "") => {
  try {
    let sql = "SELECT id, username, name, email, image_url FROM users";
    const params = [];

    if (searchTerm) {
      sql += " WHERE LOWER(username) LIKE $1 OR LOWER(name) LIKE $1";
      params.push(`%${searchTerm.toLowerCase()}%`);
    }

    sql += " ORDER BY name LIMIT $2 OFFSET $3";
    params.push(limit, offset);

    const result = await db.query(sql, params);
    return result.rows;
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
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
  getUsers,
  refreshTokens,
  verifyToken,
  generateTokens,
};
