const socket = io("https://webrtcsignaling.duckdns.org"); // Replace with your domain

let localStream;
let remoteStream = new MediaStream();
let peerConnection;
let room;

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    // Optional: Add TURN here
  ]
};

async function joinRoom() {
  room = document.getElementById("roomInput").value.trim();
  if (!room) return alert("Enter room ID");

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
    event.streams[0].getTracks().forEach(track => {
      remoteStream.addTrack(track);
    });
  };
}

socket.on("ready", async () => {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("offer", { room, sdp: offer });
});

socket.on("offer", async (offer) => {
  if (!peerConnection) createPeerConnection();

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answer", { room, sdp: answer });
});

socket.on("answer", async (answer) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("ice-candidate", async (candidate) => {
  await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});
