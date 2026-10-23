const socket = (typeof io !== 'undefined') ? io() : null;
let currentUser = null;
let activeTarget = 'general'; // 'general' or '@username'
let replyTarget = null;
let cursorTrailActive = true;
let clockFormat = '12';
let croppedAvatarData = null;
let knownDMUsers = new Set();

// HOTKEYS (ESC TO CLOSE MODALS)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    toggleProfileModal(false);
    toggleAdminModal(false);
    toggleCropModal(false);
    toggleHotkeyModal(false);
    cancelReply();
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

// INITIALIZE & RESTORE PERSISTED DM CONTACTS
window.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('orbit_theme') || 'purple';
  const savedBg = localStorage.getItem('orbit_bg') || 'bg-grid';
  const savedGlass = localStorage.getItem('orbit_glass') !== 'false';
  const savedTrail = localStorage.getItem('orbit_trail') !== 'false';
  const savedClockFont = localStorage.getItem('orbit_clock_font') || 'font-win11';
  const savedClockFmt = localStorage.getItem('orbit_clock_fmt') || '12';
  const savedSidebarPos = localStorage.getItem('orbit_sidebar_pos') || 'left';

  changeTheme(savedTheme, false);
  changeWallpaper(savedBg, false);
  if (!savedGlass) document.body.classList.remove('liquid-glass');
  cursorTrailActive = savedTrail;
  clockFormat = savedClockFmt;

  if (document.getElementById('theme-select')) document.getElementById('theme-select').value = savedTheme;
  if (document.getElementById('wallpaper-select')) document.getElementById('wallpaper-select').value = savedBg;
  if (document.getElementById('clock-font-select')) document.getElementById('clock-font-select').value = savedClockFont;
  if (document.getElementById('clock-format-select')) document.getElementById('clock-format-select').value = savedClockFmt;
  if (document.getElementById('sidebar-pos-select')) document.getElementById('sidebar-pos-select').value = savedSidebarPos;
  
  changeClockFont(savedClockFont);
  changeSidebarPosition(savedSidebarPos);

  // Restore DM Contact List from localStorage
  const savedDMs = JSON.parse(localStorage.getItem('orbit_dm_contacts') || '[]');
  savedDMs.forEach(user => addDMContact(user, false));
});

// PING METER
setInterval(() => {
  if (!socket) return;
  const start = Date.now();
  socket.emit('pingTest', () => {
    const latency = Date.now() - start;
    document.getElementById('ping-value').innerText = `${latency} ms`;
  });
}, 3000);

// TAB SWITCHING
function switchTab(tabId) {
  document.querySelectorAll('.tab-viewport').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-capsule').forEach(el => el.classList.remove('active'));
  
  const selectedTab = document.getElementById(`tab-${tabId}`);
  if (selectedTab) selectedTab.classList.remove('hidden');

  const activeBtn = Array.from(document.querySelectorAll('.nav-capsule')).find(btn => btn.getAttribute('onclick').includes(tabId));
  if (activeBtn) activeBtn.classList.add('active');
}

// CHAT & DM SWITCHING
function switchChannel(target) {
  activeTarget = target;
  document.getElementById('chat-box').innerHTML = ''; // Messages clear on client
  cancelReply();

  const headerPill = document.getElementById('active-chat-header');
  if (target === 'general') {
    headerPill.innerText = '# General';
  } else {
    headerPill.innerText = `@${target}`;
  }

  document.querySelectorAll('.dm-pill').forEach(el => el.classList.remove('active'));
  const activePill = Array.from(document.querySelectorAll('.dm-pill')).find(p => p.innerText.includes(target));
  if (activePill) activePill.classList.add('active');
}

function addDMContact(username, save = true) {
  if (knownDMUsers.has(username) || username === currentUser?.username) return;
  knownDMUsers.add(username);

  const stack = document.getElementById('dm-contacts-list');
  const pill = document.createElement('div');
  pill.className = 'dm-pill';
  pill.onclick = () => switchChannel(username);
  pill.innerHTML = `<span class="dm-title">@${username}</span><span class="dm-subtext">Online</span>`;
  stack.appendChild(pill);

  if (save) {
    const currentList = Array.from(knownDMUsers);
    localStorage.setItem('orbit_dm_contacts', JSON.stringify(currentList));
  }
}

// MESSAGE SENDING & SQUISH ANIMATION
function sendMessage() {
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  if (!text) return;

  // Squish animation trigger
  const bar = document.getElementById('message-bar-container');
  bar.classList.remove('squish-anim');
  void bar.offsetWidth; // Force reflow
  bar.classList.add('squish-anim');

  // Add sender to DM lists for other users
  if (activeTarget === 'general') {
    addDMContact(currentUser.username);
  }

  const msgPayload = {
    sender: currentUser.username,
    text: text,
    target: activeTarget,
    replyQuote: replyTarget ? replyTarget.text : null,
    replyAuthor: replyTarget ? replyTarget.sender : null
  };

  renderMessage(msgPayload);

  if (socket) {
    socket.emit('sendMessage', msgPayload);
  }

  input.value = '';
  cancelReply();
}

function handleKeyPress(e) { if (e.key === 'Enter') sendMessage(); }

function renderMessage(msg) {
  const box = document.getElementById('chat-box');
  const row = document.createElement('div');
  row.className = 'chat-row';

  let quoteHtml = '';
  if (msg.replyQuote) {
    quoteHtml = `<div class="chat-reply-quote">Replying to @${msg.replyAuthor}: "${msg.replyQuote}"</div>`;
  }

  row.innerHTML = `
    ${quoteHtml}
    <div class="chat-author">${msg.sender}</div>
    <div class="chat-body-text">${msg.text}</div>
    <button class="reply-hover-btn" onclick="initiateReply('${msg.sender}', '${msg.text.replace(/'/g, "\\'")}')">Reply</button>
  `;

  box.appendChild(row);
  box.scrollTop = box.scrollHeight;

  // Dynamically record user in DM stack
  if (msg.sender !== currentUser.username) {
    addDMContact(msg.sender);
  }
}

if (socket) {
  socket.on('newMessage', (msg) => {
    if (msg.target === activeTarget || (activeTarget === msg.sender && msg.target === currentUser.username)) {
      renderMessage(msg);
    }
  });
}

// REPLY SYSTEM
function initiateReply(sender, text) {
  replyTarget = { sender, text };
  const banner = document.getElementById('reply-banner');
  document.getElementById('reply-target-text').innerText = `Replying to @${sender}: "${text}"`;
  banner.classList.remove('hidden');
}

function cancelReply() {
  replyTarget = null;
  const banner = document.getElementById('reply-banner');
  if (banner) banner.classList.add('hidden');
}

// SEARCH ENGINE
function handleSearch(e) { if (e.key === 'Enter') executeSearch(); }
function executeSearch() {
  const query = encodeURIComponent(document.getElementById('global-search').value.trim());
  if (!query) return;
  window.open(`https://duckduckgo.com/?q=${query}`, '_blank');
}

// AUTH
async function register() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    document.getElementById('auth-error').innerText = data.message || (data.success ? "Registered! You may log in." : "Error");
  } catch (err) {
    document.getElementById('auth-error').innerText = "Running local preview mode.";
  }
}

async function login() {
  const username = document.getElementById('username').value.trim() || "User";
  currentUser = { username: username, isAdmin: true };
  
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('user-display').innerText = currentUser.username;
  
  if (currentUser.isAdmin) {
    document.getElementById('admin-trigger-btn').classList.remove('hidden');
  }
  
  startWin11Clock();
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
    
    const clockEl = document.getElementById('win11-clock');
    if (clockEl) clockEl.innerText = `${hours}:${minutes}`;
  }, 1000);
}

function changeClockFont(fontClass) {
  const clock = document.getElementById('win11-clock');
  if (clock) clock.className = `win11-clock ${fontClass}`;
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

function logout() { location.reload(); }