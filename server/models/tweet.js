/**
 * Tweet Model
 *
 * Represents a tweet-like post in the Tweaker Anonymous platform.
 * Fields:
 *  - text: body of the tweet, up to 280 chars
 *  - username: owner of the tweet
 *  - likes: array of User ObjectIds
 *  - comments: array of { username, text, createdAt } objects
 *  - retweets: array of { username } objects (usernames)
 *
 * Includes:
 *  - timestamps (createdAt, updatedAt)
 *  - virtual field 'timeAgo'
 *  - instance methods to add likes and retweets uniquely
 */
const mongoose = require('mongoose');

// Mongoose schema definition for a tweet
const tweetSchema = new mongoose.Schema({
  // Main tweet content
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 280,
  },
  // Username of the tweet's author
  username: {
    type: String,
    required: true,
  },
  // Array of users who liked this tweet
  likes: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: []
  },
  // Array of comments on this tweet
  comments: {
    type: [
      {
        username: { type: String, required: true },
        text: { type: String, required: true, trim: true, maxlength: 280 },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    default: []
  },
  // Array of users who retweeted this tweet
  retweets: {
    type: [
      {
        username: { type: String, required: true }
      }
    ],
    default: []
  },
}, { timestamps: true }); // adds createdAt and updatedAt automatically

// Virtual property that returns a human-readable "time ago" string
tweetSchema.virtual('timeAgo').get(function () {
  const seconds = Math.floor((new Date() - this.createdAt) / 1000);
  const intervals = [
    { label: 'y', seconds: 31536000 },
    { label: 'mo', seconds: 2592000 },
    { label: 'w', seconds: 604800 },
    { label: 'd', seconds: 86400 },
    { label: 'h', seconds: 3600 },
    { label: 'm', seconds: 60 },
  ];
  for (const i of intervals) {
    const count = Math.floor(seconds / i.seconds);
    if (count >= 1) return `${count}${i.label}`;
  }
  return `${seconds}s`;
});

// Include virtuals when converting to JSON or plain object
tweetSchema.set('toJSON', { virtuals: true });
tweetSchema.set('toObject', { virtuals: true });

// Adds a like from the given userId (ObjectId) if not already liked; returns true if added
tweetSchema.methods.addLike = function(userId) {
  const uid = userId && userId.toString ? userId.toString() : String(userId);
  if (this.likes.some(id => id.toString() === uid)) {
    return false; // Already liked
  }
  this.likes.push(userId);
  return true;
};

// Adds a retweet from the given username if not already retweeted; returns true if added
tweetSchema.methods.addRetweet = function(username) {
  if (this.retweets.some(rt => rt.username === username)) {
    return false; // Already retweeted
  }
  this.retweets.push({ username });
  return true;
};

module.exports = mongoose.model('Tweet', tweetSchema);
