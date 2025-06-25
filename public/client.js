const socket = io();
let localStream, remoteStream;
let peerConnection;
const roomInput = document.getElementById("roomInput");

const servers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }, // Add your TURN here if needed
  ],
};

function joinRoom() {
  const room = roomInput.value;
  socket.emit("join", room);

  navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    localStream = stream;
    document.getElementById("localVideo").srcObject = stream;

    peerConnection = new RTCPeerConnection(servers);
    peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit("ice-candidate", { room, candidate });
      }
    };

    peerConnection.ontrack = (event) => {
      if (!remoteStream) {
        remoteStream = new MediaStream();
        document.getElementById("remoteVideo").srcObject = remoteStream;
      }
      remoteStream.addTrack(event.track);
    };

    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
  });

  socket.on("ready", async () => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("offer", { room, sdp: offer });
  });

  socket.on("offer", async (offer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("answer", { room, sdp: answer });
  });

  socket.on("answer", async (answer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  });

  socket.on("ice-candidate", (candidate) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  });
}
