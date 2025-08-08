document.addEventListener("DOMContentLoaded", () => {
  const postBtn = document.getElementById("postTweet");
  const feed = document.getElementById("tweetFeed");
  const textarea = document.querySelector("textarea");

  postBtn.addEventListener("click", () => {
    const tweetText = textarea.value.trim();
    if (tweetText.length === 0) return;

    const tweet = document.createElement("div");
    tweet.classList.add("tweet");
    tweet.innerHTML = `
      <p>${tweetText}</p>
      <div class="tweet-actions">
        <button>💬 0</button>
        <button>❤️ 0</button>
      </div>
    `;

    feed.prepend(tweet); // newest tweets on top
    textarea.value = "";
  });
});