// 🔐 Hashing function using Web Crypto API
  document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('signupForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const messageDiv = document.getElementById('message');

  const showMessage = (msg, isError = false) => {
    messageDiv.textContent = msg;
    messageDiv.style.color = isError ? 'red' : 'green';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    // Basic validation
    if (!username || !password) {
      showMessage('Both fields are required.', true);
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        showMessage(data.message || 'Something went wrong.', true);
        return;
      }

      showMessage('Signup successful! Redirecting...');
      setTimeout(() => {
        window.location.href = 'index.html'; // or home.html if that’s your feed
      }, 1500);
    } catch (error) {
      console.error('Signup error:', error);
      showMessage('Network error. Please try again.', true);
    }
  });
});

  // 🔄 Generate 12-word human-readable key
  function generateSecretKey() {
    const words = [
      'alpha', 'beta', 'charlie', 'delta', 'echo', 'foxtrot',
      'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima',
      'mango', 'november', 'oscar', 'papa', 'quartz', 'romeo',
      'sierra', 'tango', 'uniform', 'viper', 'whiskey', 'xray',
      'yankee', 'zulu'
    ];
    let key = [];
    for (let i = 0; i < 12; i++) {
      const randIndex = Math.floor(Math.random() * words.length);
      key.push(words[randIndex]);
    }
    return key.join(' ');
  }