const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static("public"));

const users = {}; // username -> socketId
const sockets = {}; // socketId -> username

io.on("connection", socket => {
  console.log("New connection:", socket.id);

  socket.on("register", (username, callback) => {
    try {
      if (!username || username.trim() === "") {
        return callback({ success: false, error: "Username cannot be empty" });
      }

      if (users[username]) {
        return callback({ success: false, error: "Username already taken" });
      }

      users[username] = socket.id;
      sockets[socket.id] = username;
      socket.username = username;

      console.log(`${username} registered with socket ID ${socket.id}`);
      callback({ success: true });
    } catch (error) {
      console.error("Registration error:", error);
      callback({ success: false, error: "Registration failed" });
    }
  });

  socket.on("call-user", ({ to }, callback) => {
    try {
      if (!socket.username) {
        return callback({ success: false, error: "You must register first" });
      }

      const targetSocketId = users[to];
      if (!targetSocketId) {
        return callback({ success: false, error: "User not found" });
      }

      io.to(targetSocketId).emit("incoming-call", { 
        from: socket.username,
        date: new Date().toISOString()
      });
      callback({ success: true });
    } catch (error) {
      console.error("Call initiation error:", error);
      callback({ success: false, error: "Call failed to initiate" });
    }
  });

  socket.on("accept-call", ({ from }, callback) => {
    try {
      const fromSocketId = users[from];
      if (!fromSocketId) {
        return callback({ success: false, error: "Caller not found" });
      }

      io.to(fromSocketId).emit("call-accepted", { 
        by: socket.username,
        date: new Date().toISOString()
      });
      callback({ success: true });
    } catch (error) {
      console.error("Call acceptance error:", error);
      callback({ success: false, error: "Call acceptance failed" });
    }
  });

  socket.on("reject-call", ({ from }, callback) => {
    try {
      const fromSocketId = users[from];
      if (fromSocketId) {
        io.to(fromSocketId).emit("call-rejected", { 
          by: socket.username,
          date: new Date().toISOString()
        });
      }
      callback({ success: true });
    } catch (error) {
      console.error("Call rejection error:", error);
      callback({ success: false, error: "Call rejection failed" });
    }
  });

  socket.on("offer", (data, callback) => {
    try {
      const targetSocketId = users[data.to];
      if (targetSocketId) {
        io.to(targetSocketId).emit("offer", { 
          from: socket.username, 
          sdp: data.sdp,
          date: new Date().toISOString()
        });
        callback({ success: true });
      } else {
        callback({ success: false, error: "Recipient not found" });
      }
    } catch (error) {
      console.error("Offer error:", error);
      callback({ success: false, error: "Offer failed" });
    }
  });

  socket.on("answer", (data, callback) => {
    try {
      const targetSocketId = users[data.to];
      if (targetSocketId) {
        io.to(targetSocketId).emit("answer", { 
          sdp: data.sdp,
          date: new Date().toISOString()
        });
        callback({ success: true });
      } else {
        callback({ success: false, error: "Recipient not found" });
      }
    } catch (error) {
      console.error("Answer error:", error);
      callback({ success: false, error: "Answer failed" });
    }
  });

  socket.on("ice-candidate", (data, callback) => {
    try {
      const targetSocketId = users[data.to];
      if (targetSocketId) {
        io.to(targetSocketId).emit("ice-candidate", { 
          candidate: data.candidate,
          date: new Date().toISOString()
        });
        callback({ success: true });
      } else {
        callback({ success: false, error: "Recipient not found" });
      }
    } catch (error) {
      console.error("ICE candidate error:", error);
      callback({ success: false, error: "ICE candidate failed" });
    }
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      delete users[socket.username];
      delete sockets[socket.id];
      console.log(`${socket.username} disconnected`);
    }
    console.log("Socket disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket available at ws://localhost:${PORT}`);
});