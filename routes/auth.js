const express = require("express");
const passport = require("passport");
const { OAuth2Client } = require("google-auth-library");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

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
        googleId = "zc" + googleId;
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
  (req, res, next) => {
    next();
  },
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
      googleId = "zc" + googleId;
    }

    await findOrCreateUser({ googleId, email, name }, res);
  } catch (error) {
    console.error("Google login error:", error);
    res.status(401).json({ message: "Google authentication failed" });
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
