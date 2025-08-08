const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect("mongodb+srv://billiondouglas:billion@douglas.je7na04.mongodb.net/tweakerdatabase?retryWrites=true&w=majority&appName=Douglas");
    console.log("✅ MongoDB connected successfully.");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
};

module.exports = connectDB;
