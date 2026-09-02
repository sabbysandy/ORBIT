const socket = io();
let currentUser = null;
let currentChannel = 'general';
let cursorTrailActive = true;
let clockFormat = '12';
let croppedAvatarData = null;

// HOTKEYS (ESC TO CLOSE MODALS)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    toggleProfileModal(false);
    toggleAdminModal(false);
    toggleCropModal(false);
    toggleHotkeyModal(false);
  }
});

// CURSOR TRAIL
document.addEventListener('mousemove', (e) => {
  if (!cursorTrailActive) return;
  const particle = document.createElement('div');
  particle.className = 'trail-particle';
  particle.style.left = `${e.pageX}px`;
  particle.style.top = `${e.pageY}px`;
  document.body.appendChild(particle);
  setTimeout(() => particle.remove(), 500);
});

// LOAD PERSISTED SETTINGS FROM LOCALSTORAGE
window.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('orbit_theme') || 'purple';
  const savedBg = localStorage.getItem('orbit_bg') || 'bg-grid';
  const savedGlass = localStorage.getItem('orbit_glass') !== 'false';
  const savedTrail = localStorage.getItem('orbit_trail') !== 'false';
  const savedClockFont = localStorage.getItem('orbit_clock_font') || 'font-win11';
  const savedClockFmt = localStorage.getItem('orbit_clock_fmt') || '12';
  const savedSidebarPos = localStorage.getItem('orbit_sidebar_pos') || 'left';
  const savedEngine = localStorage.getItem('orbit_search_engine') || 'google';

  changeTheme(savedTheme, false);
  changeWallpaper(savedBg, false);
  if (!savedGlass) document.body.classList.remove('liquid-glass');
  cursorTrailActive = savedTrail;
  clockFormat = savedClockFmt;

  document.getElementById('theme-select').value = savedTheme;
  document.getElementById('wallpaper-select').value = savedBg;
  document.getElementById('clock-font-select').value = savedClockFont;
  document.getElementById('clock-format-select').value = savedClockFmt;
  document.getElementById('sidebar-pos-select').value = savedSidebarPos;
  document.getElementById('search-engine-select').value = savedEngine;
  
  changeClockFont(savedClockFont);
  changeSidebarPosition(savedSidebarPos);
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
  const engine = localStorage.getItem('orbit_search_engine') || 'google';
  let url = `https://www.google.com/search?q=${query}`;
  if (engine === 'bing') url = `https://www.bing.com/search?q=${query}`;
  if (engine === 'duckduckgo') url = `https://duckduckgo.com/?q=${query}`;
  window.open(url, '_blank');
}
function saveSearchEngine(val) { localStorage.setItem('orbit_search_engine', val); }

// AUTH
async function register() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  document.getElementById('auth-error').innerText = data.message || (data.success ? "Registered! You may log in." : "Error");
}

async function login() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
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
    
    if (currentUser.isAdmin) {
      document.getElementById('admin-trigger-btn').classList.remove('hidden');
    }
    
    socket.emit('joinChannel', currentChannel);
    startWin11Clock();
  } else {
    document.getElementById('auth-error').innerText = data.message || "Invalid credentials.";
  }
}

// WIN11 CLOCK
function startWin11Clock() {
  setInterval(() => {
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    minutes = minutes < 10 ? '0' + minutes : minutes;
    
    if (clockFormat === '12') {
      hours = hours % 12 || 12;
    }
    hours = hours < 10 ? '0' + hours : hours;
    
    document.getElementById('win11-clock').innerText = `${hours}:${minutes}`;
  }, 1000);
}

function changeClockFont(fontClass) {
  document.getElementById('win11-clock').className = `win11-clock ${fontClass}`;
  localStorage.setItem('orbit_clock_font', fontClass);
}
function changeClockFormat(fmt) {
  clockFormat = fmt;
  localStorage.setItem('orbit_clock_fmt', fmt);
}

// AVATAR CROPPER
function handleAvatarSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('crop-image-target').src = e.target.result;
    toggleCropModal(true);
  };
  reader.readAsDataURL(file);
}

function adjustCropZoom(val) {
  document.getElementById('crop-image-target').style.transform = `scale(${val})`;
}

function saveCroppedAvatar() {
  croppedAvatarData = document.getElementById('crop-image-target').src;
  document.getElementById('topbar-avatar').src = croppedAvatarData;
  document.getElementById('prof-avatar').src = croppedAvatarData;
  toggleCropModal(false);
  alert("Profile picture updated!");
}

function toggleCropModal(show) {
  const modal = document.getElementById('crop-modal');
  if (show) modal.classList.remove('hidden');
  else modal.classList.add('hidden');
}
function closeCropModal(e) { if (e.target.id === 'crop-modal') toggleCropModal(false); }

function toggleHotkeyModal(show) {
  const modal = document.getElementById('hotkey-modal');
  if (show) modal.classList.remove('hidden');
  else modal.classList.add('hidden');
}
function closeHotkeyModal(e) { if (e.target.id === 'hotkey-modal') toggleHotkeyModal(false); }

// CHAT & PROFILES
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
  div.innerHTML = `<strong class="user-item" onclick="openUserProfile('${msg.sender}')">${msg.sender}:</strong> ${msg.text}`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
});

function openSelfProfile() { if (currentUser) openUserProfile(currentUser.username); }
function openUserProfile(username) {
  document.getElementById('prof-username').innerText = username;
  document.getElementById('prof-status').innerText = "Status: Online";
  toggleProfileModal(true);
}
function toggleProfileModal(show) {
  const modal = document.getElementById('profile-modal');
  if (show) modal.classList.remove('hidden');
  else modal.classList.add('hidden');
}
function closeProfileModal(e) { if (e.target.id === 'profile-modal') toggleProfileModal(false); }

// ADMIN MODAL
function toggleAdminModal(show) {
  const modal = document.getElementById('admin-modal');
  if (show) modal.classList.remove('hidden');
  else modal.classList.add('hidden');
}
function closeAdminModal(e) { if (e.target.id === 'admin-modal') toggleAdminModal(false); }

// GAMING NEWS
function loadGamingNews() {
  const newsGrid = document.getElementById('news-grid');
  const headlines = [
    "Unreal Engine 5.5 Features Announced", "Top Esports Tournament Bracket Set",
    "Handheld Console Next-Gen Rumors", "Major RPG Patch Notes Live",
    "Indie Game Hits Record Players", "Cyberpunk DLC Sequel Teaser",
    "GPU Architecture Breakthrough", "Cloud Gaming Expansion Plan",
    "Classic Franchise Remaster Confirmed", "VR Hardware Price Cut Announced",
    "FPS Championship Final Scores", "New Open World MMO Revealed"
  ];
  
  newsGrid.innerHTML = '';
  headlines.forEach(title => {
    const card = document.createElement('div');
    card.className = 'news-card';
    card.innerHTML = `<h4>${title}</h4><p style="font-size:0.8rem; color:var(--text-muted);">Google / Bing Gaming</p>`;
    card.onclick = () => window.open(`https://news.google.com/search?q=${encodeURIComponent(title)}`, '_blank');
    newsGrid.appendChild(card);
  });
}

function triggerNewsRefresh() {
  loadGamingNews();
  alert("Gaming News refreshed across the system.");
}

// PERSISTENT SETTINGS TOGGLES
function changeTheme(theme, save = true) {
  document.body.className = document.body.className.replace(/theme-\w+/g, `theme-${theme}`);
  if (save) localStorage.setItem('orbit_theme', theme);
}
function changeWallpaper(bg, save = true) {
  document.body.className = document.body.className.replace(/bg-\w+/g, bg);
  if (save) localStorage.setItem('orbit_bg', bg);
}
function overrideGlobalWallpaper(bg) {
  changeWallpaper(bg);
  alert("Global wallpaper overridden by Admin.");
}
function toggleLiquidGlass() { 
  document.body.classList.toggle('liquid-glass');
  localStorage.setItem('orbit_glass', document.body.classList.contains('liquid-glass'));
}
function toggleCursorTrail() { 
  cursorTrailActive = !cursorTrailActive;
  localStorage.setItem('orbit_trail', cursorTrailActive);
}
function changeSidebarPosition(pos) {
  const container = document.getElementById('hub-container');
  if (pos === 'right') container.classList.add('layout-right');
  else container.classList.remove('layout-right');
  localStorage.setItem('orbit_sidebar_pos', pos);
}

function toggleGamingMode() {
  const badge = document.getElementById('gaming-indicator');
  badge.classList.toggle('hidden');
}

function unlockStash() {
  if (document.getElementById('stash-pass').value) {
    document.getElementById('stash-content').classList.remove('hidden');
  }
}

function logout() { location.reload(); }