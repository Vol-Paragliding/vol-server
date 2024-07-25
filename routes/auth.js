const express = require("express");
const passport = require("passport");
const { OAuth2Client } = require("google-auth-library");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const db = require("../db");
const {
  signup,
  login,
  users,
  deleteUser,
  findOrCreateUser,
  generateTokens,
} = require("../controllers/auth");

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.API_ENDPOINT}/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      let { id: googleId, emails, displayName: name } = profile;
      const email = emails[0].value;
      if (googleId === "102852313246785808615") {
        googleId = "zack" + googleId;
      }

      try {
        await findOrCreateUser({ googleId, email, name }, done);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect("/home");
  }
);

router.post("/google", async (req, res) => {
  const { tokenId } = req.body;
  try {
    const ticket = await client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    let { sub: googleId, email, name } = payload;

    if (googleId === "102852313246785808615") {
      googleId = "zack" + googleId;
    }

    await findOrCreateUser({ googleId, email, name }, res);
  } catch (error) {
    console.error("Google login error:", error);
    res.status(401).json({ message: "Google authentication failed" });
  }
});

router.post("/check-availability", async (req, res) => {
  const { identifier } = req.body;
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);

  try {
    const query = isEmail
      ? "SELECT * FROM users WHERE email = ?"
      : "SELECT * FROM users WHERE username = ?";
    const result = await new Promise((resolve, reject) => {
      db.get(query, [identifier], (err, row) => {
        if (err) {
          return reject(err);
        }
        resolve(row);
      });
    });

    if (result) {
      res.status(409).json({
        message: isEmail ? "Email already exists" : "Username already exists",
      });
    } else {
      res
        .status(200)
        .json({ message: isEmail ? "Email available" : "Username available" });
    }
  } catch (error) {
    console.error("Error checking availability:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/get-user-id", async (req, res) => {
  const { username } = req.body;

  try {
    const userId = await new Promise((resolve, reject) => {
      const sql = "SELECT id FROM users WHERE username = ?";
      db.get(sql, [username], (err, row) => {
        if (err) {
          return reject(err);
        }
        if (row) {
          resolve(row.id);
        } else {
          resolve(null);
        }
      });
    });

    if (userId === null) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ userId });
  } catch (error) {
    console.error("Error fetching user ID:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/update-profile", async (req, res) => {
  const { id, ...updates } = req.body;

  if (!id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  const updateFields = [];
  const params = [];

  Object.keys(updates).forEach((field) => {
    if (updates[field] !== undefined) {
      updateFields.push(`${field} = ?`);
      params.push(updates[field]);
    }
  });

  if (updateFields.length === 0) {
    return res.status(400).json({ message: "No valid fields to update" });
  }

  params.push(id);

  const sql = `
    UPDATE users
    SET ${updateFields.join(", ")}
    WHERE id = ?
  `;

  try {
    await new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) {
          return reject(err);
        }
        resolve(this);
      });
    });
    res
      .status(200)
      .json({ message: "Profile updated successfully", user: req.body });
  } catch (error) {
    console.error("Error updating user profile:", error);
    res.status(500).json({ message: "Error updating user profile" });
  }
});

router.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});

router.post("/signup", signup);
router.post("/login", login);
router.post("/users", users);
router.delete("/user/:userId", deleteUser);

module.exports = router;
