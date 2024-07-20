const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");

const {
  loginHandler,
  registerUser,
  signupHandler,
  verifyUser,
  searchUsers,
  searchUsersHandler,
  deleteUser,
  googleAuthCallback,
} = require("../utils");

const signup = async (req, res) => {
  try {
    const { username, password } = req.body;
    const userId = username;

    registerUser(userId, username, password, function (err, result) {
      signupHandler(err, result, res);
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    verifyUser(username, password, (err, result) => {
      loginHandler(err, result, res);
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

const users = async (req, res) => {
  try {
    const { searchTerm, selfUserId } = req.body;

    searchUsers(searchTerm, selfUserId, (err, result) => {
      searchUsersHandler(err, result, res);
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

const findOrCreateUser = async ({ googleId, email, name }, res) => {
  try {
    const user = await new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM users WHERE googleId = ?",
        [googleId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });

    if (user) {
      // User exists, handle login
      console.log('user', user);
      await loginHandler(null, user, res);
    } else {
      // User does not exist, register new user
      const userId = googleId;
      const sql =
        "INSERT INTO users (id, username, email, googleId) VALUES (?,?,?,?)";
      const params = [userId, name, email, googleId];
      await new Promise((resolve, reject) => {
        db.run(sql, params, async (err) => {
          if (err) return reject(err);

          const newUser = { id: userId, username: name, email, googleId };

          // Call signupHandler after creating new user
          await signupHandler(null, newUser, res);
          resolve(newUser);
        });
      });
    }
  } catch (err) {
    res.status(500).json({ message: "Error processing user" });
  }
};

const generateTokens = (user) => {
  const feedToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  const chatToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  return { feedToken, chatToken };
};

module.exports = {
  signup,
  login,
  users,
  deleteUser,
  googleAuthCallback,
  findOrCreateUser,
  generateTokens,
};
