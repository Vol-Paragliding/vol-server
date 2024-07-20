const { connect } = require("getstream");
const StreamChat = require("stream-chat").StreamChat;
const bcrypt = require("bcrypt");

const db = require("../db");
require("dotenv").config();

const api_key = process.env.STREAM_API_KEY;
const api_secret = process.env.STREAM_API_SECRET;
const app_id = process.env.STREAM_APP_ID;

const verifyUser = (username, password, cb) => {
  const lowercasedUsername = username.toLowerCase();
  db.get(
    "SELECT * FROM users WHERE LOWER(username) = ?",
    [lowercasedUsername],
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

const registerUser = (userId, username, password, cb) => {
  const lowercasedUsername = username.toLowerCase();
  const lowercasedUserId = userId.toLowerCase();
  const salt = bcrypt.genSaltSync(10);
  const hashed_password = bcrypt.hashSync(password, salt);

  const sql =
    "INSERT INTO users (id, username, hashed_password, salt) VALUES (?,?,?,?)";
  const params = [lowercasedUserId, lowercasedUsername, hashed_password, salt];
  db.run(sql, params, function (err, innerResult) {
    if (err) {
      cb(err, innerResult);
    } else {
      cb(null, {
        userId: lowercasedUserId,
        username: lowercasedUsername,
        hashed_password,
        salt,
      });
    }
  });
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

const signupHandler = async (err, result, res) => {
  if (err) {
    res.status(500).json({ message: err });
    return;
  }
  const { username, userId } = result;
  const lowercasedUsername = username.toLowerCase();
  const lowercasedUserId = userId.toLowerCase();
  const feedClient = connect(api_key, api_secret, app_id, {
    location: "us-east",
  });

  try {
    const chatClient = StreamChat.getInstance(api_key, api_secret);
    await chatClient.upsertUser({
      id: lowercasedUserId,
      username: lowercasedUsername,
    });

    const user = await feedClient.user(lowercasedUserId).create({
      name: lowercasedUsername,
      id: lowercasedUserId,
    });

    const userFeed = feedClient.feed("user", lowercasedUserId);
    await userFeed.addActivity({
      actor: user,
      verb: "signup",
      object: `${user.id} has signed up! 🎉🎉🎉`,
      text: `${user.id} has signed up! 🎉🎉🎉`,
    });

    const timelineFeed = feedClient.feed("timeline", lowercasedUserId);
    await timelineFeed.follow("user", lowercasedUserId);
    const notificationFeed = feedClient.feed("notification", lowercasedUserId);

    const feedToken = feedClient.createUserToken(lowercasedUserId);
    const chatToken = chatClient.createToken(lowercasedUserId);

    res.status(200).json({
      feedToken,
      chatToken,
      username: lowercasedUsername,
      userId: lowercasedUserId,
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
    res.status(500).json({ message: error });
    return;
  }
  const { username, id } = result;
  const lowercasedUsername = username.toLowerCase();
  const lowercasedUserId = id.toLowerCase();
  const feedClient = connect(api_key, api_secret, app_id, {
    location: "us-east",
  });

  try {
    const chatClient = StreamChat.getInstance(api_key, api_secret);
    const { users } = await chatClient.queryUsers({
      id: { $eq: lowercasedUserId },
    });
    if (!users.length) {
      return res
        .status(400)
        .json({ message: "User not found in Chat Database" });
    }

    const chatToken = chatClient.createToken(lowercasedUserId);
    const feedToken = feedClient.createUserToken(lowercasedUserId);

    res.status(200).json({
      feedToken,
      chatToken,
      username: lowercasedUsername,
      userId: lowercasedUserId,
    });
  } catch (error) {
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

const googleAuthCallback = async (accessToken, refreshToken, profile, done) => {
  const lowercasedUsername = profile.emails[0].value.toLowerCase();
  const lowercasedUserId = profile.id.toLowerCase();

  const feedClient = connect(api_key, api_secret, app_id, {
    location: "us-east",
  });

  try {
    const chatClient = StreamChat.getInstance(api_key, api_secret);
    let userExists = false;

    const existingUser = await new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM users WHERE id = ?",
        [lowercasedUserId],
        function (err, row) {
          if (err) return reject(err);
          if (row) {
            userExists = true;
            resolve(row);
          } else {
            resolve(null);
          }
        }
      );
    });

    if (!userExists) {
      await new Promise((resolve, reject) => {
        registerUser(
          lowercasedUserId,
          lowercasedUsername,
          null,
          (err, user) => {
            if (err) return reject(err);
            resolve(user);
          }
        );
      });

      await chatClient.upsertUser({
        id: lowercasedUserId,
        username: lowercasedUsername,
      });

      const user = await feedClient.user(lowercasedUserId).create({
        name: lowercasedUsername,
        id: lowercasedUserId,
      });

      const userFeed = feedClient.feed("user", lowercasedUserId);
      await userFeed.addActivity({
        actor: user,
        verb: "signup",
        object: `${user.id} has signed up! 🎉🎉🎉`,
        text: `${user.id} has signed up! 🎉🎉🎉`,
      });

      const timelineFeed = feedClient.feed("timeline", lowercasedUserId);
      await timelineFeed.follow("user", lowercasedUserId);
      const notificationFeed = feedClient.feed(
        "notification",
        lowercasedUserId
      );
    }

    const feedToken = feedClient.createUserToken(lowercasedUserId);
    const chatToken = chatClient.createToken(lowercasedUserId);

    return done(null, {
      profile,
      feedToken,
      chatToken,
      username: lowercasedUsername,
      userId: lowercasedUserId,
    });
  } catch (error) {
    console.error(error.message);
    return done(error);
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
  googleAuthCallback,
};
