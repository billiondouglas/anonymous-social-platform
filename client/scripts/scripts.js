/**
 * scripts.js
 * This script handles:
 *  - Tweet rendering into the feed
 *  - User interactions: like, retweet, comment
 *  - Posting new tweets to the server
 *  - The zoom-in visual effect for tweets passing under the glass header
 */
document.addEventListener("DOMContentLoaded", async () => {
  // Button for posting a new tweet
  const postBtn = document.getElementById("postTweet");
  // The container element where tweets are rendered
  const feed = document.getElementById("tweetFeed");
  // Textarea for composing a new tweet
  const textarea = document.querySelector("textarea");
  // Message box for showing success/error messages (assume id="messageBox")
  const messageBox = document.getElementById("messageBox");
  if (messageBox) {
    // Hide message box initially
    messageBox.style.display = "none";
    messageBox.textContent = "";
    messageBox.classList.remove("error", "success");
  }

  /**
   * Escapes HTML special characters in a string to prevent XSS.
   * @param {string} str - The input string
   * @returns {string} - Escaped HTML string
   */
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

  /**
   * Formats a date string into a "time ago" format (e.g., 2m, 3h).
   * @param {string} dateString - ISO date string
   * @returns {string} - Time ago label
   */
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

  /**
   * Renders a single tweet into the feed.
   * @param {Object} tweetData - The tweet object to render
   * @param {boolean} [prepend=false] - Whether to add at the start (true) or end (false) of the feed
   * No return value.
   */
  const renderTweet = (tweetData, prepend = false) => {
    const tweet = document.createElement("div");
    tweet.classList.add("tweet");
    // Get counts for comments/retweets/likes (array or number)
    const commentsCount = Array.isArray(tweetData.comments) ? tweetData.comments.length : (typeof tweetData.comments === "number" ? tweetData.comments : 0);
    const retweetsCount = Array.isArray(tweetData.retweets) ? tweetData.retweets.length : (typeof tweetData.retweets === "number" ? tweetData.retweets : 0);
    const likesCount = Array.isArray(tweetData.likes) ? tweetData.likes.length : (typeof tweetData.likes === "number" ? tweetData.likes : 0);
    tweet.innerHTML = `
      <div class="tweet-header-line">
        <span class="tweet-username">@${escapeHTML(tweetData.username || "unknown")}</span>
        <span class="dot">·</span>
        <span class="tweet-time">${formatTimeAgo(tweetData.createdAt)}</span>
      </div>
      <p class="tweet-text">${escapeHTML(tweetData.text)}</p>
      <div class="tweet-actions">
        <button class="comment-btn" title="Comment"><i class="fa-regular fa-comment"></i> ${commentsCount}</button>
        <button class="retweet-btn" title="Retweet"><i class="fa-solid fa-retweet"></i> ${retweetsCount}</button>
        <button class="like-btn" title="Like"><i class="fa-regular fa-heart"></i> ${likesCount}</button>
      </div>
    `;
    if (prepend) {
      feed.prepend(tweet);
    } else {
      feed.appendChild(tweet);
    }

    // Like button event: handles liking a tweet
    const likeBtn = tweet.querySelector(".like-btn");
    likeBtn.addEventListener("click", async () => {
      // Always use the same icon, but color it red after click
      let currentCount = parseInt(likeBtn.textContent.trim().split(" ").pop(), 10) || 0;
      likeBtn.innerHTML = `<i class="fa-regular fa-heart" style="color:red;"></i> ${currentCount + 1}`;
      try {
        const res = await fetch(`/tweets/${tweetData._id}/like`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          const likesCount = Array.isArray(data.likes) ? data.likes.length : data.likes;
          likeBtn.innerHTML = `<i class="fa-regular fa-heart" style="color:red;"></i> ${likesCount}`;
        }
      } catch (err) {
        console.error("Error liking tweet:", err);
      }
    });

    // Comment button event: prompts for comment and posts it
    const commentBtn = tweet.querySelector(".comment-btn");
    commentBtn.addEventListener("click", async () => {
      const commentText = prompt("Enter your comment:");
      if (!commentText) return;
      let currentCount = parseInt(commentBtn.textContent.trim().split(" ").pop(), 10) || 0;
      commentBtn.innerHTML = `<i class="fa-regular fa-comment" style="color:blue;"></i> ${currentCount + 1}`;
      try {
        const res = await fetch(`/tweets/${tweetData._id}/comment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: commentText })
        });
        if (res.ok) {
          const comments = await res.json();
          const commentsCount = Array.isArray(comments) ? comments.length : comments;
          commentBtn.innerHTML = `<i class="fa-regular fa-comment" style="color:blue;"></i> ${commentsCount}`;
        }
      } catch (err) {
        console.error("Error commenting:", err);
      }
    });

    // Retweet button event: handles retweeting a tweet
    const retweetBtn = tweet.querySelector(".retweet-btn");
    retweetBtn.addEventListener("click", async () => {
      let currentCount = parseInt(retweetBtn.textContent.trim().split(" ").pop(), 10) || 0;
      retweetBtn.innerHTML = `<i class="fa-solid fa-retweet" style="color:purple;"></i> ${currentCount + 1}`;
      try {
        const res = await fetch(`/tweets/${tweetData._id}/retweet`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          const retweetsCount = Array.isArray(data.retweets) ? data.retweets.length : data.retweets;
          retweetBtn.innerHTML = `<i class="fa-solid fa-retweet" style="color:purple;"></i> ${retweetsCount}`;
        }
      } catch (err) {
        console.error("Error retweeting:", err);
      }
    });
  };

  // --- Load existing tweets from server and render into feed ---
  try {
    const res = await fetch("/tweets");
    if (res.ok) {
      const tweets = await res.json();
      tweets.forEach((t) => renderTweet(t));
    }
  } catch (err) {
    console.error("Error loading tweets:", err);
  }

  // --- Event listener for posting a new tweet ---
  // Handles user clicking the post button, posts new tweet to server, and displays feedback
  postBtn.addEventListener("click", async () => {
    const tweetText = textarea.value.trim();
    if (!tweetText) return;

    // Hide message box before new attempt
    if (messageBox) {
      messageBox.style.display = "none";
      messageBox.textContent = "";
      messageBox.classList.remove("error", "success");
    }

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
        // Only show success message if server returns a message
        if (messageBox && newTweet && newTweet.message) {
          messageBox.textContent = newTweet.message;
          messageBox.classList.remove("error");
          messageBox.classList.add("success");
          messageBox.style.display = "";
        }
      } else {
        // Try to extract error message from server response
        let errorMsg = "Failed to post tweet";
        try {
          const errData = await res.json();
          if (errData && errData.message) errorMsg = errData.message;
        } catch {}
        if (messageBox && errorMsg) {
          messageBox.textContent = errorMsg;
          messageBox.classList.remove("success");
          messageBox.classList.add("error");
          messageBox.style.display = "";
        }
        console.error(errorMsg);
      }
    } catch (err) {
      if (messageBox) {
        messageBox.textContent = "Error posting tweet. Please try again.";
        messageBox.classList.remove("success");
        messageBox.classList.add("error");
        messageBox.style.display = "";
      }
      console.error("Error posting tweet:", err);
    }
  });
  // --- Zoom-in effect logic for tweets overlapping the glass header ---
  /**
   * IIFE for applying a 'zoom' (CSS class) effect to tweets as they pass under the glass header.
   * - Detects which tweet elements are currently overlapping the glass header.
   * - Adds the 'passing-under-glass' class to those tweets for styling.
   * - Listens for scroll, resize, and DOM changes to update the effect in real time.
   */
  (function () {
    // Select the glass header wrapper and the tweet feed container
    const wrapper = document.querySelector('.liquid-glass-wrapper');
    const feed = document.getElementById('tweetFeed') || document.querySelector('.feed');
    if (!wrapper || !feed) {
      console.warn('[ZoomEffect] No wrapper or feed found');
      return;
    }

    // Used to throttle updates to animation frames
    let ticking = false;

    /**
     * Checks each tweet's position relative to the glass header and toggles the CSS class.
     * For each tweet, if any part of its bounding box overlaps the glass header's bounding box,
     * the 'passing-under-glass' class is added, otherwise it is removed.
     */
    function updateZoom() {
      ticking = false;
      const headerRect = wrapper.getBoundingClientRect();
      const tweets = feed.querySelectorAll('.tweet');
      tweets.forEach(t => {
        const r = t.getBoundingClientRect();
        // Check for overlap between tweet and header rectangles
        const isOverlapping = r.top < headerRect.bottom && r.bottom > headerRect.top;
        t.classList.toggle('passing-under-glass', isOverlapping);
      });
    }

    /**
     * Requests an animation frame update for the zoom effect if not already scheduled.
     */
    function requestUpdate() {
      if (!ticking) {
        requestAnimationFrame(updateZoom);
        ticking = true;
      }
    }

    // Initial update to handle tweets present on load
    requestUpdate();
    // Update zoom effect on scroll: as tweets move under/away from header
    window.addEventListener('scroll', requestUpdate, { passive: true });
    // Update zoom effect on window resize: header/tweet positions may change
    window.addEventListener('resize', requestUpdate);

    // Observe DOM changes (e.g., new tweets added) to update the zoom effect accordingly
    const mo = new MutationObserver(requestUpdate);
    mo.observe(feed, { childList: true, subtree: true });

    // Expose the update function for manual triggering from the console (for debugging)
    window.__zoomInUpdate = updateZoom;
  })();
});