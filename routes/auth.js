const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const multer = require("multer");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const { getUsers } = require("../utils");
const { uploadUserImageToGCP } = require("../utils/imageUpload");
const {
  saveResetTokenToDatabase,
  sendRecoveryEmail,
} = require("../utils/accountRecovery");
const db = require("../db");
const {
  signup,
  login,
  users,
  deleteUser,
  findOrCreateUser,
  updateProfile,
} = require("../controllers/auth");
const { FRONTEND_URL } = require("../config");

const upload = multer();
const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post("/check-user", async (req, res) => {
  const { userId } = req.body;

  try {
    const user = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
    if (user.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ user: user.rows[0] });
  } catch (err) {
    res.status(500).json({ message: "Error checking user" });
  }
});

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

router.post("/get-username-by-id", async (req, res) => {
  const { userId } = req.body;

  try {
    const result = await db.query("SELECT username FROM users WHERE id = $1", [
      userId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const username = result.rows[0].username;
    res.status(200).json({ username });
  } catch (error) {
    console.error("Error fetching username:", error);
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

router.post(
  "/update-profile-image",
  upload.single("image"),
  async (req, res) => {
    const { userId } = req.body;
    const imageFile = req.file;

    if (!userId || !imageFile) {
      return res
        .status(400)
        .json({ message: "User ID and image file are required" });
    }

    try {
      const imageUrl = await uploadUserImageToGCP(imageFile, userId);

      res.status(200).json({ imageUrl });
    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).json({ message: "Error uploading image" });
    }
  }
);

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const userResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (userResult.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "User with this email does not exist" });
    }

    const user = userResult.rows[0];

    if (!user.hashed_password || !user.salt) {
      return res.status(400).json({
        message:
          "This account was created using Google OAuth. Please log in using Google.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiration = new Date();
    tokenExpiration.setHours(tokenExpiration.getHours() + 1);

    await saveResetTokenToDatabase(email, resetToken);

    const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}`;

    await sendRecoveryEmail(email, resetLink);

    res.status(200).json({ message: "Password reset email sent" });
  } catch (error) {
    console.error("Error sending recovery email:", error);
    res.status(500).json({ message: "Error sending recovery email" });
  }
});

router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    console.log("Received token:", token);
    const userResult = await db.query(
      "SELECT * FROM users WHERE resetToken = $1 AND tokenExpiration > NOW()",
      [token]
    );
    console.log("User result from DB:", userResult.rows);

    if (userResult.rows.length === 0) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const user = userResult.rows[0];

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await db.query(
      "UPDATE users SET hashed_password = $1, salt = $2, resetToken = NULL, tokenExpiration = NULL WHERE id = $3",
      [hashedPassword, salt, user.id]
    );

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ message: "Error resetting password" });
  }
});

// TODO: test this route
router.get("/users", async (req, res) => {
  const { offset = 0, limit = 10, searchTerm = "" } = req.query;

  try {
    const users = await getUsers(Number(offset), Number(limit), searchTerm);
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ message: "Error fetching users" });
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
