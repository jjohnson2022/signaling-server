const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Adjust for production
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`🚪 ${socket.id} joined room: ${roomId}`);

    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    const otherUserId = clients.find(id => id !== socket.id);

    if (otherUserId) {
      console.log(`👥 Notifying both users to start signaling`);

      // Notify the new user of existing peer
      socket.emit('other-user', otherUserId);

      // Notify the existing user that someone joined
      socket.to(otherUserId).emit('user-joined', {
        signal: null,
        callerId: socket.id,
      });
    }

    // Handle incoming signal from caller
    socket.on('sending-signal', ({ to, signal }) => {
      console.log(`📡 ${socket.id} sending signal to ${to}`);
      io.to(to).emit('user-joined', {
        signal,
        callerId: socket.id,
      });
    });

    // Handle returning signal from callee
    socket.on('returning-signal', ({ to, signal }) => {
      console.log(`🔁 ${socket.id} returning signal to ${to}`);
      io.to(to).emit('receiving-returned-signal', {
        signal,
        id: socket.id,
      });
    });
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Signaling server running on port ${PORT}`));
