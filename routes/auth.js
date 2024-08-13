const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const db = require("../db");
const {
  signup,
  login,
  users,
  deleteUser,
  findOrCreateUser,
  updateProfile,
  updateUserProfileImage,
} = require("../controllers/auth");

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post("/google", async (req, res) => {
  const { tokenId } = req.body;
  try {
    const ticket = await client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture: profileImage } = payload;

    await findOrCreateUser({ googleId, email, name, profileImage }, res);
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
      ? "SELECT * FROM users WHERE email = $1"
      : "SELECT * FROM users WHERE username = $1";
    const result = await db.query(query, [identifier]);

    if (result.rows.length > 0) {
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
    const sql = "SELECT id FROM users WHERE username = $1";
    const result = await db.query(sql, [username]);

    const userId = result.rows.length > 0 ? result.rows[0].id : null;

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

  try {
    const result = await updateProfile(id, updates);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Error updating profile" });
  }
});

router.post("/update-profile-image", async (req, res) => {
  const { userId, imageUrl } = req.body;

  if (!userId || !imageUrl) {
    return res
      .status(400)
      .json({ message: "User ID and image URL are required" });
  }

  try {
    const result = await updateUserProfileImage(userId, imageUrl);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Error updating profile image" });
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
