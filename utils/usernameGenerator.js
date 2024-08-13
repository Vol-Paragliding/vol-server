const { uniqueNamesGenerator } = require("unique-names-generator");
const db = require("../db");

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
  "rapid",
  "epic",
  "nimble",
  "active",
  "breezy",
  "sunny",
  "steady",
  "calm",
  "airy",
  "joyful",
  "lively",
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
  "party",
];

const nouns = [
  "air",
  "freak",
  "wing",
  "party",
  "sky",
  "peak",
  "hawk",
  "cloud",
  "zephyr",
  "glide",
  "jump",
  "feat",
  "soar",
  "fear",
  "gust",
  "guy",
  "gal",
  "therm",
  "wind",
  "jet",
  "kite",
  "eagle",
  "hill",
  "river",
  "lake",
  "ocean",
  "wave",
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
    uniqueNamesGenerator(config) + Math.floor(100 + Math.random() * 900);

  const checkUsernameExists = async (username) => {
    try {
      const res = await db.query(
        "SELECT COUNT(*) as count FROM users WHERE username = $1",
        [username]
      );
      return res.rows[0].count > 0;
    } catch (err) {
      throw new Error("Error querying database for username uniqueness.");
    }
  };

  let exists = await checkUsernameExists(username);

  let attempt = 0;
  const maxAttempts = 10;

  while (exists && attempt < maxAttempts) {
    username =
      uniqueNamesGenerator(config) + Math.floor(100 + Math.random() * 900);
    exists = await checkUsernameExists(username);
    attempt++;
  }

  if (exists) {
    throw new Error(
      "Unable to generate a unique username after multiple attempts"
    );
  }

  return username;
};

module.exports = { generateUniqueUsername };
