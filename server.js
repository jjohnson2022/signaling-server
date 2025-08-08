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

app.get('/', (req, res) => {
  res.send('Signaling server running ✅');
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'https://introducingjeffrey.com',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// ✅ Room tracking - Store active users per room
const roomUsers = {};

io.on('connection', (socket) => {
  console.log('✅ Socket connected from server.js:', socket.id);
  console.log('🔢 Total connected sockets:', io.engine.clientsCount);

    // 🔁 PING HANDSHAKE
  socket.on('ping-server', () => {
    socket.emit('pong-client', { message: 'pong ok' });
  });

  socket.on('join-room', ({ roomId, role, name }) => {
  const users = roomUsers[roomId] || [];

  // Prevent duplicate role assignments (only 1 userA, 1 userB)
  const roleTaken = users.find((u) => u.role === role);
  if (roleTaken) {
    socket.emit('force-disconnect');
    return console.warn(`❌ Role ${role} already taken in room ${roomId}`);
  }

  const newUser = { id: socket.id, role, name };
  roomUsers[roomId] = [...users, newUser];

  socket.join(roomId);
  console.log(`[🚪] ${name} (${socket.id}) joined '${roomId}' as ${role}`);

  // Broadcast full user list to everyone in the room
  io.to(roomId).emit('room-users', roomUsers[roomId]);

  const currentSockets = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
  console.log(`👥 Users in room '${roomId}':`, currentSockets);
});


  socket.on('leave-room', (roomId) => {
    
    roomUsers[roomId] = (roomUsers[roomId] || []).filter(u => u.id !== socket.id);

    if (roomUsers[roomId].length === 0) {
      delete roomUsers[roomId];
      console.log(`🧹 Room ${roomId} is now empty and removed`);
    } 

    io.to(roomId).emit('room-users', roomUsers[roomId]);
  
  });

  socket.on('disconnect', () => {
    for (const roomId in roomUsers) {
      roomUsers[roomId] = roomUsers[roomId].filter(u => u.id !== socket.id);
      if (roomUsers[roomId].length === 0) {
        delete roomUsers[roomId];
        console.log(`🧹 Room ${roomId} is now empty and removed`);
      } else {
        io.to(roomId).emit('room-users', roomUsers[roomId]); // 👈 emit here too
      }
    }
    console.log(`❌ Disconnected: ${socket.id}`);
  });

  socket.on('force-eject', (roomId) => {
    localStorage.clear();
    const users = roomUsers[roomId] || [];
    users.forEach(u => io.to(u.id).emit('force-disconnect'));
    delete roomUsers[roomId];
    console.log(`⚠️ Force ejected all users from room '${roomId}'`);

    // 🔁 Tell StartPage to update
    io.to(roomId).emit('room-users', []);
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
