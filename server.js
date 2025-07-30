const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log('✅ Connected:', socket.id);

  socket.on('join-room', (roomId) => {
  socket.join(roomId);
  console.log(`[🚪] ${socket.id} joined room ${roomId}`);

  const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
  const otherClients = clients.filter(id => id !== socket.id);

  if (otherClients.length > 0) {
    const peerID = otherClients[0]; // first connected peer
    console.log(`[🤝] Room already has peer ${peerID}, notifying both parties`);

    // Let the new user know there's a peer to connect to
    socket.emit('existing-peer', peerID);

    // Let the existing user know a new peer joined
    io.to(peerID).emit('peer-joined', socket.id);
  }
});


  socket.on('signal', ({ to, from, data }) => {
    console.log(`[📡] Signal from ${from} to ${to}`);
    io.to(to).emit('signal', { from, data });
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
