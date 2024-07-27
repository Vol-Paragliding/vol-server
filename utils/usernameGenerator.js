const { uniqueNamesGenerator, Config } = require("unique-names-generator");
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
      uniqueNamesGenerator(config) + Math.floor(100 + Math.random() * 900);
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

module.exports = { generateUniqueUsername };
