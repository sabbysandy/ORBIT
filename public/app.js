const socket = io();
let currentUser = null;

// AUTHENTICATION
async function register() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorElement = document.getElementById('auth-error');

  if (!username || !password) {
    errorElement.innerText = "Please enter both username and password.";
    return;
  }

  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  
  const data = await res.json();
  if (data.success) {
    errorElement.style.color = "#4ade80";
    errorElement.innerText = "Identity registered! You may now log in.";
  } else {
    errorElement.style.color = "#f87171";
    errorElement.innerText = data.message || "Registration failed.";
  }
}

async function login() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorElement = document.getElementById('auth-error');

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
      document.getElementById('admin-btn').classList.remove('hidden');
      loadAdminUsers();
    }

    socket.emit('joinChannel', 'global');
  } else {
    errorElement.style.color = "#f87171";
    errorElement.innerText = data.message || "Invalid credentials.";
  }
}

// LIVE CHAT
function sendMessage() {
  const input = document.getElementById('message-input');
  if (input.value.trim() !== '') {
    socket.emit('sendMessage', {
      sender: currentUser.username,
      channel: 'global',
      text: input.value.trim()
    });
    input.value = '';
  }
}

function handleKeyPress(event) {
  if (event.key === 'Enter') sendMessage();
}

socket.on('loadMessages', (messages) => {
  const box = document.getElementById('chat-box');
  box.innerHTML = '';
  messages.forEach(msg => appendMessage(msg));
});

socket.on('newMessage', (msg) => {
  appendMessage(msg);
});

socket.on('chatCleared', () => {
  document.getElementById('chat-box').innerHTML = '';
});

function appendMessage(msg) {
  const box = document.getElementById('chat-box');
  const div = document.createElement('div');
  div.className = 'chat-message';
  div.innerHTML = `<span class="username">${msg.sender}:</span> ${msg.text}`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// TASK MANAGER MODULE
function addTask() {
  const input = document.getElementById('task-input');
  const text = input.value.trim();
  if (!text) return;

  const list = document.getElementById('task-list');
  const li = document.createElement('li');
  li.innerHTML = `
    <span>${text}</span>
    <button onclick="this.parentElement.remove()" class="btn-secondary" style="padding: 4px 8px; flex: none;">✓</button>
  `;
  list.appendChild(li);
  input.value = '';
}

// ADMIN DASHBOARD
function toggleAdminPanel() {
  document.getElementById('admin-panel').classList.toggle('hidden');
}

async function loadAdminUsers() {
  const res = await fetch('/api/admin/users');
  const users = await res.json();
  const list = document.getElementById('user-list');
  list.innerHTML = '';
  users.forEach(u => {
    const div = document.createElement('div');
    div.className = 'user-row';
    div.innerHTML = `
      <span>${u.username} ${u.isBanned ? '<strong style="color: #f87171;">(Banned)</strong>' : ''}</span>
      <button onclick="toggleBan('${u.username}')" class="${u.isBanned ? 'btn-outline' : 'btn-danger'}" style="flex: none; padding: 6px 12px;">
        ${u.isBanned ? 'Unban' : 'Ban'}
      </button>
    `;
    list.appendChild(div);
  });
}

async function toggleBan(username) {
  await fetch('/api/admin/toggle-ban', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });
  loadAdminUsers();
}

async function clearChat() {
  await fetch('/api/admin/clear-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: 'global' })
  });
}

function logout() {
  location.reload();
}