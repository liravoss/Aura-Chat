// /Client/js/socket.js
console.log("Initializing chat socket...");

const socket = io({
  transports: ["websocket", "polling"]
});

function connectSocket(roomId, userId) {
  console.log("Connecting to chat room:", roomId, "as user:", userId);

  // Join on first connect
  socket.emit("join", { roomId, userId });

  // Re-join automatically if socket reconnects (e.g. Render wakes up)
  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);
    socket.emit("join", { roomId, userId });
  });

  socket.on("disconnect", () => {
    console.warn("Socket disconnected.");
  });

  return socket;
}