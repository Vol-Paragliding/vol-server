const axios = require("axios");
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
    const {
      identifier,
      password,
      email,
      userId,
      id,
      username,
      name,
      profile,
      recaptchaToken,
    } = req.body;

    const recaptchaResponse = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify`,
      {},
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: recaptchaToken,
        },
      }
    );

    const recaptchaData = recaptchaResponse.data;
    console.log("recaptchaData", recaptchaData);
    console.log("recaptchaToken", recaptchaToken);
    console.log("identifier", identifier);
    console.log("password", password);
    if (!recaptchaData.success || recaptchaData.score < 0.5) {
      return res
        .status(400)
        .json({ message: "reCAPTCHA verification failed." });
    }

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
        if (err) {
          console.log("Error during user registration", err);
        }
        signupHandler(err, result, res);
      }
    );
  } catch (err) {
    console.log("Signup error", err);
    res.status(500).json({ message: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { identifier, password, recaptchaToken } = req.body;

    // Log the received data for debugging
    console.log("Login attempt with identifier:", identifier);
    console.log("Password length:", password.length);
    console.log("Recaptcha token:", recaptchaToken);

    const recaptchaResponse = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify`,
      {},
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: recaptchaToken,
        },
      }
    );

    const recaptchaData = recaptchaResponse.data;

    if (!recaptchaData.success || recaptchaData.score < 0.5) {
      console.log("Recaptcha verification failed");
      return res
        .status(400)
        .json({ message: "reCAPTCHA verification failed." });
    }

    console.log("Recaptcha verification passed");

    verifyUser(identifier, password, (err, result) => {
      if (err) {
        console.log("Error during user verification", err);
      }
      loginHandler(err, result, res);
    });
  } catch (error) {
    console.error("Login error", error);
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
