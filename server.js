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

// 🧠 Optional: root route test
app.get('/', (req, res) => res.send('Signaling server running'));

io.on('connection', (socket) => {
  console.log('✅ Connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`[🚪] ${socket.id} joined room ${roomId}`);

    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    const otherClients = clients.filter(id => id !== socket.id);

    if (otherClients.length > 0) {
      const peerID = otherClients[0];
      socket.emit('existing-peer', peerID);
      io.to(peerID).emit('peer-joined', socket.id);
    }
  });

  socket.on('signal', ({ to, from, data }) => {
    io.to(to).emit('signal', { from, data });
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
