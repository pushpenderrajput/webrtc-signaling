const socket = io("https://webrtcsignaling.duckdns.org");

let localStream, remoteStream, pc;
let myUsername, targetUsername;
let isCallActive = false;

const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    // Add your TURN servers here if needed
  ]
};

// UI Elements
const statusElement = document.getElementById("status");
const incomingCallElement = document.getElementById("incoming");
const localVideoElement = document.getElementById("localVideo");
const remoteVideoElement = document.getElementById("remoteVideo");
const registerButton = document.querySelector("button[onclick='register()']");
const callButton = document.querySelector("button[onclick='startCall()']");

async function register() {
  try {
    myUsername = document.getElementById("username").value.trim();
    if (!myUsername) {
      updateStatus("Username cannot be empty", "error");
      return;
    }

    updateStatus("Registering...", "info");
    registerButton.disabled = true;

    await new Promise((resolve, reject) => {
      socket.emit("register", myUsername, (response) => {
        if (response.success) {
          updateStatus(`Registered as ${myUsername}`, "success");
          registerButton.textContent = "Registered";
          setupMedia(); // Get media after registration
          resolve();
        } else {
          updateStatus(`Registration failed: ${response.error}`, "error");
          registerButton.disabled = false;
          reject(response.error);
        }
      });
    });
  } catch (error) {
    console.error("Registration error:", error);
  }
}

async function startCall() {
  try {
    targetUsername = document.getElementById("target").value.trim();
    if (!targetUsername) {
      updateStatus("Please enter a target username", "error");
      return;
    }

    if (!myUsername) {
      updateStatus("Please register first", "error");
      return;
    }

    updateStatus(`Calling ${targetUsername}...`, "info");
    callButton.disabled = true;

    if (!localStream) {
      await setupMedia();
    }

    createPeerConnection();

    socket.emit("call-user", { to: targetUsername }, (response) => {
      if (response.success) {
        updateStatus(`Calling ${targetUsername}...`, "info");
      } else {
        updateStatus(`Call failed: ${response.error}`, "error");
        callButton.disabled = false;
        hangUp();
      }
    });
  } catch (error) {
    console.error("Call initiation error:", error);
    updateStatus(`Call error: ${error.message}`, "error");
    hangUp();
  }
}

function acceptCall(from) {
  try {
    targetUsername = from;
    incomingCallElement.innerHTML = "";
    updateStatus(`Accepted call from ${from}`, "success");

    socket.emit("accept-call", { from }, async (response) => {
      if (response.success) {
        if (!localStream) {
          await setupMedia();
        }

        createPeerConnection();
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream);
        });

        isCallActive = true;
        updateCallUI();
      } else {
        updateStatus(`Call acceptance failed: ${response.error}`, "error");
      }
    });
  } catch (error) {
    console.error("Call acceptance error:", error);
    updateStatus(`Call error: ${error.message}`, "error");
    hangUp();
  }
}

function rejectCall(from) {
  incomingCallElement.innerHTML = "";
  socket.emit("reject-call", { from });
  updateStatus(`Call from ${from} rejected`, "info");
}

function hangUp() {
  if (pc) {
    pc.close();
    pc = null;
  }
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
    localVideoElement.srcObject = null;
  }
  
  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
    remoteStream = null;
    remoteVideoElement.srcObject = null;
  }

  isCallActive = false;
  targetUsername = null;
  updateCallUI();
  updateStatus("Call ended", "info");
}

function updateCallUI() {
  if (isCallActive) {
    callButton.textContent = "End Call";
    callButton.onclick = hangUp;
    callButton.disabled = false;
  } else {
    callButton.textContent = "Call";
    callButton.onclick = startCall;
    callButton.disabled = false;
  }
}

function updateStatus(message, type) {
  statusElement.textContent = message;
  statusElement.className = type;
  console.log(`${type.toUpperCase()}: ${message}`);
}

async function setupMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: true 
    });
    localVideoElement.srcObject = localStream;
  } catch (error) {
    console.error("Media access error:", error);
    updateStatus(`Could not access media devices: ${error.message}`, "error");
    throw error;
  }
}

function createPeerConnection() {
  remoteStream = new MediaStream();
  pc = new RTCPeerConnection(config);

  pc.onicecandidate = (event) => {
    if (event.candidate && targetUsername) {
      socket.emit("ice-candidate", { 
        to: targetUsername, 
        candidate: event.candidate 
      });
    }
  };

  pc.ontrack = (event) => {
    remoteStream.addTrack(event.track);
    remoteVideoElement.srcObject = remoteStream;
  };

  pc.onconnectionstatechange = () => {
    updateStatus(`Connection state: ${pc.connectionState}`, "info");
    if (pc.connectionState === "disconnected" || 
        pc.connectionState === "failed") {
      hangUp();
    }
  };
}

// Socket event handlers
socket.on("incoming-call", ({ from }) => {
  incomingCallElement.innerHTML = `
    <div>
      <p>Incoming call from ${from}</p>
      <button onclick="acceptCall('${from}')">Accept</button>
      <button onclick="rejectCall('${from}')">Reject</button>
    </div>
  `;
  updateStatus(`Incoming call from ${from}`, "info");
});

socket.on("call-accepted", async ({ by }) => {
  try {
    updateStatus(`Call accepted by ${by}`, "success");
    isCallActive = true;
    updateCallUI();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("offer", { to: by, sdp: offer }, (response) => {
      if (!response.success) {
        updateStatus(`Offer failed: ${response.error}`, "error");
        hangUp();
      }
    });
  } catch (error) {
    console.error("Call accepted error:", error);
    updateStatus(`Call error: ${error.message}`, "error");
    hangUp();
  }
});

socket.on("call-rejected", ({ by }) => {
  updateStatus(`Call rejected by ${by}`, "info");
  hangUp();
});

socket.on("offer", async ({ from, sdp }) => {
  try {
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("answer", { to: from, sdp: answer }, (response) => {
      if (!response.success) {
        updateStatus(`Answer failed: ${response.error}`, "error");
        hangUp();
      }
    });
  } catch (error) {
    console.error("Offer handling error:", error);
    updateStatus(`Call error: ${error.message}`, "error");
    hangUp();
  }
});

socket.on("answer", async ({ sdp }) => {
  try {
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  } catch (error) {
    console.error("Answer handling error:", error);
    updateStatus(`Call error: ${error.message}`, "error");
    hangUp();
  }
});

socket.on("ice-candidate", async ({ candidate }) => {
  try {
    if (candidate && pc.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  } catch (error) {
    console.error("ICE candidate error:", error);
  }
});

socket.on("connect_error", (error) => {
  updateStatus(`Connection error: ${error.message}`, "error");
});

socket.on("disconnect", () => {
  updateStatus("Disconnected from server", "error");
  hangUp();
});

// Initialize
updateStatus("Ready to connect", "info");