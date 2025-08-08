const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const connectDB = require("./config");
const User = require("./models/user");
require("dotenv").config();
const session = require("express-session");
const flash = require("connect-flash");

const app = express();
//const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

//static files
app.use(express.static(path.join(__dirname, "../client")));

//use ejs as view engine
app.set('view engine', 'ejs');

//middleware
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "tweaker_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60, // 1 hour
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    secure: process.env.NODE_ENV === "production" // Set to true in production with HTTPS
  }
}));

// Flash middleware
app.use(flash());

// Make flash messages available to all EJS templates
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  next();
});

async function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  const userExists = await User.findById(req.session.user._id);
  if (!userExists) {
    req.session.destroy(() => res.redirect("/login"));
  } else {
    next();
  }
}

app.set("views", path.join(__dirname, "../views"));

// Generate 12-word secret key
function generateSecretKey() {
  const words = [
    "alpha", "bravo", "charlie", "delta", "echo", "foxtrot",
    "golf", "hotel", "india", "juliet", "kilo", "lima",
    "mango", "november", "oscar", "papa", "quartz", "romeo",
    "sierra", "tango", "uniform", "viper", "whiskey", "xray",
    "yankee", "zulu"
  ];

  let key = [];
  for (let i = 0; i < 12; i++) {
    const randIndex = Math.floor(Math.random() * words.length);
    key.push(words[randIndex]);
  }

  return key.join(" ");
}

//Get login page
app.get("/", (req, res) => {
    res.render("login", {
        messages: req.flash("error_msg").concat(req.flash("success_msg"))
    });
});

//Get redirection to login page
app.get("/login", (req, res) => {
  res.redirect("/");
});

//Get signup page
app.get("/signup", (req, res) => {
    res.render("signup");
});

// Final catch route (optional)
app.get("/status", (req, res) => {
  res.send("Backendd connected to MongoDB!");
});

// POST Signup Form
app.post("/signup", async (req, res) => {
  const { username, password, confirmPassword } = req.body;

  if (!username || !password || !confirmPassword) {
    req.flash("error_msg", "All fields are required.");
    return res.redirect("/signup");
  }

  if (password !== confirmPassword) {
    req.flash("error_msg", "Passwords do not match.");
    return res.redirect("/signup");
  }

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      req.flash("error_msg", "Username already exists.");
      return res.redirect("/signup");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const secretKey = generateSecretKey();

    const newUser = new User({
      username,
      password: hashedPassword,
      secretKey,
    });

    await newUser.save();

    req.flash("success_msg", "✅ Account created successfully! Please log in.");
    res.redirect("/login");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error. Try again.");
  }
});

// POST Login Form
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    req.flash("error_msg", "All fields are required.");
    return res.redirect("/login");
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      req.flash("error_msg", "Invalid username or password.");
      return res.redirect("/login");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      req.flash("error_msg", "Invalid username or password.");
      return res.redirect("/login");
    }

    req.session.user = user;
    req.flash("success_msg", `Welcome back, ${user.username}!`);
    res.redirect("/home");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error. Try again.");
  }
});

// Home page route
app.get("/home", requireLogin, (req, res) => {
  res.render("home", {
    username: req.session.user.username,
    success: req.flash("success_msg"),
    error: req.flash("error_msg")
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).send("Error logging out. Please try again.");
    }
    res.clearCookie("connect.sid", { path: "/" });
    console.log("✅ User logged out successfully.");
    res.redirect("/");
  });
});

app.use((req, res) => {
  res.status(404).render("404");
});

// Server
//defining local server address
const PORT = process.env.PORT || 4000;

//calling local server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});