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
        socket.join(roomId);
        socket.data.userId = userId;
        const user = await User.findById(userId).lean();
        socket.data.language = (user?.language || 'en').toLowerCase();
        console.log(`[socket] ${socket.id} joined ${roomId} as ${user?.username} lang=${socket.data.language}`);
        socket.to(roomId).emit('user-joined', { userId, username: user?.username, avatar: user?.avatarUrl });
      } catch (e) {
        console.error('join error', e);
      }
    });

    // message: { roomId, text }
    socket.on('message', async ({ roomId, text }) => {
      try {
        const senderId = socket.data.userId;
        if (!senderId || !roomId || !text) {
          console.warn('[message] missing senderId/roomId/text', { senderId, roomId, text: !!text });
          return;
        }

        const sender = await User.findById(senderId).lean();
        const originalLang = (sender.language || 'en').toLowerCase();

        // Persist the original message
        const msg = await Message.create({
          room: roomId,
          senderId,
          senderName: sender.username,
          originalLanguage: originalLang,
          originalText: text
        });

        console.log(`[message] saved msg ${msg._id} from ${sender.username} lang=${originalLang} text="${text.slice(0,50)}"`);

        // Get all sockets in room
        const clients = await io.in(roomId).fetchSockets();
        for (const s of clients) {
          const targetLang = (s.data.language || 'en').toLowerCase();

          let translated = text;
          let didTranslate = false;

          if (targetLang && targetLang !== originalLang) {
            try {
              translated = await translateText(text, originalLang, targetLang);
              didTranslate = true;
            } catch (e) {
              console.error('[translate per-recipient] error', e?.message || e);
            }
          }

          console.log(`[deliver] to socket ${s.id} targetLang=${targetLang} translated=${didTranslate} preview="${translated.slice(0,60)}"`);

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

    socket.on('disconnect', () => {
      console.log('socket disconnected', socket.id);
    });
  });
};
