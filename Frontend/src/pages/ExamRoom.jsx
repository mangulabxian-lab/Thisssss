import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { io } from "socket.io-client";
import { FaVideo, FaVideoSlash, FaMicrophone, FaMicrophoneSlash, FaUser, FaComment, FaExclamationTriangle, FaEye } from "react-icons/fa";
import StudentExamCamera from '../components/StudentExamCamera';

// Face detection hook
const useFaceDetection = (videoRef, isStudent, isEnabled = true) => {
  const [faceData, setFaceData] = useState({
    faceDetected: true,
    faceCount: 0,
    isLookingAway: false,
    suspiciousActivities: []
  });
  const [serverStatus, setServerStatus] = useState('checking');

  useEffect(() => {
    const checkServer = async () => {
      try {
        const response = await fetch('http://localhost:5000/health');
        if (response.ok) {
          setServerStatus('connected');
        } else {
          setServerStatus('error');
        }
      } catch (error) {
        setServerStatus('error');
      }
    };
    checkServer();
  }, []);

  useEffect(() => {
    if (!isStudent || !isEnabled || !videoRef.current || serverStatus !== 'connected') return;

    const captureAndDetect = async () => {
      try {
        const video = videoRef.current;
        if (!video || video.readyState !== 4) return;

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        
        const response = await fetch('http://localhost:5000/detect-faces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageData })
        });
        
        if (response.ok) {
          const result = await response.json();
          setFaceData({
            faceDetected: result.faceDetected,
            faceCount: result.faceCount,
            isLookingAway: result.isLookingAway,
            suspiciousActivities: result.suspiciousActivities || []
          });
        }
      } catch (error) {
        console.log('Face detection temporarily unavailable');
      }
    };

    const interval = setInterval(captureAndDetect, 3000);
    return () => clearInterval(interval);
  }, [isStudent, isEnabled, serverStatus]);

  return { ...faceData, serverStatus };
};

export default function ExamRoom({ roomId }) {
  const location = useLocation();
  const { 
    teacherName = "Teacher", 
    teacherId, 
    classSubject = "Subject",
    studentName = "Student",
    studentId,
    className = "Class"
  } = location.state || {};

  const isTeacher = !!teacherId;
  const currentUserName = isTeacher ? teacherName : studentName;
  const currentUserId = isTeacher ? teacherId : studentId;

  const localVideoRef = useRef();
  const [peerStreams, setPeerStreams] = useState({});
  const [peerInfo, setPeerInfo] = useState({});
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [timer, setTimer] = useState(0);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const examDuration = 30 * 60;
  const socketRef = useRef();
  const localStreamRef = useRef();
  const peersRef = useRef({});
  const makingOfferRef = useRef(false);
  const isInitializedRef = useRef(false);

  // Face detection for student
  const {
    faceDetected,
    faceCount,
    isLookingAway,
    suspiciousActivities,
    serverStatus
  } = useFaceDetection(localVideoRef, !isTeacher, camOn);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => setTimer(prev => (prev < examDuration ? prev + 1 : prev)), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Cleanup function
  const cleanup = () => {
    console.log("🧹 Cleaning up connections...");
    
    // Detach video element
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const tracks = localVideoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      localVideoRef.current.srcObject = null;
    }
    
    Object.values(peersRef.current).forEach(pc => {
      if (pc && typeof pc.close === 'function') {
        pc.close();
      }
    });
    peersRef.current = {};
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      localStreamRef.current = null;
    }
    
    setPeerStreams({});
    setPeerInfo({});
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    isInitializedRef.current = false;
  };

  // Function to update peer media status
  const updatePeerMediaStatus = (peerId, cameraEnabled, microphoneEnabled) => {
    setPeerInfo(prev => ({
      ...prev,
      [peerId]: {
        ...prev[peerId],
        camOn: cameraEnabled,
        micOn: microphoneEnabled
      }
    }));

    if (!cameraEnabled) {
      setPeerStreams(prev => ({
        ...prev,
        [peerId]: null
      }));
    }
  };

  // Function to broadcast local media status
  const broadcastMediaStatus = () => {
    if (socketRef.current) {
      socketRef.current.emit("media-status", {
        roomId,
        camOn,
        micOn
      });
    }
  };

  // Function to broadcast proctoring alerts to teacher
  const broadcastProctoringAlert = (alert) => {
    if (socketRef.current && !isTeacher) {
      socketRef.current.emit("proctoring-alert", {
        roomId,
        studentId: currentUserId,
        studentName: currentUserName,
        alert,
        timestamp: new Date().toISOString()
      });
    }
  };

  // Send proctoring alerts when suspicious activities are detected
  useEffect(() => {
    if (!isTeacher && suspiciousActivities.length > 0) {
      suspiciousActivities.forEach(activity => {
        broadcastProctoringAlert(activity);
      });
    }
  }, [suspiciousActivities, isTeacher]);

  // Socket & WebRTC
  useEffect(() => {
    if (isInitializedRef.current) {
      return;
    }
    isInitializedRef.current = true;

    console.log("🎯 Initializing Exam Room...");
    socketRef.current = io("http://localhost:3000");

    const initMediaStream = async () => {
      try {
        console.log("🎥 Attempting to get camera access for Live Class...");
        
        // Stop any existing stream first
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
          localStreamRef.current = null;
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          }, 
          audio: true 
        }).catch(err => {
          console.error("❌ Camera access error:", err);
          alert(`🎥 Camera Error: ${err.message}. Please refresh and allow camera access.`);
          return null;
        });
        
        if (!stream) return;
        
        console.log("✅ Camera accessed successfully for Live Class");
        localStreamRef.current = stream;
        
        // Force video element update
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.onloadeddata = () => {
            console.log("✅ Video loaded for Live Class");
            localVideoRef.current.play().catch(e => console.warn("Play warning:", e));
          };
        }

        socketRef.current.emit("join-room", { 
          roomId, 
          name: currentUserName, 
          id: currentUserId,
          isTeacher: isTeacher 
        });

        setTimeout(() => {
          broadcastMediaStatus();
        }, 1000);

      } catch (error) {
        console.error("❌ Error accessing media devices:", error);
        alert("Camera and microphone access is required for the Live Class exam.");
      }
    };

    // Only auto-init for teachers
    if (isTeacher) {
      initMediaStream();
    } else {
      // For students, just join the socket room - camera will be handled by StudentExamCamera
      socketRef.current.emit("join-room", { 
        roomId, 
        name: currentUserName, 
        id: currentUserId,
        isTeacher: false 
      });
    }

    // Socket event handlers
    socketRef.current.on("room-participants", (participants) => {
      participants.forEach(participant => {
        if (participant.id === socketRef.current.id) {
          return;
        }
        
        if (!peersRef.current[participant.id]) {
          createPeerConnection(participant);
        }
      });
    });

    socketRef.current.on("user-joined", (user) => {
      if (user.id !== socketRef.current.id && !peersRef.current[user.id]) {
        createPeerConnection(user);
        
        setTimeout(() => {
          broadcastMediaStatus();
        }, 500);
      }
    });

    socketRef.current.on("offer", async ({ from, sdp, name, isTeacher: offerIsTeacher }) => {
      if (peersRef.current[from]) {
        return;
      }
      
      const pc = createPeerConnection({ id: from, name, isTeacher: offerIsTeacher });
      
      try {
        makingOfferRef.current = true;
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        socketRef.current.emit("answer", { 
          target: from, 
          sdp: pc.localDescription,
          name: currentUserName,
          isTeacher: isTeacher
        });
      } catch (error) {
        console.error("Error handling offer:", error);
      } finally {
        makingOfferRef.current = false;
      }
    });

    socketRef.current.on("answer", async ({ from, sdp, name, isTeacher: answerIsTeacher }) => {
      const pc = peersRef.current[from];
      
      if (!pc) {
        return;
      }
      
      if (pc.signalingState !== "stable") {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        } catch (error) {
          console.error("Error setting remote description:", error);
        }
      }
    });

    socketRef.current.on("ice-candidate", async ({ from, candidate }) => {
      const pc = peersRef.current[from];
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }
    });

    socketRef.current.on("user-left", (userId) => {
      removePeerConnection(userId);
    });

    socketRef.current.on("media-status-update", ({ userId, camOn: remoteCamOn, micOn: remoteMicOn, name, isTeacher }) => {
      updatePeerMediaStatus(userId, remoteCamOn, remoteMicOn);
    });

    socketRef.current.on("proctoring-alert", ({ studentName, alert, timestamp }) => {
      if (isTeacher) {
        setMessages(prev => [...prev, {
          id: Date.now(),
          text: `🚨 PROCTORING ALERT: ${studentName} - ${alert}`,
          sender: "System",
          isTeacher: false,
          isAlert: true
        }]);
      }
    });

    socketRef.current.on("disconnect", () => {
      console.log("🔌 Socket disconnected");
    });

    socketRef.current.on("receive-message", ({ name, message, isTeacher: senderIsTeacher }) => {
      setMessages(prev => [...prev, { 
        id: Date.now(), 
        text: message, 
        sender: name,
        isTeacher: senderIsTeacher 
      }]);
    });

    return () => {
      console.log("🛑 Component unmounting, cleaning up...");
      cleanup();
    };
  }, [roomId, currentUserName, currentUserId, isTeacher]);

  // Function to remove peer connection
  const removePeerConnection = (peerId) => {
    if (peersRef.current[peerId]) {
      peersRef.current[peerId].close();
      delete peersRef.current[peerId];
    }
    
    setPeerStreams(prev => {
      const updated = { ...prev };
      delete updated[peerId];
      return updated;
    });
    
    setPeerInfo(prev => {
      const updated = { ...prev };
      delete updated[peerId];
      return updated;
    });
  };

  const createPeerConnection = (peerData) => {
    if (peersRef.current[peerData.id]) {
      return peersRef.current[peerData.id];
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.ontrack = (event) => {
      const shouldShowStream = peerInfo[peerData.id]?.camOn !== false;
      
      setPeerStreams(prev => ({
        ...prev,
        [peerData.id]: shouldShowStream ? event.streams[0] : null
      }));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("ice-candidate", {
          target: peerData.id,
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        removePeerConnection(peerData.id);
      }
    };

    peersRef.current[peerData.id] = pc;

    setPeerInfo(prev => ({
      ...prev,
      [peerData.id]: {
        name: peerData.name,
        isOwner: isTeacher && peerData.id === teacherId,
        isTeacher: peerData.isTeacher,
        camOn: true,
        micOn: true
      }
    }));

    if (localStreamRef.current) {
      createOffer(pc, peerData);
    }

    return pc;
  };

  const createOffer = async (pc, peerData) => {
    try {
      makingOfferRef.current = true;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socketRef.current.emit("offer", {
        target: peerData.id,
        sdp: pc.localDescription,
        name: currentUserName,
        isTeacher: isTeacher
      });
    } catch (error) {
      console.error("Error creating offer:", error);
    } finally {
      makingOfferRef.current = false;
    }
  };

  const toggleCam = () => {
    const newState = !camOn;
    setCamOn(newState);
    broadcastMediaStatus();
    console.log(`✅ Camera toggled ${newState ? 'ON' : 'OFF'}`);
  };

  const toggleMic = () => {
    if (!localStreamRef.current) return;
    
    const audioTracks = localStreamRef.current.getAudioTracks();
    if (audioTracks.length > 0) {
      const newMicState = !micOn;
      audioTracks[0].enabled = newMicState;
      setMicOn(newMicState);
      broadcastMediaStatus();
    }
  };

  const sendMessage = () => {
    if (!messageInput.trim()) return;
    
    socketRef.current.emit("send-message", { 
      roomId, 
      message: messageInput,
      name: currentUserName,
      isTeacher: isTeacher
    });
    
    setMessageInput("");
  };

  // STUDENT VIEW
  if (!isTeacher) {
    return (
      <div style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#f8f9fa",
        position: "relative"
      }}>
        {/* Top Bar - Subject Name & Timer */}
        <div style={{
          padding: "15px 20px",
          background: "white",
          borderBottom: "1px solid #e0e0e0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <div style={{
              background: "#4285f4",
              color: "white",
              padding: "8px 16px",
              borderRadius: "6px",
              fontWeight: "bold",
              fontSize: "16px"
            }}>
              {className}
            </div>
            <div style={{
              background: "#f8f9fa",
              border: "1px solid #dadce0",
              borderRadius: "4px",
              padding: "8px 16px",
              fontWeight: "bold",
              color: "#5f6368",
              fontSize: "16px"
            }}>
               {formatTime(examDuration - timer)}
            </div>
          </div>
          <div style={{ fontWeight: "bold", color: "#5f6368" }}>
            {currentUserName}
          </div>
        </div>

        {/* Main Content - Exam Form */}
        <div style={{ 
          flex: 1, 
          display: "flex",
          position: "relative",
          overflow: "hidden"
        }}>
          {/* Exam Form - Takes most space */}
          <div style={{
            flex: 1,
            padding: "20px",
            overflow: "auto"
          }}>
            <iframe
              src={`/exam/form/${roomId.replace('exam-', '')}`}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(116, 0, 0, 0.1)"
              }}
              title="Exam Form"
            />
          </div>

          {/* Right Sidebar - Proctoring Alerts */}
          <div style={{
            width: "300px",
            background: "white",
            borderLeft: "1px solid #e0e0e0",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "15px"
          }}>
            <h3 style={{ 
              margin: "0 0 10px 0", 
              color: "#202124",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              <FaExclamationTriangle color="#4285f4" />
              Proctoring Monitor
              {serverStatus === 'error' && (
                <span style={{ fontSize: "12px", color: "orange", marginLeft: "auto" }}>
                  (Offline)
                </span>
              )}
            </h3>

            {serverStatus === 'connected' ? (
              <>
                {/* Status Summary */}
                <div style={{
                  background: suspiciousActivities.length > 0 ? "#ffebee" : "#e8f5e8",
                  border: `2px solid ${suspiciousActivities.length > 0 ? "#f44336" : "#4caf50"}`,
                  borderRadius: "8px",
                  padding: "15px",
                  textAlign: "center"
                }}>
                  <div style={{ 
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: suspiciousActivities.length > 0 ? "#d32f2f" : "#2e7d32",
                    marginBottom: "8px"
                  }}>
                    {suspiciousActivities.length > 0 ? "🚨 ATTENTION REQUIRED" : "✅ ALL GOOD"}
                  </div>
                  <div style={{ fontSize: "12px", color: "#666" }}>
                    {suspiciousActivities.length > 0 ? 
                      "Proctoring alerts detected" : 
                      "Normal activity detected"
                    }
                  </div>
                </div>

                {/* Detailed Metrics */}
                <div style={{
                  background: "#f8f9fa",
                  borderRadius: "8px",
                  padding: "15px"
                }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#5f6368" }}>
                    Monitoring Metrics
                  </h4>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                      <span>Faces Detected:</span>
                      <span style={{ 
                        fontWeight: "bold",
                        color: faceCount === 1 ? "#4caf50" : "#f44336"
                      }}>
                        {faceCount}
                      </span>
                    </div>
                    
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                      <span>Gaze Direction:</span>
                      <span style={{ 
                        fontWeight: "bold",
                        color: !isLookingAway ? "#4caf50" : "#ff9800"
                      }}>
                        {isLookingAway ? "Looking Away" : "Focused"}
                      </span>
                    </div>
                    
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                      <span>Face Detection:</span>
                      <span style={{ 
                        fontWeight: "bold",
                        color: faceDetected ? "#4caf50" : "#f44336"
                      }}>
                        {faceDetected ? "✅" : "❌"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Suspicious Activities List */}
                {suspiciousActivities.length > 0 && (
                  <div style={{
                    background: "#fff3e0",
                    border: "1px solid #ffb74d",
                    borderRadius: "8px",
                    padding: "15px"
                  }}>
                    <h4 style={{ 
                      margin: "0 0 10px 0", 
                      fontSize: "14px", 
                      color: "#e65100",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px"
                    }}>
                      ⚠️ Alerts
                    </h4>
                    <div style={{ fontSize: "12px", color: "#e65100" }}>
                      {suspiciousActivities.map((activity, index) => (
                        <div key={index} style={{ marginBottom: "5px" }}>
                          • {activity}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{
                background: "#fff3e0",
                borderRadius: "8px",
                padding: "20px",
                textAlign: "center",
                color: "#e65100"
              }}>
                <div style={{ fontSize: "48px", marginBottom: "10px" }}>🔧</div>
                <div style={{ fontSize: "14px", fontWeight: "bold" }}>
                  Proctoring System Offline
                </div>
                <div style={{ fontSize: "12px", marginTop: "5px" }}>
                  Continue with your exam
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bar - Camera Feed & Controls - FIXED */}
        <div style={{
          background: "white",
          borderTop: "1px solid #e0e0e0",
          padding: "15px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 -2px 8px rgba(0,0,0,0.1)"
        }}>
          {/* Camera Feed - FIXED */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "15px"
          }}>
            <div style={{
              width: "160px",
              height: "120px",
              border: "3px solid #4285f4",
              borderRadius: "10px",
              overflow: "hidden",
              background: "#000",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
            }}>
              <StudentExamCamera 
                examId={roomId}
                isRequired={true}
              />
            </div>
            
            <div style={{ fontSize: "14px", color: "#5f6368" }}>
              <div style={{ fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px", fontSize: "16px" }}>
                <FaVideo style={{ color: "#4285f4" }} /> 
                Live Proctoring Camera
              </div>
              <div style={{ fontSize: "13px", marginTop: "6px" }}>
                ✅ Camera monitoring active
              </div>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: "12px" }}>
            <button 
              onClick={toggleCam}
              style={{ 
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 18px",
                border: "2px solid",
                borderColor: camOn ? "#4caf50" : "#f44336",
                borderRadius: "8px",
                background: "white",
                color: camOn ? "#4caf50" : "#f44336",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "bold",
                transition: "all 0.2s"
              }}
            >
              {camOn ? <FaVideo size={16} /> : <FaVideoSlash size={16} />}
              Camera {camOn ? "On" : "Off"}
            </button>
            
            <button 
              onClick={toggleMic}
              style={{ 
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 18px",
                border: "2px solid",
                borderColor: micOn ? "#4caf50" : "#f44336",
                borderRadius: "8px",
                background: "white",
                color: micOn ? "#4caf50" : "#f44336",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "bold",
                transition: "all 0.2s"
              }}
            >
              {micOn ? <FaMicrophone size={16} /> : <FaMicrophoneSlash size={16} />}
              Mic {micOn ? "On" : "Off"}
            </button>

            {/* Chat Toggle */}
            <button
              onClick={() => setMessagesOpen(!messagesOpen)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 18px",
                border: "2px solid #4285f4",
                borderRadius: "8px",
                background: "#4285f4",
                color: "white",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "bold"
              }}
            >
              <FaComment size={16} />
              Chat
            </button>
          </div>
        </div>

        {/* Chat Panel */}
        {messagesOpen && (
          <div style={{
            position: "fixed",
            bottom: "160px",
            right: "20px",
            width: "320px",
            height: "400px",
            background: "white",
            border: "2px solid #4285f4",
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            zIndex: 1000,
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)"
          }}>
            <div style={{  
              background: "#4285f4",
              color: "white",
              padding: "15px",
              borderBottom: "1px solid #ccc",
              fontWeight: "bold",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderRadius: "10px 10px 0 0",
              fontSize: "16px"
            }}>
              <span>💬 Live Class Chat</span>
              <button
                onClick={() => setMessagesOpen(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "18px",
                  fontWeight: "bold"
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ 
              flex: 1,
              padding: "15px",
              overflowY: "auto",
              fontSize: "14px",
              background: "#fafafa"
            }}>
              {messages.length === 0 ? (
                <div style={{ 
                  color: "#888", 
                  textAlign: "center", 
                  marginTop: "40px",
                  fontStyle: "italic"
                }}>
                  <div style={{ fontSize: "48px", marginBottom: "10px" }}>💬</div>
                  No messages yet
                  <div style={{ fontSize: "12px", marginTop: "5px" }}>Start a conversation with your teacher</div>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} style={{ 
                    marginBottom: "10px",
                    padding: "10px",
                    background: msg.isAlert ? "#ffebee" : "white",
                    borderRadius: "8px",
                    borderLeft: msg.isAlert ? "4px solid #f44336" : "4px solid #4285f4",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                  }}>
                    <strong style={{ 
                      color: msg.isAlert ? "#f44336" : "#4285f4",
                      fontSize: "13px",
                      display: "block",
                      marginBottom: "4px"
                    }}>
                      {msg.sender}:
                    </strong> 
                    <div style={{ fontSize: "14px", color: "#333" }}>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: "flex", borderTop: "1px solid #e0e0e0", padding: "10px" }}>
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type your message to teacher..."
                style={{
                  flex: 1,
                  padding: "12px 15px",
                  border: "1px solid #dadce0",
                  borderRadius: "8px 0 0 8px",
                  outline: "none",
                  fontSize: "14px"
                }}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <button
                onClick={sendMessage}
                style={{
                  padding: "0 20px",
                  border: "none",
                  background: "#4285f4",
                  color: "white",
                  cursor: "pointer",
                  borderRadius: "0 8px 8px 0",
                  fontSize: "14px",
                  fontWeight: "bold"
                }}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // TEACHER VIEW (Original layout)
  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      background: `linear-gradient(
        90deg,
        #7E7E7E 0%,
        #FFFFFF 8%,
        #887575 71%,
        #BF3F3F 100%,
        #FF0000 100%
      )`
    }}>
      {/* Top Bar */}
      <div style={{
        padding: "10px",
        borderBottom: "1px solid gray",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "rgba(255, 255, 255, 0.2)"
      }}>
        <h2 style={{ color: "#fff7f7ff", textShadow: "1px 1px 3px rgba(0, 0, 0, 1)" }}>
          {classSubject} - Teacher View
        </h2>
        <div style={{ fontWeight: "bold", color: "#fff" }}>
          Timer: {formatTime(examDuration - timer)}
        </div>
      </div>

      {/* Video Grid */}
      <div style={{ 
        flex: 1, 
        display: "flex", 
        flexWrap: "wrap", 
        padding: "20px", 
        gap: "10px",
        justifyContent: "center",
        alignItems: "center"
      }}>
        {/* Local Video */}
        <div style={{ 
          position: "relative", 
          flexBasis: "calc(50% - 200px)", 
          height: "350px", 
          border: "2px solid #4caf50", 
          borderRadius: "8px", 
          overflow: "hidden",
          minWidth: "400px"
        }}>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{ 
              width: "100%", 
              height: "100%", 
              objectFit: "cover",
              transform: "scaleX(-1)",
              display: camOn ? "block" : "none"
            }}
          />
          {!camOn && (
            <div style={{
              position: "absolute",
              top: 0, left: 0, width: "100%", height: "100%",
              display: "flex", justifyContent: "center", alignItems: "center",
              fontSize: "60px", color: "#fff", backgroundColor: "#999"
            }}>
              <FaUser />
            </div>
          )}
          <div style={{
            position: "absolute",
            bottom: "10px",
            left: "10px",
            color: "#fff",
            fontWeight: "bold",
            textShadow: "0 0 5px black",
            backgroundColor: "rgba(0,0,0,0.5)",
            padding: "2px 8px",
            borderRadius: "4px"
          }}>
            {currentUserName} (Teacher)
          </div>
          <div style={{
            position: "absolute",
            bottom: "10px",
            right: "10px",
            display: "flex",
            gap: "10px",
            backgroundColor: "rgba(0,0,0,0.5)",
            padding: "5px 10px",
            borderRadius: "20px"
          }}>
            <button 
              onClick={toggleCam} 
              style={{ 
                color: camOn ? "green" : "red", 
                border: "none", 
                background: "transparent", 
                cursor: "pointer",
                fontSize: "16px"
              }}
            >
              {camOn ? <FaVideo /> : <FaVideoSlash />}
            </button>
            <button 
              onClick={toggleMic} 
              style={{ 
                color: micOn ? "green" : "red", 
                border: "none", 
                background: "transparent", 
                cursor: "pointer",
                fontSize: "16px"
              }}
            >
              {micOn ? <FaMicrophone /> : <FaMicrophoneSlash />}
            </button>
          </div>
        </div>

        {/* Peer Videos */}
        {Object.entries(peerStreams).map(([id, stream]) => {
          const info = peerInfo[id] || {};
          return (
            <div key={id} style={{
              position: "relative",
              flexBasis: "calc(10% - 50px)",
              height: "200px",
              border: info.isTeacher ? "2px solid #2196f3" : "1px solid #666",
              borderRadius: "8px",
              overflow: "hidden",
              backgroundColor: "#333",
              minWidth: "300px"
            }}>
              <video
                autoPlay
                playsInline
                ref={el => { 
                  if (el) {
                    if (stream && info.camOn !== false) {
                      el.srcObject = stream;
                    } else {
                      el.srcObject = null;
                    }
                  }
                }}
                style={{ 
                  width: "100%", 
                  height: "100%", 
                  objectFit: "cover",
                  transform: "scaleX(-1)",
                  display: (stream && info.camOn !== false) ? "block" : "none"
                }}
              />
              {(!stream || info.camOn === false) && (
                <div style={{
                  position: "absolute",
                  top: 0, left: 0, width: "100%", height: "100%",
                  display: "flex", justifyContent: "center", alignItems: "center",
                  fontSize: "60px", color: "#fff", backgroundColor: "#555"
                }}>
                  <FaUser />
                </div>
              )}
              <div style={{
                position: "absolute",
                bottom: "10px",
                left: "10px",
                color: "#fff",
                fontWeight: "bold",
                textShadow: "0 0 5px black",
                backgroundColor: "rgba(0,0,0,0.5)",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "14px"
              }}>
                {info.name} {info.isTeacher ? "(Teacher)" : "(Student)"}
              </div>
              
              <div style={{
                position: "absolute",
                bottom: "10px",
                right: "10px",
                display: "flex",
                gap: "10px",
                backgroundColor: "rgba(0,0,0,0.5)",
                padding: "5px 10px",
                borderRadius: "20px"
              }}>
                <div style={{ 
                  color: info.camOn !== false ? "green" : "red", 
                  fontSize: "16px",
                  display: "flex",
                  alignItems: "center"
                }}>
                  {info.camOn !== false ? <FaVideo /> : <FaVideoSlash />}
                </div>
                <div style={{ 
                  color: info.micOn !== false ? "green" : "red", 
                  fontSize: "16px",
                  display: "flex",
                  alignItems: "center"
                }}>
                  {info.micOn !== false ? <FaMicrophone /> : <FaMicrophoneSlash />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chat Section */}
      <div
        style={{
          position: "absolute",
          bottom: "100px",
          right: "20px",
          width: "50px",
          height: "50px",
          borderRadius: "50%",
          backgroundColor: "#4caf50",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: "pointer",
          zIndex: 1000,
        }}
        onClick={() => setMessagesOpen(!messagesOpen)}
      >
        <FaComment color="white" size={24} />
      </div>

      {messagesOpen && (
        <aside
          style={{
            position: "absolute",
            bottom: "80px",
            right: "20px",
            width: "300px",
            height: "400px",
            backgroundColor: "white",
            border: "1px solid #ccc",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            zIndex: 1000,
            boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
          }}
        >
          <div style={{  
            color: "#8f8a8aff",
            padding: "10px",
            borderBottom: "1px solid #ccc",
            fontWeight: "bold",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            Exam Chat
            <button
              onClick={() => setMessagesOpen(false)}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ 
            color: "#000000ab",
            flex: 1,
            padding: "10px",
            overflowY: "auto",
            fontSize: "14px"
          }}>
            {messages.length === 0 ? (
              <div style={{ color: "#888" }}>No messages yet</div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} style={{ 
                  marginBottom: "8px",
                  padding: "5px",
                  backgroundColor: msg.isAlert ? "#ffebee" : (msg.isTeacher ? "#e3f2fd" : "#f5f5f5"),
                  borderRadius: "5px",
                  borderLeft: msg.isAlert ? "3px solid red" : "none"
                }}>
                  <strong style={{ color: msg.isAlert ? "red" : "inherit" }}>
                    {msg.sender}:
                  </strong> {msg.text}
                </div>
              ))
            )}
          </div>

          <div style={{ color: "#888", display: "flex", borderTop: "1px solid #ccc" }}>
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type your message..."
              style={{
                flex: 1,
                padding: "8px",
                border: "none",
                outline: "none",
                borderRadius: "0 0 0 8px"
              }}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button
              onClick={sendMessage}
              style={{
                padding: "0 15px",
                border: "none",
                backgroundColor: "#4caf50",
                color: "white",
                cursor: "pointer",
                borderRadius: "0 0 8px 0"
              }}
            >
              Send
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}