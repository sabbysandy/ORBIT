const socket = io();
let currentUser = null;

async function register() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (data.success) alert('Account created! You can now log in.');
  else document.getElementById('auth-error').innerText = data.message;
}

async function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
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
    document.getElementById('user-display').innerText = `User: ${currentUser.username}`;
    
    if (currentUser.isAdmin) {
      document.getElementById('admin-btn').classList.remove('hidden');
      loadAdminUsers();
    }
    
    socket.emit('joinChannel', 'global');
  } else {
    document.getElementById('auth-error').innerText = data.message;
  }
}

function sendMessage() {
  const input = document.getElementById('message-input');
  if (input.value.trim() !== '') {
    socket.emit('sendMessage', {
      sender: currentUser.username,
      channel: 'global',
      text: input.value
    });
    input.value = '';
  }
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
  div.innerHTML = `<strong>${msg.sender}:</strong>${msg.text}`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

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
      <span>${u.username}${u.isBanned ? '(Banned)' : ''}</span>
      <button onclick="toggleBan('${u.username}')">${u.isBanned ? 'Unban' : 'Ban'}</button>
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