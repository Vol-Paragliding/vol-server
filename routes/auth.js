const express = require("express");
const passport = require("passport");
const { OAuth2Client } = require("google-auth-library");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const {
  signup,
  login,
  users,
  deleteUser,
  googleAuthCallback,
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
    googleAuthCallback
  )
);

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (obj, done) {
  done(null, obj);
});

router.get(
  "/google",
  (req, res, next) => {
    next();
  },
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  (req, res, next) => {
    next();
  },
  passport.authenticate("google", { failureRedirect: "/" }),
  function (req, res) {
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
    const { sub, email, name } = payload;

    await findOrCreateUser({ googleId: sub, email, name }, res);
  } catch (error) {
    console.error("Google login error:", error);
    res.status(401).json({ message: "Google authentication failed" });
  }
});

router.get("/logout", (req, res) => {
  console.log("GET /auth/logout called");
  req.logout();
  res.redirect("/");
});

router.post("/signup", signup);
router.post("/login", login);
router.post("/users", users);
router.delete("/user/:userId", deleteUser);

module.exports = router;
