const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
require("dotenv").config();
const { SESSION_SECRET } = require("./config");
const authRoutes = require("./routes/auth.js");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(
  cors({
    origin: ["https://volflights.com", "http://localhost:3000"],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.use("/auth", authRoutes);
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
