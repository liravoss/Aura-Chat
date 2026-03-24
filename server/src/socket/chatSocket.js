// server/src/socket/chatSocket.js
const Message = require('../models/Message');
const User = require('../models/User');
const { translateText } = require('../services/translator');

module.exports = function (io) {
  io.on('connection', (socket) => {
    console.log('socket connected', socket.id);

    // join: { roomId, userId }
    socket.on('join', async ({ roomId, userId }) => {
      try {
        if (!roomId || !userId) return;

        // Prevent duplicate joins on reconnect
        const rooms = Array.from(socket.rooms);
        if (rooms.includes(roomId)) return;

        socket.join(roomId);
        socket.data.userId = userId;
        socket.data.roomId = roomId;

        const user = await User.findById(userId).lean();
        if (!user) return;

        socket.data.language = (user.language || 'en').toLowerCase();
        socket.data.username = user.username;
        socket.data.avatar = user.avatarUrl;

        console.log(`[join] ${user.username} joined ${roomId} lang=${socket.data.language}`);

        // Notify others
        socket.to(roomId).emit('user-joined', {
          userId,
          username: user.username,
          avatar: user.avatarUrl
        });

        // ── SEND LAST 50 MESSAGES TO THE JOINER ──
        const history = await Message.find({ room: roomId })
          .sort({ createdAt: 1 })
          .limit(50)
          .lean();

        for (const msg of history) {
          const targetLang = socket.data.language;
          let translated = msg.originalText;

          if (targetLang !== msg.originalLanguage) {
            try {
              translated = await translateText(msg.originalText, msg.originalLanguage, targetLang);
            } catch (e) {
              console.error('[history translate] error', e?.message);
            }
          }

          socket.emit('message', {
            id: msg._id,
            roomId,
            senderId: msg.senderId,
            senderName: msg.senderName,
            originalLanguage: msg.originalLanguage,
            text: translated,
            originalText: msg.originalText,
            createdAt: msg.createdAt,
            targetLanguage: targetLang
          });
        }

      } catch (e) {
        console.error('join error', e);
      }
    });

    // message: { roomId, text }
    socket.on('message', async ({ roomId, text }) => {
      try {
        const senderId = socket.data.userId;
        if (!senderId || !roomId || !text) {
          console.warn('[message] missing senderId/roomId/text');
          return;
        }

        const sender = await User.findById(senderId).lean();
        const originalLang = (sender.language || 'en').toLowerCase();

        // Persist to MongoDB
        const msg = await Message.create({
          room: roomId,
          senderId,
          senderName: sender.username,
          originalLanguage: originalLang,
          originalText: text
        });

        console.log(`[message] saved ${msg._id} from ${sender.username}`);

        // Deliver translated to each recipient
        const clients = await io.in(roomId).fetchSockets();
        for (const s of clients) {
          const targetLang = (s.data.language || 'en').toLowerCase();
          let translated = text;

          if (targetLang !== originalLang) {
            try {
              translated = await translateText(text, originalLang, targetLang);
            } catch (e) {
              console.error('[translate] error', e?.message);
            }
          }

          s.emit('message', {
            id: msg._id,
            roomId,
            senderId,
            senderName: sender.username,
            avatar: sender.avatarUrl,
            originalLanguage: originalLang,
            text: translated,
            originalText: text,
            createdAt: msg.createdAt,
            targetLanguage: targetLang
          });
        }

      } catch (e) {
        console.error('message handler error', e);
      }
    });

    // ── NOTIFY ROOM ON DISCONNECT ──
    socket.on('disconnect', () => {
      const { roomId, userId, username } = socket.data;
      console.log('socket disconnected', socket.id);
      if (roomId && userId) {
        socket.to(roomId).emit('user-left', { userId, username });
      }
    });
  });
};