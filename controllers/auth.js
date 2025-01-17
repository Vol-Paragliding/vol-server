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
const { uploadUserImageToGCP } = require("../utils/imageUpload");

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
      const updatedProfile = profile || {};
      await loginHandler(
        null,
        { username, id, userId, name, profile: updatedProfile },
        res
      );
    } else {
      const id = await generateUniqueId();
      const userId = id;
      const username = await generateUniqueUsername();

      let gcpProfileImage = "";
      try {
        const response = await axios({
          url: profileImage,
          method: "GET",
          responseType: "arraybuffer",
        });

        const file = {
          originalname: "profile.jpg",
          buffer: Buffer.from(response.data, "binary"),
          mimetype: response.headers["content-type"] || "image/jpeg",
        };

        gcpProfileImage = await uploadUserImageToGCP(file, userId);
      } catch (uploadError) {
        console.error("Error uploading Google image to GCP:", uploadError);
      }

      const userProfile = {
        bio: "",
        location: "",
        image: gcpProfileImage,
        coverPhoto: "",
        yearStartedFlying: "",
        certifications: { p: "", h: "", s: "", t: "" },
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

      await signupHandler(null, newUser, res);
      console.log(
        `User successfully inserted into database with GCP image: ${JSON.stringify(
          newUser
        )}`
      );
    }
  } catch (err) {
    console.error("Error processing user:", err);
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
