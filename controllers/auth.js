const jwt = require("jsonwebtoken");
const db = require("../db");
const crypto = require("crypto");
const { uniqueNamesGenerator, Config } = require("unique-names-generator");

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

const adjectives = [
  "brave",
  "bold",
  "agile",
  "free",
  "swift",
  "soar",
  "keen",
  "fierce",
  "cool",
  "quick",
  "light",
  "sturdy",
  "vivid",
  "mighty",
  "wild",
  "fast",
  "great",
  "zesty",
  "strong",
  "gallant",
  "rapid",
  "epic",
  "nimble",
  "daring",
  "bright",
  "fearless",
  "dashing",
  "heroic",
  "skilled",
  "active",
  "breezy",
  "sunny",
  "steady",
  "calm",
  "airy",
  "spirited",
  "soaring",
  "gliding",
  "cheerful",
  "joyful",
  "lively",
  "radiant",
  "intrepid",
  "zealous",
  "eager",
  "bold",
  "smart",
  "happy",
  "keen",
  "brisk",
  "alert",
  "spry",
  "bouncy",
  "partly",
  "hot",
  "warm",
  "nice",
  "yeeted",
];

const nouns = [
  "air",
  "wing",
  "air",
  "sky",
  "peak",
  "ridge",
  "hawk",
  "cloud",
  "zephyr",
  "glide",
  "soar",
  "flight",
  "breeze",
  "gust",
  "guy",
  "gal",
  "summit",
  "pilot",
  "flyer",
  "therm",
  "wind",
  "jet",
  "reserve",
  "kite",
  "eagle",
  "falcon",
  "canyon",
  "captain",
  "cliff",
  "valley",
  "hill",
  "stream",
  "river",
  "lake",
  "ocean",
  "wave",
  "horizon",
  "sun",
  "moon",
  "star",
  "space",
  "earth",
  "field",
  "trail",
  "path",
  "route",
  "quest",
  "journey",
  "voyage",
  "trek",
  "trip",
  "safari",
  "glow",
  "drift",
  "dash",
  "sprint",
  "boost",
  "pulse",
  "flare",
  "lift",
  "wing",
  "glide",
  "drift",
  "cloudy",
];

const config = {
  dictionaries: [adjectives, nouns],
  separator: ".",
  length: 2,
};

const generateUniqueUsername = async () => {
  let username =
    uniqueNamesGenerator(config) + Math.floor(10 + Math.random() * 90);

  let exists = await new Promise((resolve, reject) => {
    db.get(
      "SELECT COUNT(*) as count FROM users WHERE username = ?",
      [username],
      (err, row) => {
        if (err) {
          return reject(err);
        }
        resolve(row.count > 0);
      }
    );
  });

  while (exists) {
    username =
      uniqueNamesGenerator(config) + Math.floor(10 + Math.random() * 90);
    exists = await new Promise((resolve, reject) => {
      db.get(
        "SELECT COUNT(*) as count FROM users WHERE username = ?",
        [username],
        (err, row) => {
          if (err) {
            return reject(err);
          }
          resolve(row.count > 0);
        }
      );
    });
  }

  return username;
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
      const id = crypto.randomUUID();
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
};
