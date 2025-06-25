// server.js
const express = require("express");
const http = require("http");
const socketIO = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files from 'public'
app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log(`New client connected: ${socket.id}`);

  socket.on("join", (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
    const clients = io.sockets.adapter.rooms.get(roomId) || [];
    if (clients.size > 1) {
      io.to(roomId).emit("ready");
    }
  });

  socket.on("offer", (data) => {
    socket.to(data.room).emit("offer", data.sdp);
  });

  socket.on("answer", (data) => {
    socket.to(data.room).emit("answer", data.sdp);
  });

  socket.on("ice-candidate", (data) => {
    socket.to(data.room).emit("ice-candidate", data.candidate);
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
