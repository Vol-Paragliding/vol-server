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
} = require("../utils");

const signup = async (req, res) => {
  try {
    const { username, password, email, userId, id } = req.body;

    registerUser(id, userId, username, password, function (err, result) {
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
          if (err) {
            console.error("Error querying database:", err);
            return reject(err);
          }
          resolve(row);
        }
      );
    });

    if (user) {
      const id = user.id;
      const userId = user.userId;
      const username = user.username;

      try {
        await loginHandler(null, { username, id, userId, name }, res);
      } catch (error) {
        console.error("Error logging in user:", error);
        res.status(500).json({ message: "Error logging in user" });
      }
    } else {
      const id = googleId;
      const userId = googleId;
      const username = googleId;
      const sql =
        "INSERT INTO users (id, userId, username, name, email, googleId) VALUES (?,?,?,?,?,?)";
      const params = [id, userId, username, name, email, googleId];
      await new Promise((resolve, reject) => {
        db.run(sql, params, async (err) => {
          if (err) {
            console.error("Error inserting user into database:", err);
            return reject(err);
          }

          const newUser = { id, userId, username, name, email, googleId };

          try {
            await signupHandler(null, newUser, res);
            resolve(newUser);
          } catch (error) {
            console.error("Error creating user in feed or chat:", error);
            res
              .status(500)
              .json({ message: "Error creating user in feed or chat" });
          }
        });
      });
    }
  } catch (err) {
    console.error("Error in findOrCreateUser:", err);
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
  findOrCreateUser,
  generateTokens,
};
