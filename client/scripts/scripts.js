document.addEventListener("DOMContentLoaded", async () => {
  const postBtn = document.getElementById("postTweet");
  const feed = document.getElementById("tweetFeed");
  const textarea = document.querySelector("textarea");

  const escapeHTML = (str) =>
    str.replace(/[&<>'"]/g, (tag) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      }[tag] || tag)
    );

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const tweetDate = new Date(dateString);
    const diffInSeconds = Math.floor((now - tweetDate) / 1000);
    if (diffInSeconds < 60) return `${diffInSeconds}s`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d`;
  };

  // Render a tweet into the feed
  const renderTweet = (tweetData, prepend = false) => {
    const tweet = document.createElement("div");
    tweet.classList.add("tweet");
    tweet.innerHTML = `
      <div class="tweet-header-line">
        <span class="tweet-username">@${escapeHTML(tweetData.username || "unknown")}</span>
        <span class="dot">·</span>
        <span class="tweet-time">${formatTimeAgo(tweetData.createdAt)}</span>
      </div>
      <p class="tweet-text">${escapeHTML(tweetData.text)}</p>
      <div class="tweet-actions">
        <button class="comment-btn" title="Comment">💬 ${Array.isArray(tweetData.comments) ? tweetData.comments.length : (typeof tweetData.comments === "number" ? tweetData.comments : 0)}</button>
        <button class="retweet-btn" title="Retweet">🔁 ${Array.isArray(tweetData.retweets) ? tweetData.retweets.length : (typeof tweetData.retweets === "number" ? tweetData.retweets : 0)}</button>
        <button class="like-btn" title="Like">❤️ ${Array.isArray(tweetData.likes) ? tweetData.likes.length : (typeof tweetData.likes === "number" ? tweetData.likes : 0)}</button>
      </div>
    `;
    if (prepend) {
      feed.prepend(tweet);
    } else {
      feed.appendChild(tweet);
    }

    // Like button
    const likeBtn = tweet.querySelector(".like-btn");
    likeBtn.addEventListener("click", async () => {
      // Optimistic UI update
      let currentText = likeBtn.textContent;
      let match = currentText.match(/❤️\s*(\d+)/);
      let currentCount = match ? parseInt(match[1], 10) : 0;
      likeBtn.textContent = `❤️ ${currentCount + 1}`;

      try {
        const res = await fetch(`/tweets/${tweetData._id}/like`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          let likesCount = 0;
          if (Array.isArray(data.likes)) {
            likesCount = data.likes.length;
          } else if (typeof data.likes === "number") {
            likesCount = data.likes;
          }
          likeBtn.textContent = `❤️ ${likesCount}`;
        }
      } catch (err) {
        console.error("Error liking tweet:", err);
        alert("Something went wrong. Please try again.");
      }
    });

    // Comment button
    const commentBtn = tweet.querySelector(".comment-btn");
    commentBtn.addEventListener("click", async () => {
      const commentText = prompt("Enter your comment:");
      if (!commentText) return;

      // Optimistic UI update
      let currentText = commentBtn.textContent;
      let match = currentText.match(/💬\s*(\d+)/);
      let currentCount = match ? parseInt(match[1], 10) : 0;
      commentBtn.textContent = `💬 ${currentCount + 1}`;

      try {
        const res = await fetch(`/tweets/${tweetData._id}/comment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: commentText })
        });
        if (res.ok) {
          const comments = await res.json();
          let commentsCount = 0;
          if (Array.isArray(comments)) {
            commentsCount = comments.length;
          } else if (typeof comments === "number") {
            commentsCount = comments;
          }
          commentBtn.textContent = `💬 ${commentsCount}`;
        }
      } catch (err) {
        console.error("Error commenting:", err);
        alert("Something went wrong. Please try again.");
      }
    });

    // Retweet button
    const retweetBtn = tweet.querySelector(".retweet-btn");
    retweetBtn.addEventListener("click", async () => {
      // Optimistic UI update
      let currentText = retweetBtn.textContent;
      let match = currentText.match(/🔁\s*(\d+)/);
      let currentCount = match ? parseInt(match[1], 10) : 0;
      retweetBtn.textContent = `🔁 ${currentCount + 1}`;

      try {
        const res = await fetch(`/tweets/${tweetData._id}/retweet`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          let retweetsCount = 0;
          if (Array.isArray(data.retweets)) {
            retweetsCount = data.retweets.length;
          } else if (typeof data.retweets === "number") {
            retweetsCount = data.retweets;
          }
          retweetBtn.textContent = `🔁 ${retweetsCount}`;
        }
      } catch (err) {
        console.error("Error retweeting:", err);
        alert("Something went wrong. Please try again.");
      }
    });
  };

  // Load existing tweets
  try {
    const res = await fetch("/tweets");
    if (res.ok) {
      const tweets = await res.json();
      tweets.forEach((t) => renderTweet(t));
    }
  } catch (err) {
    console.error("Error loading tweets:", err);
  }

  // Handle posting a new tweet
  postBtn.addEventListener("click", async () => {
    const tweetText = textarea.value.trim();
    if (!tweetText) return;

    try {
      const res = await fetch("/tweets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: tweetText }),
      });

      if (res.ok) {
        const newTweet = await res.json();
        renderTweet(newTweet, true);
        textarea.value = "";
      } else {
        console.error("Failed to post tweet");
      }
    } catch (err) {
      console.error("Error posting tweet:", err);
    }
  });
});