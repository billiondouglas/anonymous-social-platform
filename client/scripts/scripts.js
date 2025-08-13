/**
 * scripts.js
 * This script handles:
 *  - Tweet rendering into the feed
 *  - User interactions: like, retweet, comment
 *  - Posting new tweets to the server
 *  - The zoom-in visual effect for tweets passing under the glass header
 */
document.addEventListener("DOMContentLoaded", async () => {
  // Reusable helpers assigned conditionally
  let autoResizeFn = null;
  let updateRemainingCharsFn = null;
  // Flash message utility
  function showFlashMessage(message, type = "success") {
    let flashEl = document.getElementById("flashMessage");
    if (!flashEl) {
      flashEl = document.createElement("div");
      flashEl.id = "flashMessage";
      flashEl.className = "flash-message";
      document.body.appendChild(flashEl);
    }
    flashEl.textContent = message;
    flashEl.className = `flash-message ${type} show`;
    flashEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4caf50' : '#f44336'};
      color: #fff;
      padding: 10px 15px;
      border-radius: 5px;
      z-index: 9999;
      font-size: 14px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      transition: opacity 0.3s ease;
    `;
    flashEl.style.display = "block";

    setTimeout(() => {
      flashEl.classList.remove("show");
      setTimeout(() => {
        flashEl.style.display = "none";
      }, 300);
    }, 3000);
  }
  // IntersectionObserver for tweets (used in renderTweet)
  let io;
  // Button for posting a new tweet
  const postBtn = document.getElementById("postTweet");
  // The container element where tweets are rendered
  const feed = document.getElementById("tweetFeed");
  // Textarea for composing a new tweet
  const textarea = document.querySelector("textarea");
  if (textarea) {
    // --- Auto-resize textarea as user types ---
    const autoResize = (el) => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
    // expose for use outside this block
    autoResizeFn = autoResize;
    // Prevent inner scrollbar while we control height
    textarea.style.overflowY = 'hidden';
    // Initial sizing in case of prefilled value
    autoResize(textarea);
    // Grow/shrink with content
    textarea.addEventListener('input', () => autoResize(textarea));
    // Character counter (only shows at <= 20 chars remaining)
    const MAX_TWEET_LEN = Number(textarea.getAttribute('maxlength')) || 280;
    // Ensure the textarea enforces the limit
    if (!textarea.hasAttribute('maxlength')) textarea.setAttribute('maxlength', String(MAX_TWEET_LEN));

    const charCounter = document.createElement('div');
    charCounter.className = 'char-counter';
    charCounter.setAttribute('aria-live', 'polite');
    charCounter.hidden = true; // hidden until near the limit
    textarea.insertAdjacentElement('afterend', charCounter);

    function updateRemainingChars(){
      const remaining = MAX_TWEET_LEN - (textarea.value ? textarea.value.length : 0);
      if (remaining <= 20) {
        charCounter.hidden = false;
        charCounter.textContent = `${remaining} left`;
        charCounter.classList.toggle('char-counter--danger', remaining <= 5);
        charCounter.classList.toggle('char-counter--warn', remaining > 5 && remaining <= 20);
      } else {
        charCounter.hidden = true;
        charCounter.textContent = '';
        charCounter.classList.remove('char-counter--warn', 'char-counter--danger');
      }
    }
    // expose for use outside this block
    updateRemainingCharsFn = updateRemainingChars;
    textarea.addEventListener('input', updateRemainingChars);
    // Initial render (handles prefilled values)
    updateRemainingChars();
  }
  // Message box for showing success/error messages (assume id="messageBox")
  // (Removed messageBox initialization and hiding)

  /**
   * Escapes HTML special characters in a string to prevent XSS.
   * @param {string} str - The input string
   * @returns {string} - Escaped HTML string
   */
  const escapeHTML = (str = "") =>
    String(str).replace(/[&<>'"]/g, (tag) =>
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
   * Formats a date in compact form:
   *  - <24h  -> "xh"
   *  - <=7d  -> "xd"
   *  - same year -> "D Mon"
   *  - different year -> "D Mon, YY"
   */
  function formatTimeCompact(dateInput) {
    const d = new Date(dateInput);
    if (isNaN(d)) return "";
    const now = new Date();
    const diffMs = now - d;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const HOUR = 3600e3;
    const DAY = 24 * HOUR;

    if (diffSec < 60) {
      return `${diffSec}s`;
    }
    if (diffMin < 60) {
      return `${diffMin}m`;
    }
    if (diffMs < DAY) {
      const h = Math.max(1, Math.floor(diffMs / HOUR));
      return `${h}h`;
    }
    const days = Math.floor(diffMs / DAY);
    if (days <= 7) return `${days}d`;

    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const dd = d.getDate();
    const mon = months[d.getMonth()];
    if (d.getFullYear() === now.getFullYear()) return `${dd} ${mon}`;
    return `${dd} ${mon}, ${String(d.getFullYear()).slice(-2)}`;
  }

  /**
   * Renders a single tweet into the feed.
   * @param {Object} tweetData - The tweet object to render
   * @param {boolean} [prepend=false] - Whether to add at the start (true) or end (false) of the feed
   * No return value.
   */
  const renderTweet = (tweetData, prepend = false) => {
    if (!feed) return;
    const tweet = document.createElement("div");
    tweet.classList.add("tweet");
    // Get counts for comments/retweets/likes (array or number)
    const commentsCount = Array.isArray(tweetData.comments) ? tweetData.comments.length : (typeof tweetData.comments === "number" ? tweetData.comments : 0);
    const retweetsCount = Array.isArray(tweetData.retweets) ? tweetData.retweets.length : (typeof tweetData.retweets === "number" ? tweetData.retweets : 0);
    const likesCount = Array.isArray(tweetData.likes) ? tweetData.likes.length : (typeof tweetData.likes === "number" ? tweetData.likes : 0);
    tweet.innerHTML = `
      <div class="tweet-header-line">
        <a class="tweet-username" href="/profile/${encodeURIComponent(tweetData.username || '')}">@${escapeHTML(tweetData.username || "unknown")}</a>
        <span class="dot">·</span>
        <span class="tweet-time">${formatTimeCompact(tweetData.createdAt)}</span>
      </div>
      <p class="tweet-text">${escapeHTML(tweetData.text || "")}</p>
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
    if (typeof io !== 'undefined' && io && tweet) {
      io.observe(tweet);
    }

    // Like button event: handles liking a tweet
    const likeBtn = tweet.querySelector(".like-btn");
    likeBtn.addEventListener("click", async () => {
      try {
        const res = await fetch(`/tweets/${tweetData._id}/like`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          const likesCount = Array.isArray(data.likes) ? data.likes.length : data.likes;
          const isLikedByUser = data.isLikedByUser; // Optional: set from server
          likeBtn.innerHTML = `<i class="fa-regular fa-heart" style="color:${isLikedByUser ? 'red' : 'inherit'};"></i> ${likesCount}`;
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
  if (feed) {
    try {
      const res = await fetch("/tweets");
      if (res.ok) {
        const tweets = await res.json();
        tweets.forEach((t) => renderTweet(t));
      }
    } catch (err) {
      console.error("Error loading tweets:", err);
    }
  }

  // Normalize any server-rendered times that include a datetime attribute
  document.querySelectorAll('.tweet-time[datetime]').forEach(el => {
    const iso = el.getAttribute('datetime');
    if (iso) el.textContent = formatTimeCompact(iso);
  });

  // --- Event listener for posting a new tweet ---
  // Handles user clicking the post button, posts new tweet to server, and displays feedback
  if (postBtn && textarea) {
    postBtn.addEventListener("click", async () => {
      const tweetText = textarea.value.trim();
      if (!tweetText) return;

      let res;
      try {
        res = await fetch("/tweets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: tweetText }),
        });
      } catch (err) {
        showFlashMessage("Network error. Please try again.", "error");
        console.error("Network error posting tweet:", err);
        return;
      }

      if (res.ok) {
        let newTweet = null;
        try {
          newTweet = await res.json();
        } catch (e) {
          console.warn("JSON parse failed for posted tweet", e);
          newTweet = null;
        }
        if (newTweet) {
          renderTweet(newTweet, true);
        }
        textarea.value = "";
        if (textarea) {
          if (typeof updateRemainingCharsFn === 'function') updateRemainingCharsFn();
          if (typeof autoResizeFn === 'function') autoResizeFn(textarea);
        }
        showFlashMessage((newTweet && newTweet.message) ? newTweet.message : "Tweet posted successfully!", "success");
      } else {
        let errorMsg = "Failed to post tweet";
        try {
          const errData = await res.json();
          if (errData && errData.message) errorMsg = errData.message;
        } catch (e) {
          // If parsing fails, just use the default errorMsg
        }
        if (errorMsg) showFlashMessage(errorMsg, "error");
        console.error(errorMsg);
      }
    });
  }
  // script.js
  const wrapper = document.querySelector('.liquid-glass-wrapper');
  if (wrapper) {
    const tweets = Array.from(document.querySelectorAll('.tweet:not([data-template])'));
    let wrapperRect = wrapper.getBoundingClientRect();

    // Recompute wrapper rect on resize (since it's fixed, this is rare)
    window.addEventListener('resize', () => {
      wrapperRect = wrapper.getBoundingClientRect();
    });

    // Track which tweets are on screen with IO (viewport root)
    const visible = new Set();
    io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else {
          visible.delete(entry.target);
          entry.target.classList.remove('zoom');
        }
      }
      // After IO updates, schedule a zoom pass
      requestZoomPass();
    }, {
      root: null,
      threshold: [0, 0.01] // as soon as a tweet touches the viewport
    });

    tweets.forEach(t => io.observe(t));

    // Throttle zoom computation with rAF
    let raf = null;
    function requestZoomPass() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        applyZoom();
      });
    }

    function applyZoom() {
      // Make exactly the tweets overlapping the glass zoom
      for (const t of visible) {
        const rect = t.getBoundingClientRect();
        if (overlaps(rect, wrapperRect, 8)) t.classList.add('zoom');
        else t.classList.remove('zoom');
      }
    }

    // Also run on scroll since overlap changes while scrolling
    window.addEventListener('scroll', requestZoomPass, { passive: true });

    // Initial pass
    requestZoomPass();

    function overlaps(aRect, bRect, minOverlapPx = 10) {
      const xOverlap = Math.max(0, Math.min(aRect.right, bRect.right) - Math.max(aRect.left, bRect.left));
      const yOverlap = Math.max(0, Math.min(aRect.bottom, bRect.bottom) - Math.max(aRect.top, bRect.top));
      return xOverlap > 0 && yOverlap >= minOverlapPx;
    }
  }
});