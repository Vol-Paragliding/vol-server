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

const verifyUser = (username, password, cb) => {
  db.get(
    "SELECT * FROM users WHERE username = ?",
    [username],
    function (err, row) {
      if (err) {
        return cb(err);
      }
      if (!row) {
        return cb("User with this username doesn't exist.");
      }
      const hashed_password = bcrypt.hashSync(password, row.salt);
      if (hashed_password === row.hashed_password) {
        cb(null, row);
      } else {
        return cb("Incorrect Password.");
      }
    }
  );
};

const registerUser = (
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
      "INSERT INTO users (id, userId, username, hashed_password, salt, email, name, profile) VALUES (?,?,?,?,?,?,?,?)";
    const params = [
      id,
      userId,
      username,
      hashed_password,
      salt,
      email,
      name,
      JSON.stringify(profile),
    ];
    db.run(sql, params, function (err) {
      if (err) {
        cb(err, null);
      } else {
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
      }
    });
  } catch (err) {
    cb(err, null);
  }
};

const searchUsers = (searchTerm, selfUserId, cb) => {
  const lowercasedSearchTerm = searchTerm.toLowerCase();
  const sql =
    "SELECT id, username FROM users WHERE LOWER(username) LIKE ? AND id != ?";
  const params = ["%" + lowercasedSearchTerm + "%", selfUserId];
  db.all(sql, params, function (err, innerResult) {
    if (err) {
      cb(err, innerResult);
    } else {
      cb(null, innerResult);
    }
  });
};

const signupHandler = async (error, result, res) => {
  if (error) {
    res.status(500).json({ message: error });
    return;
  }
  const { username, userId, id, name, email = "", profile } = result;
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

    const user = await feedClient.user(id).create({
      id,
      userId,
      name: name || username,
      username,
      email,
      profile,
    });

    const userFeed = feedClient.feed("user", id);
    await userFeed.addActivity({
      actor: user,
      verb: "signup",
      object: `${user.username} has signed up! 🎉🎉🎉`,
      text: `${user.username} has signed up! 🎉🎉🎉`,
    });

    const timelineFeed = feedClient.feed("timeline", id);
    await timelineFeed.follow("user", id);
    const notificationFeed = feedClient.feed("notification", id);

    const feedToken = feedClient.createUserToken(id);
    const chatToken = chatClient.createToken(id);

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
    console.error(error.message);
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
    res.status(500).json({ message: error });
    return;
  }
  const { username, id, userId, name, profile } = result;
  const feedClient = connect(api_key, api_secret, app_id, {
    location: "us-east",
  });

  try {
    const chatClient = StreamChat.getInstance(api_key, api_secret);
    const { users } = await chatClient.queryUsers({
      id: { $eq: id },
    });
    if (!users.length) {
      console.log("User not found");
      return res.status(400).json({ message: "User not found" });
    }

    const chatToken = chatClient.createToken(id);
    const feedToken = feedClient.createUserToken(id);

    res.status(200).json({
      feedToken,
      chatToken,
      user: {
        username,
        userId,
        id,
        name,
        profile,
      },
    });
  } catch (error) {
    console.error("Error in loginHandler 2:", error);
    res.status(500).json({ message: "Error querying user in Stream Chat" });
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
    // Delete user from the local database
    const sql = "DELETE FROM users WHERE id = ?";
    db.run(sql, [userId], function (err) {
      if (err) {
        dbError = err;
      } else {
        dbSuccess = true;
      }
      generateLogMessage();
    });
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
  searchUsers,
  deleteUser,
};
