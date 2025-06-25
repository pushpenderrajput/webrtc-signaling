const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public")); // serve HTML/JS

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (room) => {
    socket.join(room);
    const count = io.sockets.adapter.rooms.get(room)?.size || 0;
    if (count === 2) {
      io.to(room).emit("ready"); // Both joined
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
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
