const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MONGO_DB CONNECTION
// Replace YOUR_MONGODB_CONNECTION_STRING_HERE with your real connection string from MongoDB Atlas!
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://Orbit_Admin:(sahib123)@cluster0.3rkyf8o.mongodb.net/?appName=Cluster0";

mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => console.log("Successfully connected to MongoDB Atlas!"))
  .catch(err => console.error("Database connection error:", err.message));

// DATABASE SCHEMAS
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  isBanned: { type: Boolean, default: false },
  tasks: Array
});

const MessageSchema = new mongoose.Schema({
  sender: String,
  channel: String,
  text: String,
  timestamp: { type: Date, default: Date.now }
});

const SettingsSchema = new mongoose.Schema({
  featureToggles: {
    chatEnabled: { type: Boolean, default: true },
    musicEnabled: { type: Boolean, default: true },
    tasksEnabled: { type: Boolean, default: true }
  }
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);
const Settings = mongoose.model('Settings', SettingsSchema);

// INITIALIZE SYSTEM SETTINGS
async function initSettings() {
  const current = await Settings.findOne();
  if (!current) await Settings.create({});
}
initSettings();

// AUTHENTICATION & LOGIN ENDPOINTS
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = new User({ username, password });
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: "Username taken or invalid." });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  
  if (!user) return res.status(401).json({ success: false, message: "Invalid credentials." });
  if (user.isBanned) return res.status(403).json({ success: false, message: "Account is banned." });

  const settings = await Settings.findOne();
  const isAdmin = (username === "mynamesobad" && password === "banana");

  res.json({
    success: true,
    user: { username: user.username, isAdmin },
    settings: settings.featureToggles
  });
});

// ADMIN PANEL CONTROLS
app.get('/api/admin/users', async (req, res) => {
  const users = await User.find({}, 'username isBanned');
  res.json(users);
});

app.post('/api/admin/toggle-ban', async (req, res) => {
  const { username } = req.body;
  const user = await User.findOne({ username });
  if (user) {
    user.isBanned = !user.isBanned;
    await user.save();
    res.json({ success: true, isBanned: user.isBanned });
  }
});

app.post('/api/admin/clear-chat', async (req, res) => {
  const { channel } = req.body;
  await Message.deleteMany({ channel });
  io.emit('chatCleared', { channel });
  res.json({ success: true });
});

app.post('/api/admin/toggle-feature', async (req, res) => {
  const { feature, enabled } = req.body;
  const settings = await Settings.findOne();
  settings.featureToggles[feature] = enabled;
  await settings.save();
  io.emit('featureUpdated', settings.featureToggles);
  res.json({ success: true });
});

// REAL-TIME SOCKET.IO MESSAGING
io.on('connection', (socket) => {
  socket.on('joinChannel', async (channel) => {
    socket.join(channel);
    const messages = await Message.find({ channel }).sort({ timestamp: 1 }).limit(50);
    socket.emit('loadMessages', messages);
  });

  socket.on('sendMessage', async (data) => {
    const newMessage = new Message(data);
    await newMessage.save();
    io.to(data.channel).emit('newMessage', newMessage);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`ORBIT server running on port ${PORT}`));