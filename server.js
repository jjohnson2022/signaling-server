const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: 'https://introducingjeffrey.com',
  methods: ['GET', 'POST'],
  credentials: true
}));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'https://introducingjeffrey.com',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// ✅ Room tracking
const roomUsers = {};

// 🧪 Test endpoint
app.get('/', (req, res) => res.send('Signaling server running'));

io.on('connection', (socket) => {
  console.log('✅ Socket connected from server.js:', socket.id);

  socket.on('join-room', (roomId) => {
    const users = roomUsers[roomId] || [];
    const role = users.length === 0 ? 'userA' : 'userB';

    roomUsers[roomId] = [...users, { id: socket.id, role }];
    socket.join(roomId);
    socket.emit('set-role', role);
    console.log(`[🚪] ${socket.id} joined room '${roomId}' as ${role}`);

    const currentSockets = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    console.log(`👥 Current users in room '${roomId}':`, currentSockets);
  });

  socket.on('leave-room', (roomId) => {
    if (roomUsers[roomId]) {
      roomUsers[roomId] = roomUsers[roomId].filter(u => u.id !== socket.id);
      socket.leave(roomId);
      console.log(`[❌] ${socket.id} left room '${roomId}'`);
    }
  });

  socket.on('disconnect', () => {
    for (const roomId in roomUsers) {
      roomUsers[roomId] = roomUsers[roomId].filter(u => u.id !== socket.id);
    }
    console.log(`❌ Disconnected: ${socket.id}`);
  });

  socket.on('signal', ({ to, from, data }) => {
    io.to(to).emit('signal', { from, data });
  });

  socket.on('message', (msg) => {
    console.log(`💬 Message from ${socket.id} (${msg.from}):`, msg);
    socket.to(msg.roomId).emit('message', msg);
  });

  socket.on('set-language', ({ lang }) => {
    console.log(`🌐 Peer selected language: ${lang}`);
    // You can broadcast it to the room if needed
    socket.broadcast.emit('set-language', { lang });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
