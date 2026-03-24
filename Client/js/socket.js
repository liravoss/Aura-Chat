// /Client/js/socket.js

console.log("Initializing chat socket...");

// Connect to same-origin Socket.IO server
const socket = io("http://localhost:4000", {
  transports: ["websocket", "polling"]
});

/**
 * Connect to a chat room with a user ID.
 */
function connectSocket(roomId, userId) {
  console.log("Connecting to chat room:", roomId, "as user:", userId);

  socket.emit("join", { roomId, userId });

  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);
  });

  socket.on("disconnect", () => {
    console.warn("Socket disconnected:", socket.id);
  });

  return socket;
}
