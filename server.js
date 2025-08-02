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
  console.log('Welcome! server.js socket io has connected...')
  console.log('Running...')
  console.log('✅ Connected:', socket.id);

  socket.on('join-room', (roomId) => {
    const users = roomUsers[roomId] || [];
    const role = users.length === 0 ? 'userA' : 'userB';
    roomUsers[roomId] = [...users, { id: socket.id, role }];

    socket.join(roomId);
    console.log(`[🚪] ${socket.id} joined room ${roomId}`);
    socket.emit('set-role', role); // 👈 sends 'userA' or 'userB'
    console.log('set-role for User has been emitted. ')

    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    console.log(`👥 Current users in room '${roomId}':`, socketsInRoom);

    // const otherClients = clients.filter(id => id !== socket.id);

    // if (otherClients.length > 0) {
    //   const peerID = otherClients[0];
    //   socket.emit('existing-peer', peerID);
    //   console.log("Someone is already here...Emitting existing-peer, peerID ", peerID);
    //   io.to(peerID).emit('peer-joined', socket.id);
    //   console.log("Emitted 'peer-joined' to peerID", peerID);
    // }
  });

  socket.on('signal', ({ to, from, data }) => {
    io.to(to).emit('signal', { from, data });
  });

  socket.on('message', (msg) => {
    console.log(`💬 Message from ${socket.id}:`, msg);
    socket.to(msg.roomId).emit('message', msg);
  });


  socket.on('disconnect', () => {
    console.log('❌ Disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
