const { generateUniqueUsername } = require("../utils/usernameGenerator");
const db = require("../db");
const {
  loginHandler,
  registerUser,
  signupHandler,
  verifyUser,
  updateProfile,
  updateUserProfileImage,
  searchUsers,
  searchUsersHandler,
  deleteUser,
} = require("../utils");

const generateUniqueId = async () => {
  const { nanoid } = await import("nanoid");
  return nanoid();
};

const signup = async (req, res) => {
  try {
    const { identifier, password, email, userId, id, username, name, profile } =
      req.body;

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
      profile,
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

const findOrCreateUser = async (
  { googleId, email, name, profileImage },
  res
) => {
  try {
    const user = await new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM users WHERE googleId = ?",
        [googleId],
        (err, row) => {
          if (err) {
            return reject(err);
          }
          resolve(row);
        }
      );
    });

    if (user) {
      const { id, userId, username, name, profile } = user;
      try {
        const updatedProfile = profile ? JSON.parse(profile) : {};
        await loginHandler(
          null,
          { username, id, userId, name, profile: updatedProfile },
          res
        );
      } catch (error) {
        console.error("Error logging in user:", error);
        res.status(500).json({ message: "Error logging in user" });
      }
    } else {
      const id = await generateUniqueId();
      const userId = id;
      const username = await generateUniqueUsername();
      const userProfile = {
        bio: "",
        location: "",
        image: profileImage || "",
        coverPhoto: "",
        yearStartedFlying: "",
        certifications: {
          p: "",
          h: "",
          s: "",
          t: "",
        },
        favoriteSites: [],
        wings: [],
        harnesses: [],
        inReachSocial: "",
        inReachEmail: "",
        xContestProfile: "",
        telegramUsername: "",
      };

      const sql =
        "INSERT INTO users (id, userId, username, name, email, googleId, profile) VALUES (?,?,?,?,?,?,?)";
      const params = [
        id,
        userId,
        username,
        name,
        email,
        googleId,
        JSON.stringify(userProfile),
      ];
      await new Promise((resolve, reject) => {
        db.run(sql, params, async (err) => {
          if (err) {
            return reject(err);
          }
          const newUser = {
            id,
            userId,
            username,
            name,
            email,
            googleId,
            profile: userProfile,
          };

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
    res.status(500).json({ message: "Error processing user" });
  }
};

module.exports = {
  signup,
  login,
  users,
  deleteUser,
  findOrCreateUser,
  updateProfile,
  updateUserProfileImage,
};
