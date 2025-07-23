const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors'); // ✅ Add this

const app = express();
const server = http.createServer(app);

app.use(cors()); // ✅ Allow cross-origin requests

const io = socketIO(server, {
  cors: {
    origin: '*',   // ✅ This is what fixes your React dev environment
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join', (roomID) => {
    socket.join(roomID);
    socket.to(roomID).emit('peer-joined', socket.id);
  });

  socket.on('signal', ({ to, from, data }) => {
    io.to(to).emit('signal', { from, data });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
