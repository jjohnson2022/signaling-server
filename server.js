const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Set your frontend origin here for production
    methods: ['GET', 'POST'],
  },
});

app.use(cors());

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  socket.on('join-room', roomId => {
    socket.join(roomId);

    const otherUsers = Array.from(io.sockets.adapter.rooms.get(roomId) || []).filter(id => id !== socket.id);

    if (otherUsers.length > 0) {
      const otherUserId = otherUsers[0];
      console.log(`Notifying ${socket.id} about other user: ${otherUserId}`);
      socket.emit('other-user', otherUserId);

      // Also notify the first user that someone joined
      socket.to(otherUserId).emit('user-joined', {
        signal: null,
        callerId: socket.id,
      });
    }

    socket.on('sending-signal', ({ to, signal }) => {
      io.to(to).emit('user-joined', {
        signal,
        callerId: socket.id,
      });
    });

    socket.on('returning-signal', ({ to, signal }) => {
      io.to(to).emit('receiving-returned-signal', {
        signal,
        id: socket.id,
      });
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Signaling server running on port ${PORT}`));
