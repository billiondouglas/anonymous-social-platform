// 🔐 Hashing function using Web Crypto API
  async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  // 🌐 Grab elements
  const form = document.getElementById('signup-form');
  const secretKeyContainer = document.getElementById('secret-key-container');
  const secretKeyDisplay = document.getElementById('secret-key');

  // 🧠 On form submit
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    // ✅ Basic validation
    if (!username || !password || !confirmPassword) {
      alert("All fields are required!");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    // 🔐 Hash the password
    const hashedPassword = await hashPassword(password);

    // 🔑 Generate secret key
    const secretKey = generateSecretKey();

    // 👁 Show secret key to user
    secretKeyDisplay.textContent = secretKey;
    secretKeyContainer.classList.remove('hidden');

    // 💾 Save or log user data (for now)
    console.log({
      username,
      hashedPassword,
      secretKey
    });

    // 🧼 Clear form
    form.reset();
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
