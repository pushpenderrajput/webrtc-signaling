const socket = io("https://webrtcsignaling.duckdns.org"); // ✅ Replace with your domain

let localStream;
let remoteStream = new MediaStream();
let peerConnection;
let room;

const roomInput = document.getElementById("roomInput");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:<your-turn-ip-or-domain>:3478",
      username: "webrtcuser",
      credential: "strongpassword"
    }
  ]
};

async function joinRoom() {
  room = roomInput.value.trim();
  if (!room) return;

  console.log("Joining room", room);
  socket.emit("join", room);

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
  } catch (err) {
    console.error("Media access error:", err);
    return;
  }

  createPeerConnection();

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });
}

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config);

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("ice-candidate", { room, candidate: event.candidate });
    }
  };

  peerConnection.ontrack = event => {
    console.log("Received track", event.streams);
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.oniceconnectionstatechange = () => {
    console.log("ICE connection state:", peerConnection.iceConnectionState);
  };
}

socket.on("ready", async () => {
  console.log("Both joined. Creating offer...");
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("offer", { room, sdp: offer });
});

socket.on("offer", async (offer) => {
  console.log("Received offer");
  if (!peerConnection) {
    createPeerConnection();
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answer", { room, sdp: answer });
});

socket.on("answer", async (answer) => {
  console.log("Received answer");
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("ice-candidate", (candidate) => {
  console.log("Adding ICE candidate", candidate);
  peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});
