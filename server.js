// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Twilio = require('twilio');
const { AccessToken } = Twilio.jwt;
const { VideoGrant } = AccessToken;

const app = express();

// Prefer API Key auth; fallback to Account SID + Auth Token (if you ever set it)
// const twilioClient = process.env.TWILIO_API_KEY_SID
//   ? twilio(
//       process.env.TWILIO_API_KEY_SID,
//       process.env.TWILIO_API_KEY_SECRET,
//       { accountSid: process.env.TWILIO_ACCOUNT_SID }
//     )
//   : twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// If you also test locally, add 'http://localhost:5173'
app.use(cors({
  origin: ['https://introducingjeffrey.com'],
  methods: ['GET', 'POST'],
  credentials: true
}));

app.get('/', (_req, res) => res.send('Signaling server running ✅'));

/** Twilio Video Access Token endpoint */
app.get('/twilio-token', (req, res) => {
const AC = process.env.TWILIO_ACCOUNT_SID;    // must start with AC
  const SK = process.env.TWILIO_API_KEY_SID;    // must start with SK
  const SECRET = process.env.TWILIO_API_KEY_SECRET; // long secret

  if (!AC || !SK || !SECRET) {
    console.error('Missing Twilio env vars', {
      TWILIO_ACCOUNT_SID: !!AC,
      TWILIO_API_KEY_SID: !!SK,
      TWILIO_API_KEY_SECRET: !!SECRET,
    });
    return res.status(500).json({
      error: 'missing_env',
      have: { AC: !!AC, SK: !!SK, SECRET: !!SECRET }
    });
  }

  try {
    const identity = (req.query.identity || 'guest-' + Math.random().toString(36).slice(2,8)).slice(0,64);
    const room = (req.query.room || 'main').slice(0,128);

    const token = new Twilio.jwt.AccessToken(AC, SK, SECRET, { ttl: 3600 });
    token.identity = identity;
    const { VideoGrant } = Twilio.jwt.AccessToken;
    token.addGrant(new VideoGrant({ room }));

    res.json({ token: token.toJwt() });
  } catch (e) {
    console.error('Token mint failed:', e);
    res.status(500).json({ error: 'token_mint_failed', message: e.message });
  }
});

// 🚀 Twilio NTS endpoint — returns ephemeral STUN/TURN for the client
// app.get('/ice', async (_req, res) => {
//   try {
//     const token = await twilioClient.tokens.create({ ttl: 86400 }); // 1 hour
//     const iceServers = token.iceServers || token.ice_servers || [];
//     res.json({ iceServers });
//   } catch (e) {
//     console.error('Failed to fetch Twilio ICE:', e);
//     res.status(500).json({ error: 'ice_fetch_failed' });
//   }
// });

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['https://introducingjeffrey.com'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// In-memory roster per roomId
const roomUsers = {};

io.on('connection', (socket) => {
  console.log('✅ Socket connected:', socket.id, ' total:', io.engine.clientsCount);

  // Optional ping/pong healthcheck
  socket.on('ping-server', () => socket.emit('pong-client', { message: 'pong ok' }));

  // --- Join / roster updates ---
  // NOTE: We DO NOT kick on role clash; we just deny join.
  // If the client provides a callback, we ACK; if not, we also emit a one-off 'join-denied'.
  socket.on('join-room', ({ roomId, role, name }, cb) => {
    const users = roomUsers[roomId] || [];

    if (users.find(u => u.role === role)) {
      cb?.({ ok: false, reason: 'role-taken', role });
      socket.emit('join-denied', { reason: 'role-taken', role });
      // Send the current roster so UI can update
      socket.emit('room-users', users);
      return;
    }

    socket.join(roomId);

    const user = { id: socket.id, role, name };
    roomUsers[roomId] = [...users.filter(u => u.id !== socket.id), user];

    console.log(`[🚪] ${name} (${socket.id}) joined '${roomId}' as ${role}`);
    io.to(roomId).emit('room-users', roomUsers[roomId]); // broadcast to everyone in room
    cb?.({ ok: true });
  });

  // Clean leave (free the seat immediately)
  socket.on('leave-room', (roomId) => {
    if (!roomId) return;
    roomUsers[roomId] = (roomUsers[roomId] || []).filter(u => u.id !== socket.id);
    if (!roomUsers[roomId]?.length) {
      delete roomUsers[roomId];
      console.log(`🧹 Room ${roomId} is now empty and removed`);
    }
    io.to(roomId).emit('room-users', roomUsers[roomId] || []);
  });

  // Disconnect -> remove user from any rooms they were in
  socket.on('disconnect', () => {
    for (const roomId of Object.keys(roomUsers)) {
      const before = roomUsers[roomId].length;
      roomUsers[roomId] = roomUsers[roomId].filter(u => u.id !== socket.id);
      if (before !== roomUsers[roomId].length) {
        io.to(roomId).emit('room-users', roomUsers[roomId] || []);
      }
      if (!roomUsers[roomId]?.length) {
        delete roomUsers[roomId];
        console.log(`🧹 Room ${roomId} is now empty and removed`);
      }
    }
    console.log(`❌ Disconnected: ${socket.id}`);
  });

  // --- WebRTC signaling (single, consistent event name) ---
  socket.on('webrtc-signal', ({ to, data }) => {
    const kind = data?.type || (data?.candidate ? 'candidate' : 'unknown');
    // Optional log: console.log(`↔️ signal ${kind} ${socket.id} -> ${to}`);
    io.to(to).emit('webrtc-signal', { from: socket.id, data });
  });

  // Admin: force-eject everyone in a room (this is the ONLY place we "kick")
  socket.on('force-eject', (roomId) => {
    const users = roomUsers[roomId] || [];
    users.forEach(u => io.to(u.id).emit('force-disconnect'));
    delete roomUsers[roomId];
    io.to(roomId).emit('room-users', []);
    console.log(`⚠️ Force ejected all users from '${roomId}'`);
  });

  // Optional extras
  socket.on('message', (msg) => {
    socket.to(msg.roomId).emit('message', msg);
  });

  socket.on('set-language', ({ lang }) => {
    socket.broadcast.emit('set-language', { lang });
  });
});

// IMPORTANT: Do NOT keep a legacy 'signal' handler. Use 'webrtc-signal' only.
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Signaling server on :${PORT}`));
