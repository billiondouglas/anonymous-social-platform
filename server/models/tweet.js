const mongoose = require('mongoose');

const tweetSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 280,
  },
  username: {
    type: String,
    required: true,
  },
  likes: {
    type: [
      {
        username: { type: String, required: true }
      }
    ],
    default: []
  },
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
  retweets: {
    type: [
      {
        username: { type: String, required: true }
      }
    ],
    default: []
  },
}, { timestamps: true }); // adds createdAt and updatedAt automatically

// Virtual field for "time ago"
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

// Ensure virtuals are included in JSON
tweetSchema.set('toJSON', { virtuals: true });
tweetSchema.set('toObject', { virtuals: true });

// Instance method to add a unique like
tweetSchema.methods.addLike = function(username) {
  if (this.likes.some(like => like.username === username)) {
    return false; // Already liked
  }
  this.likes.push({ username });
  return true;
};

// Instance method to add a unique retweet
tweetSchema.methods.addRetweet = function(username) {
  if (this.retweets.some(rt => rt.username === username)) {
    return false; // Already retweeted
  }
  this.retweets.push({ username });
  return true;
};

module.exports = mongoose.model('Tweet', tweetSchema);

