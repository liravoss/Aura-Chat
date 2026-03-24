require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path'); // <-- needed

const connectDB = require('./src/config/db');
const chatSocket = require('./src/socket/chatSocket');

const User = require('./src/models/User');
const Room = require('./src/models/Room');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
const PORT = process.env.PORT || 4000;

// Connect DB
connectDB(process.env.MONGODB_URI);

// -------------------------------------------------
// ✅ SERVE CLIENT FRONTEND (IMPORTANT)
// -------------------------------------------------
app.use(express.static(path.join(__dirname, "../Client")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../Client/index.html"));
});

// -------------------------------------------------
// API ROUTES
// -------------------------------------------------

// Create user
app.post('/api/users', async (req, res) => {
  try {
    const { username, avatarUrl, language } = req.body;

    if (!username || !language)
      return res.status(400).json({ error: 'username and language required' });

    const user = await User.create({ username, avatarUrl, language });
    res.json(user);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  }
});

// Get rooms
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await Room.find().lean();
    res.json(rooms);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  }
});

// Create room
app.post('/api/rooms', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name)
      return res.status(400).json({ error: 'name required' });

    const room = await Room.create({ name });
    res.json(room);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  }
});

// -------------------------------------------------
// SOCKET.IO SERVER
// -------------------------------------------------
const server = http.createServer(app);
const { Server } = require('socket.io');

const io = new Server(server, {
  cors: { origin: '*' }
});

chatSocket(io);

server.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
