const socket = io();
let currentUser = null;
let currentChannel = 'general';
let searchEngine = 'google';

// CURSOR TRAIL EFFECT
document.addEventListener('mousemove', (e) => {
  const particle = document.createElement('div');
  particle.className = 'trail-particle';
  particle.style.left = `${e.pageX}px`;
  particle.style.top = `${e.pageY}px`;
  document.body.appendChild(particle);
  setTimeout(() => particle.remove(), 500);
});

// PING METER
setInterval(() => {
  const start = Date.now();
  socket.emit('pingTest', () => {
    const latency = Date.now() - start;
    document.getElementById('ping-value').innerText = `${latency} ms`;
  });
}, 3000);

// TAB SWITCHING
function switchTab(tabId) {
  document.querySelectorAll('.tab-viewport').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  
  const selectedTab = document.getElementById(`tab-${tabId}`);
  if (selectedTab) selectedTab.classList.remove('hidden');
  
  if (tabId === 'news') loadGamingNews();
}

// SEARCH ENGINE
function handleSearch(e) { if (e.key === 'Enter') executeSearch(); }
function executeSearch() {
  const query = encodeURIComponent(document.getElementById('global-search').value.trim());
  if (!query) return;
  const engine = document.getElementById('search-engine-select').value;
  let url = `https://www.google.com/search?q=${query}`;
  if (engine === 'bing') url = `https://www.bing.com/search?q=${query}`;
  if (engine === 'duckduckgo') url = `https://duckduckgo.com/?q=${query}`;
  window.open(url, '_blank');
}

// AUTHENTICATION
async function register() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const err = document.getElementById('auth-error');

  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  err.innerText = data.message || (data.success ? "Registered! You may log in." : "Failed");
}

async function login() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const err = document.getElementById('auth-error');

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (data.success) {
    currentUser = data.user;
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    document.getElementById('user-display').innerText = currentUser.username;
    if (currentUser.isAdmin) document.getElementById('admin-dashboard').classList.remove('hidden');
    socket.emit('joinChannel', currentChannel);
    startClock();
  } else {
    err.innerText = data.message || "Invalid credentials.";
  }
}

// CHATS & SOCKETS
function sendMessage() {
  const input = document.getElementById('message-input');
  if (input.value.trim()) {
    socket.emit('sendMessage', { sender: currentUser.username, channel: currentChannel, text: input.value.trim() });
    input.value = '';
  }
}
function handleKeyPress(e) { if (e.key === 'Enter') sendMessage(); }

socket.on('newMessage', (msg) => {
  const box = document.getElementById('chat-box');
  const div = document.createElement('div');
  div.innerHTML = `<strong>${msg.sender}:</strong> ${msg.text}`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
});

// GAMING NEWS TAB
function loadGamingNews() {
  const newsGrid = document.getElementById('news-grid');
  const sampleArticles = [
    { title: "Next-Gen Engine Update Announced", source: "Google News", query: "gaming engine update" },
    { title: "Top Esports Tournament Results", source: "Bing News", query: "esports tournament finals" },
    { title: "New Handheld Console Leaks", source: "Google News", query: "handheld gaming console leaks" }
  ];
  
  newsGrid.innerHTML = '';
  sampleArticles.forEach(art => {
    const card = document.createElement('div');
    card.className = 'news-card';
    card.innerHTML = `<h4>${art.title}</h4><p style="font-size:0.8rem; color:var(--text-muted);">${art.source}</p>`;
    card.onclick = () => window.open(`https://news.google.com/search?q=${encodeURIComponent(art.query)}`, '_blank');
    newsGrid.appendChild(card);
  });
}

// TASKS
function addTask() {
  const input = document.getElementById('task-input');
  if (!input.value.trim()) return;
  const li = document.createElement('li');
  li.innerHTML = `${input.value.trim()} <button onclick="this.parentElement.remove()">✓</button>`;
  document.getElementById('task-list').appendChild(li);
  input.value = '';
}

// SETTINGS & THEMES
function changeTheme(theme) {
  document.body.className = `theme-${theme} liquid-glass`;
}

function toggleLiquidGlass() {
  document.body.classList.toggle('liquid-glass');
}

function startClock() {
  setInterval(() => {
    document.getElementById('clock-widget').innerText = new Date().toLocaleTimeString();
  }, 1000);
}

function unlockStash() {
  if (document.getElementById('stash-pass').value) {
    document.getElementById('stash-content').classList.remove('hidden');
  }
}

function logout() { location.reload(); }