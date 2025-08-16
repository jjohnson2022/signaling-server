// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// If you also test locally, add http://localhost:5173 (Vite) here.
app.use(cors({
  origin: ['https://introducingjeffrey.com'],
  methods: ['GET', 'POST'],
  credentials: true
}));

app.get('/', (_req, res) => res.send('Signaling server running ✅'));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['https://introducingjeffrey.com'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// In-memory roster per room
const roomUsers = {};

io.on('connection', (socket) => {
  console.log('✅ Socket connected:', socket.id, ' total:', io.engine.clientsCount);

  // Ping handshake (optional)
  socket.on('ping-server', () => {
    socket.emit('pong-client', { message: 'pong ok' });
  });

  // --- Join / roster updates ---
  socket.on('join-room', ({ roomId, role, name }) => {
    const users = roomUsers[roomId] || [];

    // Enforce single userA/userB
    if (users.find(u => u.role === role)) {
      console.warn(`❌ Role ${role} already taken in room ${roomId}`);
      socket.emit('force-disconnect');
      return;
    }

    socket.join(roomId);

    const user = { id: socket.id, role, name };
    roomUsers[roomId] = [...users.filter(u => u.id !== socket.id), user];

    console.log(`[🚪] ${name} (${socket.id}) joined '${roomId}' as ${role}`);
    io.to(roomId).emit('room-users', roomUsers[roomId]);
  });

  // Clean leave
  socket.on('leave-room', (roomId) => {
    roomUsers[roomId] = (roomUsers[roomId] || []).filter(u => u.id !== socket.id);
    if (!roomUsers[roomId]?.length) delete roomUsers[roomId];
    io.to(roomId).emit('room-users', roomUsers[roomId] || []);
  });

  // Disconnect -> update any rooms
  socket.on('disconnect', () => {
    for (const roomId of Object.keys(roomUsers)) {
      const before = roomUsers[roomId].length;
      roomUsers[roomId] = roomUsers[roomId].filter(u => u.id !== socket.id);
      if (before !== roomUsers[roomId].length) {
        io.to(roomId).emit('room-users', roomUsers[roomId] || []);
      }
      if (!roomUsers[roomId]?.length) delete roomUsers[roomId];
    }
    console.log(`❌ Disconnected: ${socket.id}`);
  });

  // --- WebRTC signaling: SINGLE, CONSISTENT EVENT NAME ---
  socket.on('webrtc-signal', ({ to, data }) => {
    const kind = data?.type || (data?.candidate ? 'candidate' : 'unknown');
    console.log(`↔️ signal ${kind} ${socket.id} -> ${to}`);
    io.to(to).emit('webrtc-signal', { from: socket.id, data });
  });

  // (Optional admin) Force-eject everyone in a room
  socket.on('force-eject', (roomId) => {
    const users = roomUsers[roomId] || [];
    users.forEach(u => io.to(u.id).emit('force-disconnect'));
    delete roomUsers[roomId];
    io.to(roomId).emit('room-users', []);
    console.log(`⚠️ Force ejected all users from '${roomId}'`);
  });

  // (Optional chat/broadcast extras)
  socket.on('message', (msg) => {
    console.log(`💬 Message from ${socket.id} (${msg.from}):`, msg);
    socket.to(msg.roomId).emit('message', msg);
  });

  socket.on('set-language', ({ lang }) => {
    console.log(`🌐 Peer selected language: ${lang}`);
    socket.broadcast.emit('set-language', { lang });
  });
});

// IMPORTANT: Remove any legacy 'signal' handler to avoid confusion
// Do NOT keep: socket.on('signal', ...)

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Signaling server on :${PORT}`));
