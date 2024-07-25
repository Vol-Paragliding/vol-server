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
    const { identifier, password, email, userId, id, username, name } = req.body;

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const emailToUse = isEmail ? identifier : email;
    const usernameToUse = isEmail ? username : identifier;

    registerUser(
      id,
      userId,
      usernameToUse,
      password,
      emailToUse,
      name,
      function (err, result) {
        signupHandler(err, result, res);
      }
    );
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
  console.log(
    `findOrCreateUser called with googleId: ${googleId}, email: ${email}, name: ${name}`
  );
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
          if (row) {
            console.log(`User found in database: ${JSON.stringify(row)}`);
          } else {
            console.log("User not found in database");
          }
          resolve(row);
        }
      );
    });

    if (user) {
      const { id, userId, username, name } = user;
      try {
        console.log(`Logging in existing user: ${username}`);
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
      console.log(
        `Inserting new user into database with params: ${JSON.stringify(
          params
        )}`
      );
      await new Promise((resolve, reject) => {
        db.run(sql, params, async (err) => {
          if (err) {
            console.error("Error inserting user into database:", err);
            return reject(err);
          }

          const newUser = { id, userId, username, name, email, googleId };

          try {
            await signupHandler(null, newUser, res);
            console.log(
              `User successfully inserted into database: ${JSON.stringify(
                newUser
              )}`
            );
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
