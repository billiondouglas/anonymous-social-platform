const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();

// MongoDB Atlas Connection
mongoose.connect("mongodb+srv://billiondouglas:billion@douglas.je7na04.mongodb.net/tweakerdatabase", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log("MongoDB Connected");
}).catch((err) => console.error(err));

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, "../client/public")));

// Mongoose Schema
const userSchema = new mongoose.Schema({
    username: String,
});
const userModel = mongoose.model("newcollection", userSchema);

// POST route to receive signup form
app.post("/signup", async (req, res) => {
    try {
        const { username } = req.body;
        const newUser = new userModel({ username });
        await newUser.save();
        res.send("User saved successfully!");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error saving user");
    }
});

// Start server
app.listen(5000, () => {
    console.log("Server is running on port 5000!!!");
});