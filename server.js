const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const users = {}; // socketId -> username

io.on("connection", socket => {
  console.log("Connected:", socket.id);

  socket.on("register", (username) => {
    users[username] = socket.id;
    socket.username = username;
    console.log(`${username} registered as ${socket.id}`);
  });

  socket.on("call-user", ({ to }) => {
    const targetSocket = users[to];
    if (targetSocket) {
      io.to(targetSocket).emit("incoming-call", { from: socket.username });
    }
  });

  socket.on("accept-call", ({ from }) => {
    const fromSocket = users[from];
    if (fromSocket) {
      io.to(fromSocket).emit("call-accepted", { by: socket.username });
    }
  });

  socket.on("offer", (data) => {
    io.to(users[data.to]).emit("offer", { from: socket.username, sdp: data.sdp });
  });

  socket.on("answer", (data) => {
    io.to(users[data.to]).emit("answer", { sdp: data.sdp });
  });

  socket.on("ice-candidate", (data) => {
    io.to(users[data.to]).emit("ice-candidate", { candidate: data.candidate });
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      delete users[socket.username];
    }
    console.log("Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port", PORT));
