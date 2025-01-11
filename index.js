const express = require("express");
const cors = require("cors");
require("dotenv").config();
// const session = require("express-session");
// const passport = require("passport");
// const { SESSION_SECRET } = require("./config");
const authRoutes = require("./routes/auth.js");

const app = express();
const PORT = process.env.PORT || 8080;

// app.use(cors());
// app.use(
//   cors({
//     origin: [
//       "http://192.168.86.26:3000", // Replace with your computer's IP
//       "http://localhost:3000",
//     ],
//     methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
//     credentials: true, // Allow cookies and authentication headers
//   })
// );
// app.use(
//   cors({
//     origin: [
//       "https://volflights.com",
//       "https://vol.flights",
//       "http://localhost:3000",
//     ],
//     methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
//     credentials: true,
//   })
// );
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// app.use(
//   session({
//     secret: SESSION_SECRET,
//     resave: false,
//     saveUninitialized: true,
//   })
// );

// app.use(passport.initialize());
// app.use(passport.session());

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.use("/auth", authRoutes);

app.listen(8080, "0.0.0.0", () => console.log(`Server running on port 8080`));
// app.listen(8080, '192.168.68.26', () => console.log(`Server running on port 8080`));
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
