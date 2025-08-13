// ── Tweet validation and sanitization ────────────────────────────────────────
const MAX_TWEET_LEN = 280;
function sanitizeTweetText(raw) {
  if (typeof raw !== 'string') return '';
  // Remove control characters except newline
  let cleaned = raw.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '');
  // Normalize newlines to \n
  cleaned = cleaned.replace(/\r\n?/g, '\n');
  // Collapse multiple spaces/tabs but keep newlines
  cleaned = cleaned.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).join('\n');
  return cleaned.trim();
}
/**
   * Tweaker Anonymous Social Platform — Express Server
   *
   * This server exposes authentication, session management, and core tweet APIs
   * (create, like, comment, retweet). Views are rendered via EJS and static assets
   * are served from the client folder. MongoDB is used via Mongoose models.
   *
   * Key concerns addressed here:
   *  - Security: sessions (httpOnly cookie), password hashing (bcrypt), sane cookie flags
   *  - UX: flash messages across redirects, guarded routes via requireLogin
   *  - Data integrity: input trimming/validation, safe fallbacks for arrays
   */
// ── Core dependencies & local modules ───────────────────────────────────────────
const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const connectDB = require("./config");
const User = require("./models/user");
const Tweet = require("./models/tweet");
require("dotenv").config();
const session = require("express-session");
const flash = require("connect-flash");
const expressLayouts = require('express-ejs-layouts');

// ── App bootstrap ─────────────────────────────────────────────────────────────
const app = express();
//const PORT = process.env.PORT || 5000;

// Connect to MongoDB (throws if connection fails)
connectDB();

// Serve static files (CSS, JS, images) from /client
app.use(express.static(path.join(__dirname, "../client")));

// Use EJS for server-side rendering of views
app.set('view engine', 'ejs');

// Parse form data and JSON payloads
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/**
   * Session configuration
   * - httpOnly cookie prevents JS access
   * - sameSite: "strict" in production to mitigate CSRF, "lax" in dev
   * - secure only on HTTPS in production
   */
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

// Flash messages stored in session
app.use(flash());

// Expose flash messages to all EJS templates via res.locals
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  next();
});

/**
   * Authorization guard for protected routes.
   * Redirects to /login if no user in session. Also ensures the user still exists
   * in the database (e.g., if deleted while session persisted).
   */
async function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  // Double-check user still exists in DB to avoid dangling sessions
  const userExists = await User.findById(req.session.user._id);
  if (!userExists) {
    req.session.destroy(() => res.redirect("/login"));
  } else {
    next();
  }
}

// Absolute path to the EJS templates directory
app.set("views", path.join(__dirname, "../views"));
app.use(expressLayouts);
app.set('layout', 'layouts/main');


/**
   * GET /tweets
   * Returns up to 50 tweets (newest first) for the authenticated user’s feed.
   */
app.get("/tweets", requireLogin, async (req, res) => {
  try {
    const tweets = await Tweet.find().sort({ createdAt: -1 }).limit(50);
    res.json(tweets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load tweets" });
  }
});

/**
   * POST /tweets
   * Create a new tweet for the current session user. Sanitizes input and enforces max length.
   */
app.post("/tweets", requireLogin, async (req, res) => {
  try {
    let text = sanitizeTweetText(req.body.text).trim();
    if (!text || text.length < 1 || text.length > MAX_TWEET_LEN) {
      return res.status(400).json({ message: `Tweet must be between 1 and ${MAX_TWEET_LEN} characters` });
    }
    text = text.replace(/[&<>'"]/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[ch]));
    const newTweet = new Tweet({
      text,
      likes: [],
      comments: [],
      retweets: [],
      username: req.session.user.username,
      createdAt: new Date()
    });
    await newTweet.save();
    res.status(201).json({ ...newTweet.toObject(), message: "Tweet posted!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating tweet" });
  }
});

/**
   * POST /tweets/:id/like
   * Toggle like for the current user. If already liked, the helper will prevent duplicates.
   */
app.post("/tweets/:id/like", requireLogin, async (req, res) => {
  try {
    const tweet = await Tweet.findById(req.params.id);
    if (!tweet) return res.status(404).json({ message: "Tweet not found" });

    const userId = req.session.user._id;
    tweet.likes = Array.isArray(tweet.likes) ? tweet.likes : [];

    const alreadyLiked = tweet.likes.some(id => id.toString() === userId.toString());
    if (alreadyLiked) {
      tweet.likes = tweet.likes.filter(id => id.toString() !== userId.toString());
    } else {
      tweet.likes.push(userId);
    }

    await tweet.save();
    res.json({ likes: tweet.likes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error liking tweet" });
  }
});

/**
   * POST /tweets/:id/comment
   * Append a comment to a tweet as the current user. Trims input and timestamps the entry.
   */
app.post("/tweets/:id/comment", requireLogin, async (req, res) => {
  const { text } = req.body;
  // Guard: reject empty/whitespace-only comments
  if (!text || !text.trim()) {
    return res.status(400).json({ message: "Comment text is required" });
  }
  try {
    const tweet = await Tweet.findById(req.params.id);
    if (!tweet) return res.status(404).json({ message: "Tweet not found" });

    tweet.comments = Array.isArray(tweet.comments) ? tweet.comments : [];
    tweet.comments.push({
      username: req.session.user.username,
      text: text.trim(),
      createdAt: new Date()
    });
    await tweet.save();
    res.json({ comments: tweet.comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error commenting" });
  }
});

/**
   * POST /tweets/:id/retweet
   * Toggle retweet for the current user. Uses model helper to avoid duplicates.
   */
app.post("/tweets/:id/retweet", requireLogin, async (req, res) => {
  try {
    const tweet = await Tweet.findById(req.params.id);
    if (!tweet) return res.status(404).json({ message: "Tweet not found" });

    const username = req.session.user.username;
    tweet.retweets = Array.isArray(tweet.retweets) ? tweet.retweets : [];

    // If already retweeted, remove existing retweet entry (acts as toggle)
    if (tweet.retweets.some(rt => rt.username === username)) {
      tweet.retweets = tweet.retweets.filter(rt => rt.username !== username);
    } 
    if (!tweet.addRetweet(username)) {
      return res.status(400).json({ message: "Already retweeted" });
    }

    await tweet.save();
    res.json({ retweets: tweet.retweets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error retweeting" });
  }
});

/**
   * Generates a human-readable 12-word secret (not cryptographically strong).
   * Use as a recovery hint or device pairing phrase — do not treat as a wallet seed.
   */
function generateSecretKey() {
  // Wordlist for random picks; can be moved to config if needed
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

// Render login page (root)
app.get("/", (req, res) => {
  res.render("login", {
    layout: false,
    messages: req.flash("error_msg").concat(req.flash("success_msg"))
  });
});

// Redirect any /login GET back to root (canonical login)
app.get("/login", (req, res) => {
  res.redirect("/");
});

// Render signup page
app.get("/signup", (req, res) => {
  res.render("signup", { layout: false });
});

// Health check endpoint (useful during deployment)
app.get("/status", (req, res) => {
  res.send("Backendd connected to MongoDB!");
});

/**
   * POST /signup
   * Validates inputs, hashes password, creates user and logs them in.
   * Stores a 12-word secretKey on the user for later recovery purposes.
   */
app.post("/signup", async (req, res) => {
  const { username, password, confirmPassword } = req.body;

  // Guard: basic presence validation
  if (!username || !password || !confirmPassword) {
    req.flash("error_msg", "All fields are required.");
    return res.redirect("/signup");
  }

  // Guard: password confirmation
  if (password !== confirmPassword) {
    req.flash("error_msg", "Passwords do not match.");
    return res.redirect("/signup");
  }

  try {
    const existingUser = await User.findOne({ username });
    // Guard: unique username
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

    req.session.user = newUser;
    req.flash("success_msg", `Welcome, ${newUser.username}! Your account has been created.`);
    res.redirect("/home");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error. Try again.");
  }
});

/**
   * POST /login
   * Validates credentials and establishes a session on success.
   */
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  // Guard: require both username and password
  if (!username || !password) {
    return res.render("login", {
      layout: false,
      error_msg: "All fields are required.",
      success_msg: "",
      username
    });
  }

  try {
    const user = await User.findOne({ username });
    // Auth: no user found
    if (!user) {
      return res.render("login", {
        layout: false,
        error_msg: "Invalid username or password.",
        success_msg: "",
        username
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    // Auth: password mismatch
    if (!isMatch) {
      return res.render("login", {
        layout: false,
        error_msg: "Incorrect password.",
        success_msg: "",
        username
      });
    }

    req.session.user = user;
    req.flash("success_msg", `Welcome back, ${user.username}!`);
    res.redirect("/home");
  } catch (err) {
    console.error(err);
    res.render("login", {
      layout: false,
      error_msg: "Server error. Please try again.",
      success_msg: "",
      username
    });
  }
});

// Serve displacement-map and other images from /server/client/images at /images
app.use('/images', express.static(path.join(__dirname,'client/images')))

/**
   * GET /home
   * Protected home page rendering; surfaces flash messages into template.
   */

app.get("/home", requireLogin, (req, res) => {
  res.render("home", {
    username: req.session.user.username,
    success: req.flash("success_msg")[0] || "",
    error: req.flash("error_msg")[0] || ""
  });
});

/**
 * GET /profile
 * Shows the logged-in user's own profile page.
 */
app.get("/profile", requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);
    if (!user) {
      req.flash("error_msg", "User not found.");
      return res.redirect("/home");
    }
    const tweets = await Tweet.find({ username: user.username }).sort({ createdAt: -1 });
    const stats = {
      tweetCount: tweets.length,
      followersCount: user.followers ? user.followers.length : 0,
      followingCount: user.following ? user.following.length : 0
    };
    res.render("profile", {
      user,
      tweets,
      stats,
      isOwn: true
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Error loading profile.");
    res.redirect("/home");
  }
});

/**
 * GET /profile/:username
 * Shows another user's profile page.
 */
app.get("/profile/:username", requireLogin, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) {
      req.flash("error_msg", "User not found.");
      return res.redirect("/home");
    }
    const tweets = await Tweet.find({ username: user.username }).sort({ createdAt: -1 });
    const stats = {
      tweetCount: tweets.length,
      followersCount: user.followers ? user.followers.length : 0,
      followingCount: user.following ? user.following.length : 0
    };
    res.render("profile", {
      user,
      tweets,
      stats,
      isOwn: req.session.user.username === user.username
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Error loading profile.");
    res.redirect("/home");
  }
});

/**
   * GET /logout
   * Destroys the session, clears cookie, and redirects to login.
   */
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

// Catch-all 404 renderer for unknown routes
app.use((req, res) => {
  res.status(404).send("404 Not Found");
});

// ── HTTP server startup ─────────────────────────────────────────────────────
// Prefer env PORT (for PaaS) with 4000 fallback locally
const PORT = process.env.PORT || 4000;

// Start listening and log the local URL
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});