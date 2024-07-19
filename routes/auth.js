const express = require("express");

const { signup, login, users, deleteUser } = require("../controllers/auth.js");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/users", users);
router.delete("/user/:userId", deleteUser);

module.exports = router;
