const socket = io();
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
      urls: "turn:<YOUR_EC2_IP>:3478",
      username: "webrtcuser",
      credential: "strongpassword"
    }
  ]
};

function log(msg) {
  console.log("[client]", msg);
}

async function joinRoom() {
  room = roomInput.value.trim();
  if (!room) return;

  log(`Joining room: ${room}`);
  socket.emit("join", room);

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
  
  remoteVideo.srcObject = remoteStream;

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
    log("Remote track received");
    event.streams[0].getTracks().forEach(track => {
      remoteStream.addTrack(track);
    });
  };

  peerConnection.oniceconnectionstatechange = () => {
    log("ICE State: " + peerConnection.iceConnectionState);
  };
}

socket.on("ready", async () => {
  log("Creating and sending offer...");
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("offer", { room, sdp: offer });
});

socket.on("offer", async (offer) => {
  if (!peerConnection) {
    createPeerConnection();
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }

  log("Received offer, sending answer...");
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answer", { room, sdp: answer });
});

socket.on("answer", async (answer) => {
  log("Received answer");
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("ice-candidate", (candidate) => {
  log("Adding received ICE candidate");
  peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});
