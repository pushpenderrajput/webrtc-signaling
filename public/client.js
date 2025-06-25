const socket = io("https://webrtcsignaling.duckdns.org");

let localStream, remoteStream, pc;
let myUsername, targetUsername;

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

function register() {
  myUsername = document.getElementById("username").value.trim();
  socket.emit("register", myUsername);
}

async function startCall() {
  targetUsername = document.getElementById("target").value.trim();
  socket.emit("call-user", { to: targetUsername });
}

socket.on("incoming-call", ({ from }) => {
  document.getElementById("incoming").innerHTML = `
    Incoming call from ${from}
    <button onclick="acceptCall('${from}')">Accept</button>
  `;
});

async function acceptCall(from) {
  targetUsername = from;
  document.getElementById("incoming").innerHTML = "";
  socket.emit("accept-call", { from });

  await setupMedia();
  createPeerConnection();

  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });
}

socket.on("call-accepted", async ({ by }) => {
  await setupMedia();
  createPeerConnection();

  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  socket.emit("offer", { to: by, sdp: offer });
});

socket.on("offer", async ({ from, sdp }) => {
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { to: from, sdp: answer });
});

socket.on("answer", async ({ sdp }) => {
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
});

socket.on("ice-candidate", async ({ candidate }) => {
  if (candidate) {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }
});

function createPeerConnection() {
  remoteStream = new MediaStream();
  pc = new RTCPeerConnection(config);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", { to: targetUsername, candidate: event.candidate });
    }
  };

  pc.ontrack = (event) => {
    remoteStream.addTrack(event.track);
    document.getElementById("remoteVideo").srcObject = remoteStream;
  };
}

async function setupMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.getElementById("localVideo").srcObject = localStream;
}
