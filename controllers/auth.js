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
    const { identifier, password } = req.body;
    console.log('login', identifier)
    verifyUser(identifier, password, (err, result) => {
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
    const result = await db.query("SELECT * FROM users WHERE googleId = $1", [
      googleId,
    ]);
    const user = result.rows[0];

    if (user) {
      const { id, userId, username, name, profile } = user;
      try {
        const updatedProfile = profile || {};
        await loginHandler(
          null,
          { username, id, userId, name, profile: updatedProfile },
          res
        );
      } catch (error) {
        console.error("Error logging in user:", error);
        return res.status(500).json({ message: "Error logging in user" });
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
        "INSERT INTO users (id, userId, username, name, email, googleId, profile) VALUES ($1, $2, $3, $4, $5, $6, $7)";
      const params = [id, userId, username, name, email, googleId, userProfile];
      await db.query(sql, params);


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
          `User successfully inserted into database: ${JSON.stringify(newUser)}`
        );
      } catch (error) {
        console.error("Error creating user in feed or chat:", error);
        return res
          .status(500)
          .json({ message: "Error creating user in feed or chat" });
      }
    }
  } catch (err) {
    console.error("Error processing user:", err);
    return res.status(500).json({ message: "Error processing user" });
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
