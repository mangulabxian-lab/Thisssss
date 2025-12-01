// StudentQuizPage.jsx - COMPLETE FIXED VERSION
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { getQuizForStudent, submitQuizAnswers } from '../lib/api';
import './StudentQuizPage.css';

// ==================== WAITING ROOM COMPONENT ====================
const WaitingRoomComponent = React.memo(({ 
  requiresCamera, 
  requiresMicrophone, 
  onExamStarted,
  onCancel,
  examTitle,
  className,
  teacherDetectionSettings
}) => {
  const [checkingPermissions, setCheckingPermissions] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState({
    camera: { granted: false, error: '' },
    microphone: { granted: false, error: '' }
  });
  const [retryCount, setRetryCount] = useState(0);
  const [canEnterExam, setCanEnterExam] = useState(false);

  const checkPermissions = useCallback(async () => {
    setCheckingPermissions(true);
    
    const newStatus = {
      camera: { granted: false, error: '' },
      microphone: { granted: false, error: '' }
    };

    try {
      // Check camera permission
      if (requiresCamera) {
        try {
          const cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480 } 
          });
          newStatus.camera.granted = true;
          cameraStream.getTracks().forEach(track => track.stop());
        } catch (error) {
          newStatus.camera.error = getErrorMessage(error);
        }
      } else {
        newStatus.camera.granted = true;
      }

      // ✅ MICROPHONE IS NOW MANDATORY
      if (requiresMicrophone) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            } 
          });
          newStatus.microphone.granted = true;
          micStream.getTracks().forEach(track => track.stop());
        } catch (error) {
          newStatus.microphone.error = getErrorMessage(error);
        }
      } else {
        newStatus.microphone.granted = true;
      }

      setPermissionStatus(newStatus);
      
      // ✅ STRICTER REQUIREMENT: MICROPHONE IS MANDATORY IF REQUIRED
      const allRequiredGranted = 
        (!requiresCamera || newStatus.camera.granted) && 
        (!requiresMicrophone || newStatus.microphone.granted);
      
      setCanEnterExam(allRequiredGranted);
      
    } catch (error) {
      console.error('Permission check error:', error);
    } finally {
      setCheckingPermissions(false);
    }
  }, [requiresCamera, requiresMicrophone]);

  const getErrorMessage = (error) => {
    switch (error.name) {
      case 'NotAllowedError':
        return 'Permission denied. Please allow access in your browser settings.';
      case 'NotFoundError':
        return 'Device not found. Please check if your camera/microphone is connected.';
      case 'NotReadableError':
        return 'Device is busy. Please close other applications using your camera/microphone.';
      case 'OverconstrainedError':
        return 'Device does not meet requirements.';
      default:
        return 'Unable to access device. Please check your permissions.';
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    checkPermissions();
  };

  const handleEnterExam = () => {
    if (canEnterExam) {
      onExamStarted();
    } else {
      // ✅ PREVENT ENTRY IF MICROPHONE NOT GRANTED
      if (requiresMicrophone && !permissionStatus.microphone.granted) {
        alert('🎤 Microphone access is REQUIRED to enter the exam. Please grant microphone permission.');
        handleRetry();
      }
    }
  };

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  return (
    <div className="waiting-room-overlay">
      <div className="waiting-room-modal">
        <div className="waiting-room-header">
          <h2>🕒 Exam Entry Requirements</h2>
          <div className="exam-info-waiting">
            <h3>{examTitle}</h3>
            <p>Class: {className}</p>
          </div>
        </div>

        <div className="waiting-content">
          {/* ✅ MICROPHONE REQUIREMENT WARNING */}
          {requiresMicrophone && (
            <div className="requirement-warning critical">
              <div className="warning-icon">🎤</div>
              <div className="warning-content">
                <h4>🎤 Microphone Required</h4>
                <p><strong>This exam requires microphone access for audio proctoring and alert detection.</strong></p>
                <p className="critical-text">You MUST enable microphone access to enter the exam.</p>
              </div>
            </div>
          )}

          <div className="permission-status">
            <h4>📋 System Requirements Check</h4>
            
            {requiresCamera && (
              <div className={`requirement-item ${permissionStatus.camera.granted ? 'granted' : 'denied'}`}>
                <div className="requirement-icon">
                  {permissionStatus.camera.granted ? '✅' : '❌'}
                </div>
                <div className="requirement-content">
                  <h4>Camera Access</h4>
                  <p>Required for proctoring and monitoring</p>
                  {!permissionStatus.camera.granted && permissionStatus.camera.error && (
                    <div className="error-message">{permissionStatus.camera.error}</div>
                  )}
                </div>
              </div>
            )}

            {requiresMicrophone && (
              <div className={`requirement-item ${permissionStatus.microphone.granted ? 'granted' : 'denied'} ${
                !permissionStatus.microphone.granted ? 'critical-requirement' : ''
              }`}>
                <div className="requirement-icon">
                  {permissionStatus.microphone.granted ? '✅' : '❌'}
                </div>
                <div className="requirement-content">
                  <h4>Microphone Access <span className="required-badge">MANDATORY</span></h4>
                  <p><strong>Required for audio monitoring and alert detection</strong></p>
                  {!permissionStatus.microphone.granted && permissionStatus.microphone.error && (
                    <div className="error-message critical">{permissionStatus.microphone.error}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ✅ ENTRY STATUS */}
          <div className="entry-status">
            {canEnterExam ? (
              <div className="status-granted">
                <div className="status-icon">✅</div>
                <div className="status-content">
                  <h4>All Requirements Met</h4>
                  <p>You can now enter the exam session.</p>
                </div>
              </div>
            ) : (
              <div className="status-denied">
                <div className="status-icon">❌</div>
                <div className="status-content">
                  <h4>Requirements Not Met</h4>
                  <p>You must grant all required permissions to enter the exam.</p>
                  {requiresMicrophone && !permissionStatus.microphone.granted && (
                    <p className="critical-warning">🎤 <strong>Microphone access is MANDATORY for this exam.</strong></p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="detection-info">
            <h4>🚨 Proctoring Information</h4>
            <div className="detection-rules">
              <div className="rule-item">
                <span className="rule-icon">👁️</span>
                <span className="rule-text">Face must be visible to camera at all times</span>
              </div>
              <div className="rule-item">
                <span className="rule-icon">🎤</span>
                <span className="rule-text">Microphone will monitor for suspicious sounds and speaking</span>
              </div>
              <div className="rule-item">
                <span className="rule-icon">📵</span>
                <span className="rule-text">No mobile phones or secondary devices allowed</span>
              </div>
              <div className="rule-item">
                <span className="rule-icon">👥</span>
                <span className="rule-text">No other people in the room</span>
              </div>
              <div className="rule-item">
                <span className="rule-icon">👀</span>
                <span className="rule-text">Eye gaze monitoring is active</span>
              </div>
              <div className="rule-item">
                <span className="rule-icon">🤚</span>
                <span className="rule-text">Hand gesture detection is active</span>
              </div>
              <div className="rule-item">
                <span className="rule-icon">💻</span>
                <span className="rule-text">Tab switching is monitored - stay on this page</span>
              </div>
              <div className="rule-item">
                <span className="rule-icon">📸</span>
                <span className="rule-text">Screenshot detection is active</span>
              </div>
            </div>
          </div>

          <div className="attempts-info">
            <h4>⚠️ Violation System</h4>
            <p>You have <strong>{teacherDetectionSettings.maxAttempts || 10} attempts</strong> for violations.</p>
            <p>Violations include: Speaking detected, suspicious sounds, looking away, phone usage, etc.</p>
          </div>

          {!canEnterExam && (
            <div className="waiting-indicator">
              <div className="loading-spinner-large"></div>
              <p>Waiting for required permissions...</p>
              {requiresMicrophone && !permissionStatus.microphone.granted && (
                <small className="critical-warning">🎤 <strong>Microphone access is required to continue</strong></small>
              )}
            </div>
          )}
        </div>

        <div className="waiting-actions">
          {checkingPermissions ? (
            <div className="checking-permissions">
              <div className="loading-spinner"></div>
              <span>Checking permissions...</span>
            </div>
          ) : (
            <>
              {!canEnterExam && (
                <div className="action-buttons">
                  <button className="retry-btn" onClick={handleRetry}>
                    🔄 Retry Permission Check
                  </button>
                </div>
              )}
              
              {canEnterExam && (
                <button className="enter-exam-btn" onClick={handleEnterExam}>
                  🚪 Enter Exam Session
                </button>
              )}
              
              <button className="cancel-btn" onClick={onCancel}>
                ← Leave Waiting Room
              </button>
            </>
          )}
        </div>

        {retryCount > 0 && (
          <div className="retry-hint">
            <p>💡 <strong>Still having issues?</strong></p>
            <ul>
              <li>Check if your microphone is being used by another application</li>
              <li>Make sure you've clicked "Allow" when prompted for microphone access</li>
              <li>Try using a different browser (Chrome recommended)</li>
              <li>Ensure your browser is up to date</li>
              {requiresMicrophone && (
                <li><strong>Microphone is required - you cannot enter without it</strong></li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
});

// ==================== MICROPHONE COMPONENT ====================
const MicrophoneComponent = React.memo(({ 
  requiresMicrophone,
  onMicrophoneStateChange,
  onProctoringAlert,
  examId
}) => {
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const [micState, setMicState] = useState({
    isConnected: false,
    isInitializing: false,
    error: '',
    hasMicrophone: false,
    isMuted: true,
    isSpeaking: false
  });

  const [audioLevel, setAudioLevel] = useState(0);
  const audioLevelRef = useRef(0);

  const captureAudio = useCallback(async () => {
    if (!requiresMicrophone || !micState.isConnected || micState.isMuted) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      });
      
      streamRef.current = stream;
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;
      
      let lastAudioSend = 0;
      let audioBuffer = [];
      
      processor.onaudioprocess = (e) => {
        if (!micState.isConnected || micState.isMuted) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate audio level for visualization
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        const level = Math.min(100, Math.max(0, rms * 1000));
        audioLevelRef.current = level;
        setAudioLevel(level);

        // Detect speaking state
        const isCurrentlySpeaking = level > 15;
        if (isCurrentlySpeaking !== micState.isSpeaking) {
          setMicState(prev => ({ ...prev, isSpeaking: isCurrentlySpeaking }));
          
          if (isCurrentlySpeaking && !micState.isMuted) {
            console.log('🎤 Speaking detected, level:', level);
            
            if (Date.now() - lastAudioSend > 5000) {
              const buffer = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                buffer[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
              }
              
              fetch('http://localhost:5000/process_audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  audio: buffer,
                  exam_id: examId,
                  student_id: 'student-user',
                  timestamp: new Date().toISOString()
                })
              }).then(response => response.json())
                .then(data => {
                  console.log('🎤 Audio processing result:', data);
                  if (data.audioStatus === 'speaking' && data.confidence > 0.6) {
                    onProctoringAlert({
                      message: `🎤 Speaking detected (confidence: ${Math.round(data.confidence * 100)}%)`,
                      type: 'warning',
                      severity: 'medium',
                      timestamp: new Date().toLocaleTimeString(),
                      detectionType: 'audio_detection'
                    });
                  }
                })
                .catch(error => {
                  console.error('Audio send error:', error);
                });
              
              lastAudioSend = Date.now();
            }
          }
        }
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
    } catch (error) {
      console.error('Audio capture error:', error);
      setMicState(prev => ({
        ...prev,
        error: 'Microphone access failed',
        isConnected: false
      }));
      onMicrophoneStateChange?.(false);
    }
  }, [requiresMicrophone, examId, onMicrophoneStateChange, onProctoringAlert, micState.isConnected, micState.isMuted, micState.isSpeaking]);

  const initializeMicrophone = useCallback(async () => {
    if (!requiresMicrophone) return;

    try {
      setMicState(prev => ({ ...prev, isInitializing: true, error: '' }));

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone not supported');
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const microphones = devices.filter(device => device.kind === 'audioinput');
      
      if (microphones.length === 0) {
        throw new Error('No microphone found');
      }

      setMicState(prev => ({ 
        ...prev, 
        hasMicrophone: true,
        isInitializing: false 
      }));

      onMicrophoneStateChange?.(false);

    } catch (error) {
      console.error('Microphone initialization failed:', error);
      
      let userMessage = 'Microphone setup failed';
      if (error.name === 'NotAllowedError') userMessage = 'Microphone permission denied';
      else if (error.name === 'NotFoundError') userMessage = 'No microphone found';
      else if (error.name === 'NotReadableError') userMessage = 'Microphone is busy';
      
      setMicState(prev => ({
        ...prev,
        isConnected: false,
        isInitializing: false,
        error: userMessage
      }));
      onMicrophoneStateChange?.(false);
    }
  }, [requiresMicrophone, onMicrophoneStateChange]);

  const toggleMicrophone = async () => {
    if (micState.isInitializing) return;

    const newMuteState = !micState.isMuted;
    
    if (newMuteState) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      setMicState(prev => ({
        ...prev,
        isMuted: true,
        isSpeaking: false
      }));
      setAudioLevel(0);
      audioLevelRef.current = 0;
      onMicrophoneStateChange?.(false);
      
    } else {
      setMicState(prev => ({ ...prev, isMuted: false, isConnected: true }));
      onMicrophoneStateChange?.(true);
      await captureAudio();
    }
  };

  const retryMicrophone = async () => {
    await initializeMicrophone();
  };

  useEffect(() => {
    let animationFrame;
    
    const updateAudioLevel = () => {
      setAudioLevel(audioLevelRef.current);
      animationFrame = requestAnimationFrame(updateAudioLevel);
    };
    
    if (micState.isConnected && !micState.isMuted) {
      animationFrame = requestAnimationFrame(updateAudioLevel);
    }
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [micState.isConnected, micState.isMuted]);

  useEffect(() => {
    if (!requiresMicrophone) return;

    let mounted = true;

    const initMicrophone = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const microphones = devices.filter(device => device.kind === 'audioinput');
        
        if (mounted) {
          setMicState(prev => ({ ...prev, hasMicrophone: microphones.length > 0 }));
        }

        if (microphones.length > 0 && mounted) {
          await initializeMicrophone();
        } else if (mounted) {
          setMicState(prev => ({ 
            ...prev, 
            error: 'No microphone found', 
            isInitializing: false 
          }));
        }
      } catch (error) {
        if (mounted) {
          setMicState(prev => ({ 
            ...prev, 
            error: 'Microphone setup failed', 
            isInitializing: false 
          }));
        }
      }
    };

    initMicrophone();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [requiresMicrophone, initializeMicrophone]);

  if (!requiresMicrophone) return null;

  return (
    <div className="microphone-section">
      <div className="microphone-header">
        <div className="user-info">
          <span className="user-name">Microphone</span>
          <span className={`detection-status ${micState.isConnected && !micState.isMuted ? 'normal' : 'bad'}`}>
            {micState.isConnected && !micState.isMuted ? '🎤 Active' : '🎤 Muted'}
          </span>
          {micState.isConnected && !micState.isMuted && micState.isSpeaking && (
            <span className="speaking-status">🔊 Speaking</span>
          )}
        </div>
        <div className="microphone-controls">
          <button 
            className={`mic-icon ${micState.isMuted ? 'muted' : 'active'} ${
              micState.isSpeaking && !micState.isMuted ? 'speaking' : ''
            }`}
            onClick={toggleMicrophone}
            disabled={micState.isInitializing || !micState.hasMicrophone}
          >
            <div className="mic-icon-container">
              {micState.isMuted ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3.7v6.8l-2.5 2.5V6.7H7v8.8c0 .28.22.5.5.5h2.29l-2.79 2.79-.14.14a.5.5 0 00.36.85h7.56l2.5-2.5H12V3.7z"/>
                  <path d="M16 9.2v2.77l2 2V9.2h-2zM19.29 5.79L18 7.08l2 2 1.29-1.29a1 1 0 000-1.41l-1.59-1.59a1 1 0 00-1.41 0L18 4.08l-2-2-1.29 1.29 2 2-2 2 1.29 1.29 2-2 2 2 1.29-1.29-2-2 2-2z"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              )}
              
              {!micState.isMuted && (
                <div className="audio-levels">
                  {[1, 2, 3].map((bar) => (
                    <div 
                      key={bar}
                      className={`audio-bar bar-${bar} ${
                        audioLevel > bar * 25 ? 'active' : ''
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </button>
        </div>
      </div>

      <div className="microphone-status">
        {micState.isInitializing && (
          <div className="initializing-message">
            <div className="loading-spinner-small"></div>
            <span>Initializing microphone...</span>
          </div>
        )}
        
        {micState.error && (
          <div className="microphone-error">
            <button className="retry-btn" onClick={retryMicrophone}>🔄 Retry</button>
            <span className="error-message">{micState.error}</span>
          </div>
        )}
        
        {!micState.error && !micState.isInitializing && (
          <div className="microphone-info">
            <span className="status-text">
              {micState.isMuted ? 'Microphone is muted' : 'Microphone is active'}
            </span>
            {micState.isSpeaking && !micState.isMuted && (
              <span className="speaking-indicator">🔊 Audio detected</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// ==================== CAMERA COMPONENT ====================
const CameraComponent = React.memo(({ 
  requiresCamera, 
  onCameraStateChange,
  onProctoringAlert,
  examId,
  teacherDetectionSettings,
  socketRef,
  tabSwitchCount = 0,
  windowBlurCount = 0,
  microphoneActive = false,
  isSpeaking = false
}) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraState, setCameraState] = useState({
    isConnected: false,
    isInitializing: false,
    error: '',
    hasCamera: false
  });
  const [camOn, setCamOn] = useState(true);
  
  const captureIntervalRef = useRef(null);

  const getDetectionTypeFromActivity = (activity) => {
    if (activity.includes('TAB')) return 'tab_switching';
    if (activity.includes('AUDIO')) return 'audio_detection';
    if (activity.includes('GESTURE')) return 'suspicious_gesture';
    if (activity.includes('MULTIPLE')) return 'multiple_people';
    if (activity.includes('GAZE')) return 'gaze_deviation';
    if (activity.includes('HEAD')) return 'head_pose';
    if (activity.includes('MOUTH')) return 'mouth_movement';
    if (activity.includes('NO FACE')) return 'no_face_detected'; // ✅ ADD THIS LINE
    if (activity.includes('LOW ATTENTION')) return 'low_attention_score'; // ✅ ADD THIS LINE
    
    return 'unknown';
  };

  const captureFrame = useCallback(async () => {
    if (!videoRef.current || !requiresCamera || !cameraState.isConnected || !camOn) return;
    
    try {
      const video = videoRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      
      const studentSocketId = socketRef.current?.id || 'unknown-socket';
        
      const detectionData = {
        image: imageData,
        exam_id: examId,
        student_id: 'student-user',
        student_socket_id: studentSocketId,
        timestamp: new Date().toISOString(),
        detection_settings: teacherDetectionSettings,
        behavior_data: {
          tab_switch_count: tabSwitchCount,
          window_blur_count: windowBlurCount,
          last_activity: new Date().toISOString(),
          microphone_active: microphoneActive,
          is_speaking: isSpeaking
        }
      };
      
      console.log('📊 Sending detection with behavior data:', {
        tabSwitches: tabSwitchCount,
        windowBlurs: windowBlurCount,
        micActive: microphoneActive,
        speaking: isSpeaking
      });
      
      const response = await fetch('http://localhost:5000/detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(detectionData)
      });
      
      if (response.ok) {
        const results = await response.json();
        console.log('📊 Proctoring results:', results);
        
        if (results.suspiciousActivities && results.suspiciousActivities.length > 0) {
            const filteredAlerts = results.suspiciousActivities.filter(activity => {
            if (activity.includes('face') && !teacherDetectionSettings.faceDetection) return false;
            if (activity.includes('gaze') && !teacherDetectionSettings.gazeDetection) return false;
            if (activity.includes('phone') && !teacherDetectionSettings.phoneDetection) return false;
            if (activity.includes('mouth') && !teacherDetectionSettings.mouthDetection) return false;
            if (activity.includes('Multiple') && !teacherDetectionSettings.multiplePeopleDetection) return false;
            if (activity.includes('AUDIO') && !teacherDetectionSettings.audioDetection) return false;
            if (activity.includes('GESTURE') && !teacherDetectionSettings.handGestureDetection) return false;
            if (activity.includes('TAB') && !teacherDetectionSettings.tabSwitchDetection) return false;
            if (activity.includes('SCREENSHOT') && !teacherDetectionSettings.screenshotDetection) return false;
            if (activity.includes('NO FACE') && !teacherDetectionSettings.faceDetection) return false; // ✅ ADD THIS LINE
            if (activity.includes('LOW ATTENTION') && !teacherDetectionSettings.attentionDetection) return false; // ✅ ADD THIS LINE
            return true;
          });
          
          filteredAlerts.forEach(activity => {
            onProctoringAlert({
              message: activity,
              type: activity.includes('phone') || activity.includes('Multiple') || activity.includes('TAB') ? 'danger' : 'warning',
              severity: activity.includes('phone') || activity.includes('Multiple') || activity.includes('TAB') ? 'high' : 'medium',
              timestamp: new Date().toLocaleTimeString(),
              detectionType: getDetectionTypeFromActivity(activity)
            });
          });
        }
      }
    } catch (error) {
      console.error('Proctoring capture error:', error);
    }
  }, [requiresCamera, examId, onProctoringAlert, cameraState.isConnected, camOn, teacherDetectionSettings, socketRef, tabSwitchCount, windowBlurCount, microphoneActive, isSpeaking]);
  
  const startProctoring = useCallback(() => {
    if (!requiresCamera || !cameraState.isConnected) return;
    captureIntervalRef.current = setInterval(captureFrame, 3000);
    console.log('📹 Proctoring started - capturing frames every 3 seconds');
  }, [requiresCamera, captureFrame, cameraState.isConnected]);
  
  const stopProctoring = useCallback(() => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
      console.log('🛑 Proctoring stopped');
    }
  }, []);

  const initializeCamera = useCallback(async () => {
    if (!requiresCamera) return;

    try {
      setCameraState(prev => ({ ...prev, isInitializing: true, error: '' }));

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
          frameRate: { ideal: 15, max: 30 },
          exposureMode: 'continuous',
          whiteBalanceMode: 'continuous'
        },
        audio: false
      });
      
      streamRef.current = stream;

      if (!videoRef.current) {
        throw new Error('Video element not available');
      }

      const videoElement = videoRef.current;
      videoElement.srcObject = stream;
      videoElement.style.transform = 'scaleX(-1)';

      await videoElement.play();

      setCameraState(prev => ({
        ...prev,
        isConnected: true,
        isInitializing: false,
        hasCamera: true,
        error: ''
      }));
      
      onCameraStateChange?.(true);
      startProctoring();

    } catch (error) {
      console.error('Camera initialization failed:', error);
      
      let userMessage = 'Camera access failed';
      if (error.name === 'NotAllowedError') userMessage = 'Camera permission denied';
      else if (error.name === 'NotFoundError') userMessage = 'No camera found';
      else if (error.name === 'NotReadableError') userMessage = 'Camera is busy';
      
      setCameraState(prev => ({
        ...prev,
        isConnected: false,
        isInitializing: false,
        error: userMessage
      }));
      onCameraStateChange?.(false);
    }
  }, [requiresCamera, onCameraStateChange, startProctoring]);

  useEffect(() => {
    if (!requiresCamera) return;

    let mounted = true;

    const initCamera = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');
        
        if (mounted) {
          setCameraState(prev => ({ ...prev, hasCamera: cameras.length > 0 }));
        }

        if (cameras.length > 0 && mounted) {
          await initializeCamera();
        } else if (mounted) {
          setCameraState(prev => ({ 
            ...prev, 
            error: 'No camera found', 
            isInitializing: false 
          }));
        }
      } catch (error) {
        if (mounted) {
          setCameraState(prev => ({ 
            ...prev, 
            error: 'Camera setup failed', 
            isInitializing: false 
          }));
        }
      }
    };

    initCamera();

    return () => {
      mounted = false;
      stopProctoring();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [requiresCamera, initializeCamera, stopProctoring]);

  const toggleCam = () => {
    if (!streamRef.current) return;
    
    const videoTracks = streamRef.current.getVideoTracks();
    if (videoTracks.length > 0) {
      const newCamState = !camOn;
      videoTracks[0].enabled = newCamState;
      setCamOn(newCamState);
      onCameraStateChange?.(newCamState);
      
      if (newCamState) {
        startProctoring();
      } else {
        stopProctoring();
      }
    }
  };

  const retryCamera = async () => {
    setCameraState(prev => ({ ...prev, error: '', isInitializing: true }));
    await initializeCamera();
  };

  if (!requiresCamera) return null;

  return (
    <div className="camera-section">
      <div className="camera-header">
        <div className="user-info">
          <span className="user-name">Camera</span>
          <span className={`detection-status ${cameraState.isConnected ? 'normal' : 'bad'}`}>
            {cameraState.isConnected ? '📹 Active' : '📹 Off'}
          </span>
          {cameraState.isConnected && camOn && (
            <span className="proctoring-status">🔍 Monitoring</span>
          )}
        </div>
        <div className="camera-controls-mini">
          <button 
            className={`control-icon ${camOn ? 'active' : ''}`}
            onClick={toggleCam}
            disabled={cameraState.isInitializing || !cameraState.isConnected}
          >
            {camOn ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 10.48V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4.48l4 3.98v-11l-4 3.98z"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 10.48V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4.48l4 3.98v-11l-4 3.98z"/>
                <path d="M4 6v12h12V6H4zm11.58 2.08l1.42-1.42 1.42 1.42 1.42-1.42 1.42 1.42-1.42 1.42 1.42 1.42-1.42 1.42-1.42-1.42-1.42 1.42-1.42-1.42 1.42-1.42-1.42-1.42z" 
                  fill="red"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="camera-preview">
        <video 
          ref={videoRef}
          autoPlay 
          muted 
          playsInline
          className="camera-video"
          style={{ 
            display: (cameraState.isConnected && camOn) ? 'block' : 'none'
          }}
        />
        
        {(!cameraState.isConnected || !camOn) ? (
          <div className="camera-offline">
            <div className="offline-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="#666">
                <path d="M18 10.48V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4.48l4 3.98v-11l-4 3.98z"/>
              </svg>
            </div>
            <p>{cameraState.error || 'Camera is off'}</p>
            {cameraState.isInitializing && (
              <div className="initializing-message">
                <div className="loading-spinner-small"></div>
                <span>Starting camera...</span>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {cameraState.error && (
        <div className="camera-error-footer">
          <button className="retry-btn" onClick={retryCamera}>🔄 Retry Camera</button>
          <span className="error-message">{cameraState.error}</span>
        </div>
      )}
    </div>
  );
});

// ==================== HEADER ALERTS COMPONENT ====================
const HeaderAlerts = React.memo(({ alerts }) => {
  if (alerts.length === 0) return null;

  const latestAlerts = alerts.slice(0, 2);

  return (
    <div className="header-alerts">
      {latestAlerts.map((alert) => (
        <div key={alert.id} className={`alert-text ${
          alert.type || 
          (alert.message?.includes('TAB') || alert.detectionType?.includes('tab_switch') ? 'danger' : 
           alert.message?.includes('AUDIO') || alert.detectionType?.includes('audio') ? 'warning' : 
           alert.message?.includes('GESTURE') || alert.detectionType?.includes('gesture') ? 'warning' : 
           alert.message?.includes('SCREENSHOT') || alert.detectionType?.includes('screenshot') ? 'danger' : 'warning')
        }`}>
          {alert.detectionType?.includes('audio') && '🎤 '}
          {alert.detectionType?.includes('gesture') && '🤚 '}
          {alert.detectionType?.includes('tab_switch') && '💻 '}
          {alert.detectionType?.includes('screenshot') && '📸 '}
          {alert.message}
        </div>
      ))}
    </div>
  );
});

// ==================== PROCTORING ALERTS PANEL ====================
const ProctoringAlertsPanel = React.memo(({ alerts, isOpen, onToggle }) => {
  if (!isOpen) return null;

  const alertCounts = {
    audio: alerts.filter(alert => 
      alert.detectionType?.includes('audio') || alert.message?.includes('AUDIO')
    ).length,
    gesture: alerts.filter(alert => 
      alert.detectionType?.includes('gesture') || alert.message?.includes('GESTURE')
    ).length,
    tab: alerts.filter(alert => 
      alert.detectionType?.includes('tab_switch') || alert.message?.includes('TAB')
    ).length,
    screenshot: alerts.filter(alert => 
      alert.detectionType?.includes('screenshot') || alert.message?.includes('SCREENSHOT')
    ).length,
    total: alerts.length
  };

  return (
    <div className="proctoring-alerts-panel">
      <div className="alerts-panel-header">
        <h3>📊 Proctoring Alerts</h3>
        <button className="close-alerts-btn" onClick={onToggle}>✕</button>
      </div>
      
      <div className="alert-summary-cards">
        <div className="summary-card audio">
          <span className="summary-icon">🎤</span>
          <span className="summary-count">{alertCounts.audio}</span>
          <span className="summary-label">Audio Alerts</span>
        </div>
        <div className="summary-card gesture">
          <span className="summary-icon">🤚</span>
          <span className="summary-count">{alertCounts.gesture}</span>
          <span className="summary-label">Gesture Alerts</span>
        </div>
        <div className="summary-card tab">
          <span className="summary-icon">💻</span>
          <span className="summary-count">{alertCounts.tab}</span>
          <span className="summary-label">Tab Alerts</span>
        </div>
        <div className="summary-card screenshot">
          <span className="summary-icon">📸</span>
          <span className="summary-count">{alertCounts.screenshot}</span>
          <span className="summary-label">Screenshot Alerts</span>
        </div>
      </div>
      
      <div className="alerts-list">
        {alerts.length === 0 ? (
          <div className="no-alerts">
            <div className="no-alerts-icon">✅</div>
            <p>No proctoring alerts</p>
            <small>Good attention detected</small>
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className={`alert-item ${alert.type || 'warning'}`}>
              <div className="alert-icon">
                {alert.detectionType?.includes('audio') ? '🎤' :
                 alert.detectionType?.includes('gesture') ? '🤚' :
                 alert.detectionType?.includes('tab_switch') ? '💻' :
                 alert.detectionType?.includes('screenshot') ? '📸' :
                 alert.type === 'warning' ? '⚠️' : 
                 alert.type === 'danger' ? '🚨' : 'ℹ️'}
              </div>
              <div className="alert-content">
                <div className="alert-message">{alert.message}</div>
                <div className="alert-meta">
                  <span className="alert-time">{alert.timestamp}</span>
                  {alert.detectionType && (
                    <span className="alert-type">{alert.detectionType}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="alerts-summary">
        <span className="total-alerts">Total Alerts: {alertCounts.total}</span>
        {alertCounts.audio > 0 && <span className="audio-count">🎤: {alertCounts.audio}</span>}
        {alertCounts.gesture > 0 && <span className="gesture-count">🤚: {alertCounts.gesture}</span>}
        {alertCounts.tab > 0 && <span className="tab-count">💻: {alertCounts.tab}</span>}
        {alertCounts.screenshot > 0 && <span className="screenshot-count">📸: {alertCounts.screenshot}</span>}
      </div>
    </div>
  );
});

// ==================== CHAT COMPONENT ====================
const ChatComponent = React.memo(({ 
  messages, 
  newMessage, 
  setNewMessage, 
  handleSendMessage, 
  showChat, 
  toggleChat,
  unreadCount 
}) => {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (!showChat) return null;

  return (
    <div className="student-chat-panel">
      <div className="chat-header">
        <h3>💬 Exam Chat</h3>
        <button className="close-chat-btn" onClick={toggleChat}>✕</button>
      </div>
      
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="no-messages">
            <div className="chat-icon">💬</div>
            <p>No messages yet</p>
            <small>Ask questions to your teacher</small>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`message ${message.sender === 'student' ? 'sent' : 'received'}`}>
              <div className="message-header">
                <span className="sender-name">
                  {message.sender === 'student' ? 'You' : message.senderName}
                </span>
                <span className="message-time">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="message-content">
                {message.text}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message to teacher..."
          className="chat-input"
          maxLength={500}
        />
        <button 
          type="submit" 
          className="send-message-btn"
          disabled={!newMessage.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
});

// ==================== MAIN STUDENT QUIZ COMPONENT ====================
export default function StudentQuizPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const { 
    requiresCamera = false,
    requiresMicrophone = false,
    examTitle = 'Quiz',
    className = 'Class'
  } = location.state || {};

  // ==================== STATE MANAGEMENT ====================
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [error, setError] = useState('');
  const [examStarted, setExamStarted] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [windowBlurCount, setWindowBlurCount] = useState(0);
  const [lastTabSwitchTime, setLastTabSwitchTime] = useState(0);

  // ✅ TIMER STATE
  const [timeLeft, setTimeLeft] = useState(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // ✅ DETECTION SETTINGS
  const [teacherDetectionSettings, setTeacherDetectionSettings] = useState({
    faceDetection: true,
    gazeDetection: true,
    phoneDetection: true,
    mouthDetection: true,
    multiplePeopleDetection: true,
    audioDetection: true,
    handGestureDetection: true,
    tabSwitchDetection: true,
    screenshotDetection: true,
    attentionDetection: true
  });

  const [studentAttempts, setStudentAttempts] = useState({
    currentAttempts: 0,
    maxAttempts: 10,
    attemptsLeft: 10,
    history: []
  });

  // ✅ MICROPHONE STATE
  const [micState, setMicState] = useState({
    isConnected: false,
    isInitializing: false,
    error: '',
    hasMicrophone: false,
    isMuted: true,
    isSpeaking: false
  });

  // Permission & Monitoring State
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [microphoneActive, setMicrophoneActive] = useState(false);
  const [proctoringAlerts, setProctoringAlerts] = useState([]);
  const [peerConnection, setPeerConnection] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [cameraRequested, setCameraRequested] = useState(false);
  const [isSharingCamera, setIsSharingCamera] = useState(false);
  const [teacherSocketId, setTeacherSocketId] = useState(null);
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);

  // Chat State
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Refs
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);

  // ==================== QUIZ MANAGEMENT ====================
  const loadQuiz = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getQuizForStudent(examId);
      
      if (response.success) {
        setQuiz(response.data);
        
        const initialAnswers = {};
        if (response.data.questions) {
          response.data.questions.forEach((question, index) => {
            if (question.type === 'checkboxes') {
              initialAnswers[index] = [];
            } else {
              initialAnswers[index] = '';
            }
          });
        }
        setAnswers(initialAnswers);

        console.log('🕒 Waiting for teacher timer sync...');

      } else {
        setError(response.message || 'Failed to load quiz');
      }
    } catch (error) {
      console.error('Error loading quiz:', error);
      setError('Error loading quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  const handleAnswerChange = useCallback((questionIndex, value) => {
    setAnswers(prev => {
      const newAnswers = { ...prev, [questionIndex]: value };
      
      const count = Object.values(newAnswers).filter(answer => 
        answer && (typeof answer === 'string' ? answer.trim() !== '' : Array.isArray(answer) ? answer.length > 0 : true)
      ).length;
      setAnsweredCount(count);
      
      return newAnswers;
    });
  }, []);

  const handleCheckboxChange = useCallback((questionIndex, option, isChecked) => {
    const currentAnswers = Array.isArray(answers[questionIndex]) ? answers[questionIndex] : [];
    const newAnswers = isChecked
      ? [...currentAnswers, option]
      : currentAnswers.filter(opt => opt !== option);
    handleAnswerChange(questionIndex, newAnswers);
  }, [answers, handleAnswerChange]);

  const handleSubmitQuiz = async (isAutoSubmit = false) => {
    if (!isAutoSubmit) {
      if (!window.confirm('Are you sure you want to submit your answers?')) return;
    }
    
    if ((requiresCamera && !cameraActive) || (requiresMicrophone && !microphoneActive)) {
      const proceed = isAutoSubmit || window.confirm(
        'Monitoring is not fully active. This may be reported to your instructor. Continue with submission?'
      );
      if (!proceed) return;
    }

    setSubmitting(true);
    try {
      console.log('📤 Submitting quiz answers...');
      
      const submissionResponse = await submitQuizAnswers(examId, answers);
      
      if (submissionResponse.success) {
        console.log('✅ Quiz answers submitted successfully');
        
        try {
          await api.post(`/exams/${examId}/complete`, {
            score: submissionResponse.data.score,
            maxScore: submissionResponse.data.maxScore,
            percentage: submissionResponse.data.percentage,
            answers: Object.entries(answers).map(([index, answer]) => ({
              questionIndex: parseInt(index),
              answer: answer
            }))
          });
          console.log("✅ Exam marked as completed in backend");
        } catch (completionError) {
          console.error("❌ Failed to mark exam as completed:", completionError);
        }

        if (isAutoSubmit) {
          alert('⏰ Time is up! Your answers have been automatically submitted.');
        } else {
          alert('✅ Answers submitted successfully! Your exam has been moved to "Done" section.');
        }
        
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
        }
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
        }
        
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
        
        setTimeout(() => {
          navigate('/dashboard', { 
            state: { 
              examCompleted: true,
              examId: examId,
              message: isAutoSubmit ? 'Time expired - Quiz auto-submitted' : 'Quiz completed successfully!'
            }
          });
        }, 2000);
        
      } else {
        throw new Error(submissionResponse.message || 'Submission failed');
      }
    } catch (error) {
      console.error('Submission error:', error);
      alert('❌ Failed to submit answers. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };
// ==================== ACCURATE TAB SWITCHING DETECTION ====================
useEffect(() => {
  let lastFocusTime = Date.now();
  let isWindowFocused = true;
  let debounceTimer = null;

  const handleFocus = () => {
    const now = Date.now();
    const timeAway = now - lastFocusTime;
    
    // ✅ IGNORE SHORT ABSENCES (less than 1 second)
    if (timeAway > 1000 && !isWindowFocused) {
      console.log('🔍 Window focused after:', timeAway + 'ms');
      isWindowFocused = true;
      
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    }
  };

  const handleBlur = () => {
    lastFocusTime = Date.now();
    isWindowFocused = false;
    
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    debounceTimer = setTimeout(() => {
      if (!isWindowFocused && examStarted && permissionsGranted) {
        const newCount = windowBlurCount + 1;
        setWindowBlurCount(newCount);
        console.log('🪟 Window blur detected (debounced)! Count:', newCount);
      }
    }, 500);
  };

  const handleVisibilityChange = () => {
    // ✅ CHECK IF TAB SWITCH DETECTION IS ENABLED BY TEACHER
    if (!teacherDetectionSettings.tabSwitchDetection) {
      console.log('🛑 Tab switch detection is DISABLED by teacher - ignoring');
      return;
    }

    if (document.hidden) {
      const now = Date.now();
      const timeSinceLastSwitch = now - lastTabSwitchTime;
      
      // ✅ PREVENT RAPID MULTIPLE DETECTIONS - minimum 2 seconds between detections
      if (timeSinceLastSwitch > 2000 && examStarted && permissionsGranted) {
        const newCount = tabSwitchCount + 1;
        setTabSwitchCount(newCount);
        setLastTabSwitchTime(now);
        
        console.log('💻 Tab switch detected! Count:', newCount, 'Time since last:', timeSinceLastSwitch + 'ms');
        
        // ✅ ONLY SEND TO SERVER IF TAB SWITCH DETECTION IS ENABLED
        if (socketRef.current && teacherDetectionSettings.tabSwitchDetection) {
          socketRef.current.emit('tab-switch-detected', {
            examId: examId,
            studentSocketId: socketRef.current.id,
            timestamp: new Date().toISOString(),
            count: newCount,
            timeSinceLast: timeSinceLastSwitch
          });
        }
        
        // ✅ ONLY SHOW ALERT AND COUNT ATTEMPTS IF TAB SWITCH DETECTION IS ENABLED
        if (teacherDetectionSettings.tabSwitchDetection) {
          const newAlert = {
            id: Date.now(),
            message: '💻 Tab switch detected - Focus on the exam!',
            timestamp: new Date().toLocaleTimeString(),
            type: 'danger',
            severity: 'high',
            detectionType: 'tab_switching'
          };
          
          setProctoringAlerts(prev => [newAlert, ...prev.slice(0, 19)]);
          
          setStudentAttempts(prev => {
            const newAttempts = prev.currentAttempts + 1;
            const attemptsLeft = Math.max(0, prev.maxAttempts - newAttempts);
            
            const updated = {
              ...prev,
              currentAttempts: newAttempts,
              attemptsLeft: attemptsLeft,
              history: [
                ...prev.history,
                {
                  timestamp: new Date().toISOString(),
                  violation: 'tab_switching',
                  message: 'Tab switch detected',
                  attemptsLeft: attemptsLeft,
                  timeSinceLast: timeSinceLastSwitch
                }
              ].slice(-10)
            };
            
            if (attemptsLeft <= 3 && attemptsLeft > 0) {
              alert(`⚠️ Warning: Only ${attemptsLeft} attempt(s) left!`);
            }
            
            if (attemptsLeft <= 0) {
              alert('❌ You have been disconnected due to excessive violations.');
              setTimeout(() => {
                navigate('/dashboard');
              }, 3000);
            }
            
            return updated;
          });
        } else {
          console.log('🛑 Tab switch detection disabled - not counting as attempt');
        }
      } else {
        console.log('⏰ Tab switch ignored - too soon since last detection:', timeSinceLastSwitch + 'ms');
      }
    } else {
      lastFocusTime = Date.now();
      isWindowFocused = true;
    }
  };

  if (examStarted && permissionsGranted) {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    console.log('🔍 Accurate tab/window monitoring ACTIVATED');
  }

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('blur', handleBlur);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  };
}, [examId, examStarted, permissionsGranted, tabSwitchCount, windowBlurCount, navigate, lastTabSwitchTime, teacherDetectionSettings.tabSwitchDetection]); // ✅ ADD teacherDetectionSettings.tabSwitchDetection

  // ==================== PERMISSION HANDLERS ====================
  const handlePermissionsGranted = useCallback(() => {
    setPermissionsGranted(true);
    if (requiresCamera) setCameraActive(true);
    if (requiresMicrophone) setMicrophoneActive(true);
  }, [requiresCamera, requiresMicrophone]);

  const handleCancelExam = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  const handleExamStart = useCallback(() => {
    // ✅ MICROPHONE IS NOW REQUIRED FROM THE START
    if (requiresMicrophone) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          stream.getTracks().forEach(track => track.stop());
          setExamStarted(true);
          setPermissionsGranted(true);
          loadQuiz();
        })
        .catch(error => {
          alert('🎤 Microphone access is REQUIRED. Please grant microphone permission to start the exam.');
          console.error('Microphone permission denied:', error);
        });
    } else {
      setExamStarted(true);
      setPermissionsGranted(true);
      loadQuiz();
    }
  }, [requiresMicrophone, loadQuiz]);

  // ==================== SOCKET.IO SETUP ====================
  useEffect(() => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.error('❌ No token available for socket connection');
      return;
    }

    if (socketRef.current && socketRef.current.connected) {
      console.log('✅ Socket already connected, skipping reconnection');
      return;
    }

    console.log('🔑 Connecting student socket IMMEDIATELY...');

    const newSocket = io('http://localhost:3000', {
      auth: { token: token },
      query: { 
        examId: examId,
        userRole: 'student' 
      },
      transports: ['websocket', 'polling'],
      timeout: 30000,
      forceNew: true
    });

    newSocket.on('connect', () => {
      console.log('✅ Student Socket connected successfully');
      
      newSocket.emit('join-exam-room', {
        roomId: `exam-${examId}`,
        userName: 'Student',
        userId: 'student-user',
        userRole: 'student'
      });

      setTimeout(() => {
        if (newSocket.connected) {
          console.log('🕒 Requesting current time from teacher...');
          newSocket.emit('student-time-request', {
            studentSocketId: newSocket.id,
            roomId: `exam-${examId}`
          });
        }
      }, 1000);

      newSocket.on('proctoring-violation', (data) => {
        console.log('⚠️ Student received proctoring violation:', data);
        
        setStudentAttempts(prev => {
          const newAttempts = prev.currentAttempts + 1;
          const attemptsLeft = Math.max(0, prev.maxAttempts - newAttempts);
          
          const updated = {
            ...prev,
            currentAttempts: newAttempts,
            attemptsLeft: attemptsLeft,
            history: [
              ...prev.history,
              {
                timestamp: new Date().toISOString(),
                violation: data.message || data.violationType,
                attemptsLeft: attemptsLeft
              }
            ].slice(-10)
          };
          
          if (attemptsLeft <= 3 && attemptsLeft > 0) {
            alert(`⚠️ Warning: Only ${attemptsLeft} attempt(s) left!`);
          }
          
          if (attemptsLeft <= 0) {
            alert('❌ You have been disconnected due to excessive violations.');
            setTimeout(() => {
              navigate('/dashboard');
            }, 3000);
          }
          
          return updated;
        });
        
        const newAlert = {
          id: Date.now(),
          message: data.message || 'Suspicious activity detected',
          timestamp: new Date().toLocaleTimeString(),
          type: data.type || 'warning',
          severity: data.severity || 'medium'
        };
        
        setProctoringAlerts(prev => [newAlert, ...prev.slice(0, 19)]);
      });

      newSocket.on('student-violation', (data) => {
        console.log('⚠️ Received violation:', data);
        
        const detectionTypeMap = {
          'audio_detected': 'audio_detection',
          'speaking_detected': 'audio_detection', 
          'gesture_detected': 'suspicious_gesture',
          'tab_switch_detected': 'tab_switching',
        };
        
        const detectionType = detectionTypeMap[data.violationType] || data.violationType;
        
        setStudentAttempts(prev => {
          const newAttempts = prev.currentAttempts + 1;
          const attemptsLeft = Math.max(0, prev.maxAttempts - newAttempts);
          
          const updated = {
            ...prev,
            currentAttempts: newAttempts,
            attemptsLeft: attemptsLeft,
            history: [
              ...prev.history,
              {
                timestamp: new Date().toISOString(),
                violation: detectionType,
                attemptsLeft: attemptsLeft
              }
            ].slice(-10)
          };
          
          if (attemptsLeft <= 0) {
            alert('❌ You have been disconnected due to excessive violations.');
            navigate('/dashboard');
          }
          
          return updated;
        });
      });

      setTimeout(() => {
        if (newSocket.connected) {
          console.log('🕒 Requesting current time from teacher...');
          newSocket.emit('student-time-request', {
            studentSocketId: newSocket.id,
            roomId: `exam-${examId}`
          });
        }
      }, 1000);
    });

    newSocket.on('detection-settings-update', (data) => {
      console.log('🎯 Received detection settings from teacher:', data);
      
      if (data.settings) {
        setTeacherDetectionSettings(prev => ({
          ...prev,
          ...data.settings
        }));
        
        if (data.settings.maxAttempts) {
          setStudentAttempts(prev => ({
            ...prev,
            maxAttempts: data.settings.maxAttempts,
            attemptsLeft: data.settings.maxAttempts - prev.currentAttempts
          }));
        }
      }
    });

    newSocket.on('exam-started', (data) => {
      console.log('✅ Exam started by teacher:', data);
      setExamStarted(true);
      setPermissionsGranted(true);
      if (requiresCamera) setCameraActive(true);
      if (requiresMicrophone) setMicrophoneActive(true);
      
      loadQuiz();
    });

    newSocket.on('exam-ended', (data) => {
      console.log('🛑 Exam ended by teacher:', data);
      
      handleSubmitQuiz(true);
      
      alert('⏹️ Exam has been ended by the teacher. Your answers are being submitted.');

      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
    });

    newSocket.on('teacher-disconnect', (data) => {
      console.log('🔌 Disconnected by teacher:', data);
      
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      
      alert(`❌ ${data.reason || 'You have been disconnected by the teacher.'}`);
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
    });

    newSocket.on('exam-time-update', (data) => {
      console.log('🕒 Received timer update from teacher:', {
        timeLeft: data.timeLeft,
        isTimerRunning: data.isTimerRunning,
        formatted: formatTime(data.timeLeft)
      });
      
      setTimeLeft(data.timeLeft);
      setIsTimerRunning(data.isTimerRunning);
    });

    newSocket.on('camera-request', handleCameraRequest);
    newSocket.on('webrtc-answer', handleWebRTCAnswer);
    newSocket.on('ice-candidate', handleICECandidate);
    // In socket event listeners, add:
newSocket.on('proctoring-alert', (alertData) => {
    console.log('🚨 Student received proctoring alert:', alertData);
    
    // ✅ UPDATE ATTEMPTS FROM SERVER
    if (alertData.attemptsInfo) {
        setStudentAttempts({
            currentAttempts: alertData.attemptsInfo.currentAttempts,
            maxAttempts: alertData.attemptsInfo.maxAttempts,
            attemptsLeft: alertData.attemptsInfo.attemptsLeft,
            history: alertData.attemptsInfo.violation_history || []
        });
        
        // Show warning if attempts low
        if (alertData.attemptsInfo.attemptsLeft <= 3 && alertData.attemptsInfo.attemptsLeft > 0) {
            const newAlert = {
                id: Date.now(),
                message: `⚠️ Warning: ${alertData.attemptsInfo.attemptsLeft} attempt(s) remaining!`,
                timestamp: new Date().toLocaleTimeString(),
                type: 'danger',
                severity: 'high'
            };
            
            setProctoringAlerts(prev => [newAlert, ...prev.slice(0, 19)]);
        }
    }
    
    // Add the alert to display
    const newAlert = {
        id: Date.now(),
        message: alertData.message || 'Suspicious activity detected',
        timestamp: new Date().toLocaleTimeString(),
        type: alertData.type || 'warning',
        severity: alertData.severity || 'medium',
        detectionType: alertData.detectionType
    };
    
    setProctoringAlerts(prev => [newAlert, ...prev.slice(0, 19)]);
});
    newSocket.on('chat-message', handleChatMessage);
    newSocket.on('attempts-update', (data) => {
  console.log('📊 Received attempts update:', data);
  
  setStudentAttempts({
    currentAttempts: data.attempts.current_attempts,
    maxAttempts: data.attempts.max_attempts,
    attemptsLeft: data.attempts.attempts_left,
    history: data.attempts.violation_history || []
  });
  
  // Show warning if attempts low
  if (data.attempts.attempts_left <= 3 && data.attempts.attempts_left > 0) {
    const newAlert = {
      id: Date.now(),
      message: `⚠️ Warning: ${data.attempts.attempts_left} attempt(s) remaining!`,
      timestamp: new Date().toLocaleTimeString(),
      type: 'danger',
      severity: 'high'
    };
    
    setProctoringAlerts(prev => [newAlert, ...prev.slice(0, 19)]);
  }
  
  // Auto disconnect if attempts exhausted
  if (data.attempts.attempts_left <= 0) {
    alert('❌ You have been disconnected due to excessive violations.');
    setTimeout(() => {
      navigate('/dashboard');
    }, 3000);
  }
});

    socketRef.current = newSocket;

    return () => {
      console.log('🛑 Cleaning up student socket');
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [examId]);

  // ==================== TIMER EFFECT ====================
  useEffect(() => {
    if (timeLeft === null || !isTimerRunning) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitQuiz(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isTimerRunning]);

  // ==================== WEBRTC HANDLERS ====================
  const handleCameraRequest = async (data, isRetry = false) => {
    console.log('📹 Camera request from teacher:', data);
    setCameraRequested(true);
    setTeacherSocketId(data.from || data.teacherSocketId);
    
    try {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }

      console.log('🎥 Attempting to access camera...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24 },
          facingMode: 'user'
        }, 
        audio: false 
      });
      
      console.log('✅ Camera accessed successfully');
      
      const videoTrack = stream.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities();

      if (capabilities.exposureCompensation) {
        await videoTrack.applyConstraints({
          advanced: [{ exposureCompensation: -1.0 }]
        });
      }
      
      setLocalStream(stream);
      setIsSharingCamera(true);
      setCameraActive(true);

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => {
        console.log('➕ Adding track to peer connection:', track.kind);
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          console.log('🧊 Sending ICE candidate to teacher');
          socketRef.current.emit('ice-candidate', {
            target: data.from || data.teacherSocketId,
            candidate: event.candidate
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('🔗 Student WebRTC state:', pc.connectionState);
      };

      console.log('🤝 Creating WebRTC offer...');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('✅ Created local offer');

      if (socketRef.current) {
        socketRef.current.emit('webrtc-offer', {
          target: data.from || data.teacherSocketId,
          offer: offer
        });
        console.log('✅ Sent WebRTC offer to teacher');
      }

      socketRef.current.emit('camera-response', {
        teacherSocketId: data.from || data.teacherSocketId,
        enabled: true,
        studentId: 'student-user'
      });

      setPeerConnection(pc);

    } catch (error) {
      console.error('❌ Error accessing camera:', error);
      setIsSharingCamera(false);
      setCameraActive(false);
      
      if (socketRef.current) {
        socketRef.current.emit('camera-response', {
          teacherSocketId: data.from || data.teacherSocketId,
          enabled: false,
          error: error.message
        });
      }
      
      alert('❌ Failed to access camera. Please check permissions.');
    }
  };

  const handleWebRTCAnswer = async (data) => {
    const pc = peerConnectionRef.current;
    
    if (!pc) {
      console.log('❌ No peer connection to set remote description');
      return;
    }

    try {
      console.log('🔍 Before setting answer:', {
        signalingState: pc.signalingState,
        hasLocalDescription: !!pc.localDescription
      });

      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      console.log('✅ Student set remote description from teacher answer');

      console.log('🔍 After setting answer:', {
        signalingState: pc.signalingState,
        hasRemoteDescription: !!pc.remoteDescription
      });

    } catch (error) {
      console.error('❌ Student error setting remote description:', error);
      
      if (error.toString().includes('m-lines') || error.toString().includes('InvalidAccessError')) {
        console.log('🔄 SDP mismatch detected, restarting WebRTC...');
        handleCameraRequest({ from: teacherSocketId });
      }
    }
  };

  const handleICECandidate = async (data) => {
    const pc = peerConnectionRef.current;
    if (pc && data.candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log('✅ Student added ICE candidate from teacher');
      } catch (error) {
        console.error('❌ Student error adding ICE candidate:', error);
      }
    }
  };

  // ==================== PROCTORING ALERTS HANDLER ====================
  const handleProctoringAlert = useCallback((alertData) => {
    console.log('🚨 Student received proctoring alert:', alertData);
    
    const isTeacherUpdateMessage = alertData.message && 
        (alertData.message.includes('Teacher updated:') ||
         alertData.message.includes('detection settings'));
    
    if (isTeacherUpdateMessage) {
      console.log('📝 Teacher update message - NOT counting as attempt');
      const newAlert = {
        id: Date.now(),
        message: alertData.message,
        timestamp: new Date().toLocaleTimeString(),
        type: 'info',
        severity: 'low'
      };
      
      setProctoringAlerts(prev => [newAlert, ...prev.slice(0, 19)]);
      return;
    }
    
    const isLikelyFalsePositive = alertData.message && (
      alertData.message.includes('gaze_deviation') && 
      !alertData.message.includes('sustained')
    );
    
    if (isLikelyFalsePositive) {
      console.log('🔍 Likely false positive - ignoring:', alertData.message);
      return;
    }
    
    const isAlertTypeEnabled = (detectionType) => {
      const settingMap = {
        'audio_detection': teacherDetectionSettings.audioDetection,
        'suspicious_gesture': teacherDetectionSettings.handGestureDetection,
        'tab_switching': teacherDetectionSettings.tabSwitchDetection,
        'screenshot_attempt': teacherDetectionSettings.screenshotDetection,
        'screenshot_tool_detected': teacherDetectionSettings.screenshotDetection,
        'gaze_deviation': teacherDetectionSettings.gazeDetection,
        'phone_usage': teacherDetectionSettings.phoneDetection,
        'multiple_people': teacherDetectionSettings.multiplePeopleDetection,
        'mouth_movement': teacherDetectionSettings.mouthDetection
      };
      
      return settingMap[detectionType] !== false;
    };
    
    const detectionType = alertData.detectionType;
    if (detectionType && !isAlertTypeEnabled(detectionType)) {
      console.log(`🛑 Alert type ${detectionType} disabled by teacher - ignoring`);
      return;
    }
    
      const shouldCountAsAttempt = detectionType && [
        'multiple_people', 'audio_detection',
        'tab_switching', 'suspicious_gesture', 'speaking_detected',
        'no_face_detected',  // ✅ ADD THIS LINE
        'low_attention_score' // ✅ ADD THIS LINE
    ].includes(detectionType);
    
    if (shouldCountAsAttempt) {
      setStudentAttempts(prev => {
        const newAttempts = prev.currentAttempts + 1;
        const attemptsLeft = Math.max(0, prev.maxAttempts - newAttempts);
        
        const updated = {
          ...prev,
          currentAttempts: newAttempts,
          attemptsLeft: attemptsLeft,
          history: [
            ...prev.history,
            {
              timestamp: new Date().toISOString(),
              violation: detectionType,
              message: alertData.message,
              attemptsLeft: attemptsLeft
            }
          ].slice(-10)
        };
        
        if (attemptsLeft <= 3 && attemptsLeft > 0) {
          alert(`⚠️ Warning: Only ${attemptsLeft} attempt(s) left!`);
        }
        
        if (attemptsLeft <= 0) {
          alert('❌ You have been disconnected due to excessive violations.');
          setTimeout(() => {
            navigate('/dashboard');
          }, 3000);
        }
        
        return updated;
      });
    }
    
    const newAlert = {
      id: Date.now(),
      message: alertData.message || 'Suspicious activity detected',
      timestamp: new Date().toLocaleTimeString(),
      type: alertData.type || 'warning',
      severity: alertData.severity || 'medium',
      detectionType: detectionType
    };
    
    setProctoringAlerts(prev => [newAlert, ...prev.slice(0, 19)]);
  }, [navigate, teacherDetectionSettings]);

  // ==================== MICROPHONE STATE HANDLER ====================
  const handleMicrophoneStateChange = useCallback((isActive) => {
    setMicrophoneActive(isActive);
    if (!isActive && requiresMicrophone) {
      setProctoringAlerts(prev => [{
        id: Date.now(),
        message: '🎤 Microphone muted - Audio monitoring paused',
        timestamp: new Date().toLocaleTimeString(),
        type: 'warning'
      }, ...prev.slice(0, 4)]);
    }
  }, [requiresMicrophone]);

  // ==================== CAMERA STATE HANDLER ====================
  const handleCameraStateChange = useCallback((isActive) => {
    setCameraActive(isActive);
    if (!isActive && requiresCamera) {
      setProctoringAlerts(prev => [{
        id: Date.now(),
        message: '⚠️ Camera disconnected - Monitoring paused',
        timestamp: new Date().toLocaleTimeString(),
        type: 'warning'
      }, ...prev.slice(0, 4)]);
    }
  }, [requiresCamera]);

  // ==================== CHAT FUNCTIONS ====================
  const handleChatMessage = useCallback((data) => {
    console.log('💬 Student received chat message:', data);
    
    if (!data.message) {
      console.error('❌ Invalid chat message format:', data);
      return;
    }

    const newMessage = {
      id: data.message.id || Date.now().toString(),
      text: data.message.text,
      sender: data.message.sender,
      senderName: data.message.senderName || 'Teacher',
      timestamp: new Date(data.message.timestamp || Date.now()),
      type: data.message.type || 'teacher'
    };
    
    console.log('💾 Adding message to student state:', newMessage);
    
    setMessages(prev => {
      const updatedMessages = [...prev, newMessage];
      console.log('📝 Student messages count:', updatedMessages.length);
      return updatedMessages;
    });
    
    if (!showChat) {
      setUnreadCount(prev => prev + 1);
    }
  }, [showChat]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socketRef.current) return;

    const messageData = {
      id: Date.now().toString(),
      text: newMessage.trim(),
      sender: 'student',
      senderName: 'Student',
      timestamp: new Date(),
      type: 'student'
    };

    socketRef.current.emit('send-chat-message', {
      roomId: `exam-${examId}`,
      message: messageData
    });

    setNewMessage('');

    console.log('📤 Student sent message:', messageData);
  };

  const toggleChat = () => {
    setShowChat(prev => {
      if (!prev) {
        setUnreadCount(0);
      }
      return !prev;
    });
  };

  // ==================== UTILITY FUNCTIONS ====================
  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return '00:00';
    
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  };

  // ==================== INITIALIZATION ====================
  useEffect(() => {
    if (examId) {
      loadQuiz();
    }
  }, [examId, loadQuiz]);

  // ==================== RENDER FUNCTIONS ====================
  const progressPercentage = (answeredCount / (quiz?.questions?.length || 1)) * 100;

  // Show permission check first
  if (!examStarted) {
    return (
      <WaitingRoomComponent 
        requiresCamera={requiresCamera}
        requiresMicrophone={requiresMicrophone}
        onExamStarted={handleExamStart}
        onCancel={handleCancelExam}
        examTitle={examTitle}
        className={className}
        teacherDetectionSettings={teacherDetectionSettings}
      />
    );
  }

  // Add this check after permissions are granted but before exam starts
  if (permissionsGranted && !examStarted) {
    return (
      <div className="ready-waiting-room">
        <div className="ready-waiting-content">
          <div className="waiting-header">
            <h2>✅ Ready for Exam</h2>
            <p>All systems are ready. Waiting for teacher to start the exam...</p>
          </div>
          
          <div className="system-status">
            <div className="status-item">
              <span className="status-icon">📹</span>
              <span className="status-text">Camera: {cameraActive ? 'Ready' : 'Checking...'}</span>
            </div>
            <div className="status-item">
              <span className="status-icon">🎤</span>
              <span className="status-text">Microphone: {microphoneActive ? 'Ready' : 'Checking...'}</span>
            </div>
            <div className="status-item">
              <span className="status-icon">🔍</span>
              <span className="status-text">Proctoring: Active</span>
            </div>
          </div>

          <div className="waiting-rules">
            <h4>Important Rules:</h4>
            <ul>
              <li>❌ Do not switch tabs or open new windows</li>
              <li>❌ Do not use mobile phones or other devices</li>
              <li>❌ Do not talk to other people</li>
              <li>✅ Keep your face visible to the camera</li>
              <li>✅ Stay in the frame throughout the exam</li>
            </ul>
          </div>

          <div className="loading-waiting">
            <div className="pulse-animation"></div>
            <p>Standing by for exam start signal...</p>
          </div>

          <button className="cancel-btn" onClick={handleCancelExam}>
            ← Leave Exam
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="quiz-loading">
        <div className="loading-spinner"></div>
        <p>Loading quiz...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="quiz-error">
        <h2>❌ Error Loading Quiz</h2>
        <p>{error}</p>
        <div className="error-actions">
          <button onClick={loadQuiz} className="retry-btn">
            🔄 Try Again
          </button>
          <button onClick={() => navigate('/dashboard')} className="back-btn">
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Quiz not found state
  if (!quiz) {
    return (
      <div className="quiz-error">
        <h2>❌ Quiz Not Found</h2>
        <p>The quiz you're trying to access is not available or has been removed.</p>
        <button onClick={() => navigate('/dashboard')} className="back-btn">
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  // ==================== MAIN RENDER ====================
  return (
    <div className={`student-quiz-container ${requiresCamera || requiresMicrophone ? 'exam-mode' : 'quiz-mode'}`}>
      
      <HeaderAlerts alerts={proctoringAlerts} />

      <div className="quiz-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>
            ← Back to Dashboard
          </button>
          <div className="quiz-info">
            <h1 className="class-info">Class: {className}</h1>
            <div className="quiz-meta">
              {/* Quiz meta information */}
            </div>
          </div>
        </div>
        <div className="header-right">
          {/* ✅ ATTEMPTS DISPLAY */}
<div className="attempts-display-student">
    <span className="attempts-text">
        Attempts: {studentAttempts.attemptsLeft}/{studentAttempts.maxAttempts}
    </span>
    <span className="attempts-used">
        Used: {studentAttempts.currentAttempts.toFixed(1)}
    </span>
    {studentAttempts.attemptsLeft <= 3 && studentAttempts.attemptsLeft > 0 && (
        <span className="attempts-warning">
            ⚠️ {studentAttempts.attemptsLeft} attempt(s) left!
        </span>
    )}
    {studentAttempts.attemptsLeft === 0 && (
        <span className="attempts-danger">
            🚫 No attempts left!
        </span>
    )}
</div>

          {/* ✅ TIMER DISPLAY - SYNCED WITH TEACHER */}
          <div className="timer-section-student">
            <div className="timer-display-student">
              <span className="timer-text">
                {timeLeft !== null ? formatTime(timeLeft) : 'Loading...'}
              </span>
            </div>
          </div>

          {(requiresCamera || requiresMicrophone) && (
            <div className="monitoring-status-header">
              {requiresCamera && (
                <span className={`camera-indicator ${cameraActive ? 'active' : 'inactive'}`}>
                  {cameraActive ? '' : ''}
                </span>
              )}
              {requiresMicrophone && (
                <span className={`microphone-indicator ${microphoneActive ? 'active' : 'inactive'}`}>
                  {microphoneActive ? '' : ''}
                </span>
              )}
              {isSharingCamera && (
                <span className="sharing-indicator">
                  
                </span>
              )}
              {proctoringAlerts.length > 0 && (
                <button 
                  className={`alert-count-btn ${proctoringAlerts.length > 0 ? 'has-alerts' : ''}`}
                  onClick={() => setShowAlertsPanel(!showAlertsPanel)}
                >
                  🚨 Alerts: {proctoringAlerts.length}
                </button>
              )}
            </div>
          )}
          
          {/* Chat Toggle Button */}
          <button 
            className={`chat-toggle-btn ${unreadCount > 0 ? 'has-unread' : ''}`}
            onClick={toggleChat}
          >
            💬 Chat
            {unreadCount > 0 && (
              <span className="unread-badge">{unreadCount}</span>
            )}
          </button>
        </div>
      </div>
      
      {/* Camera Sharing Status Indicator */}
      {cameraRequested && (
        <div className="camera-sharing-status">
          <div className={`sharing-indicator ${isSharingCamera ? 'active' : 'denied'}`}>
            <span className="sharing-icon">
              {isSharingCamera ? '📹' : '📹❌'}
            </span>
            <span className="sharing-text">
              {isSharingCamera ? 'Camera shared with teacher' : 'Camera access denied'}
            </span>
          </div>
        </div>
      )}

      {/* Proctoring Alerts Panel */}
      <ProctoringAlertsPanel 
        alerts={proctoringAlerts}
        isOpen={showAlertsPanel}
        onToggle={() => setShowAlertsPanel(!showAlertsPanel)}
      />

      {/* ✅ USE SYNCED TIMER INSTEAD OF LOCAL TIMER */}
      <div className="quiz-progress">
        <div className="progress-info">
          <span className="progress-text">
            Answered: {answeredCount} / {quiz.questions?.length || 0}
          </span>
          {timeLeft !== null && (
            <span className="time-remaining">
              Time Left: {formatTime(timeLeft)}
            </span>
          )}
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      <div className="quiz-content">
        <div className="quiz-questions">
          {quiz.questions?.map((question, index) => (
            <div key={`question-${examId}-${index}`} className="question-card">
              <div className="question-header">
                <h3>Question {index + 1}</h3>
                <div className="question-meta">
                  {question.points > 0 && (
                    <span className="points-badge">{question.points} points</span>
                  )}
                  <span className="question-type">{question.type}</span>
                </div>
              </div>
              <div className="question-content">
                <p className="question-text">{question.title}</p>
                
                {question.description && (
                  <p className="question-description">{question.description}</p>
                )}
                
                {/* Multiple Choice Questions */}
                {question.type === 'multiple-choice' && question.options && (
                  <div className="options-list">
                    {question.options.map((option, optIndex) => (
                      <label key={`option-${index}-${optIndex}`} className="option-label">
                        <input 
                          type="radio" 
                          name={`question-${index}`} 
                          value={option}
                          onChange={(e) => handleAnswerChange(index, e.target.value)}
                          checked={answers[index] === option}
                        />
                        <span className="option-text">{option}</span>
                      </label>
                    ))}
                  </div>
                )}
                
                {/* Checkbox Questions */}
                {question.type === 'checkboxes' && question.options && (
                  <div className="options-list">
                    {question.options.map((option, optIndex) => (
                      <label key={`option-${index}-${optIndex}`} className="option-label">
                        <input 
                          type="checkbox" 
                          value={option}
                          onChange={(e) => handleCheckboxChange(index, option, e.target.checked)}
                          checked={Array.isArray(answers[index]) ? answers[index].includes(option) : false}
                        />
                        <span className="option-text">{option}</span>
                      </label>
                    ))}
                  </div>
                )}
                
                {/* Text Answer Questions */}
                {(question.type === 'short-answer' || question.type === 'paragraph') && (
                  <textarea
                    className="answer-textarea"
                    placeholder={question.type === 'short-answer' ? "Type your short answer here..." : "Type your detailed answer here..."}
                    rows={question.type === 'paragraph' ? 4 : 2}
                    value={answers[index] || ''}
                    onChange={(e) => handleAnswerChange(index, e.target.value)}
                  />
                )}
                
                {/* True/False Questions */}
                {question.type === 'true-false' && (
                  <div className="options-list">
                    <label className="option-label">
                      <input 
                        type="radio" 
                        name={`question-${index}`} 
                        value="true"
                        onChange={(e) => handleAnswerChange(index, e.target.value)}
                        checked={answers[index] === 'true'}
                      />
                      <span className="option-text">True</span>
                    </label>
                    <label className="option-label">
                      <input 
                        type="radio" 
                        name={`question-${index}`} 
                        value="false"
                        onChange={(e) => handleAnswerChange(index, e.target.value)}
                        checked={answers[index] === 'false'}
                      />
                      <span className="option-text">False</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="quiz-footer">
          <div className="footer-info">
            <span className="answered-count">
              {answeredCount} of {quiz.questions?.length || 0} questions answered
            </span>
            {/* ✅ USE SYNCED TIMER FOR WARNINGS */}
            {timeLeft !== null && timeLeft < 300 && (
              <span className="time-warning">
                ⚠️ {formatTime(timeLeft)} remaining
              </span>
            )}
          </div>
          <button 
            className={`submit-quiz-btn ${answeredCount === 0 ? 'disabled' : ''}`}
            onClick={() => handleSubmitQuiz(false)}
            disabled={submitting || answeredCount === 0}
          >
            {submitting ? (
              <>
                <div className="loading-spinner-small"></div>
                Submitting...
              </>
            ) : (
              `Submit Quiz ${answeredCount > 0 ? `(${answeredCount} answers)` : ''}`
            )}
          </button>
        </div>
      </div>

      {/* Microphone Component */}
      {requiresMicrophone && permissionsGranted && (
        <MicrophoneComponent 
          requiresMicrophone={requiresMicrophone}
          onMicrophoneStateChange={handleMicrophoneStateChange}
          onProctoringAlert={handleProctoringAlert}
          examId={examId}
        />
      )}

      {/* Camera Component for Exam Mode */}
      {requiresCamera && permissionsGranted && (
        <CameraComponent 
          requiresCamera={requiresCamera}
          onCameraStateChange={handleCameraStateChange}
          onProctoringAlert={handleProctoringAlert}
          examId={examId}
          teacherDetectionSettings={teacherDetectionSettings}
          socketRef={socketRef}
          tabSwitchCount={tabSwitchCount}
          windowBlurCount={windowBlurCount}
          microphoneActive={!micState.isMuted}
          isSpeaking={micState.isSpeaking}
        />
      )}

      {/* Chat Component */}
      <ChatComponent 
        messages={messages}
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        handleSendMessage={handleSendMessage}
        showChat={showChat}
        toggleChat={toggleChat}
        unreadCount={unreadCount}
      />
    </div>
  );
}