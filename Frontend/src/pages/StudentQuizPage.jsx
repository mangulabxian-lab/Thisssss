// StudentQuizPage.jsx - UPDATED & OPTIMIZED
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { getQuizForStudent, submitQuizAnswers } from '../lib/api';
import './StudentQuizPage.css';

// ==================== PERMISSION CHECK COMPONENT ====================
const PermissionCheckComponent = React.memo(({ 
  requiresCamera, 
  requiresMicrophone, 
  onPermissionsGranted,
  onCancel 
}) => {
  const [checkingPermissions, setCheckingPermissions] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState({
    camera: { granted: false, error: '' },
    microphone: { granted: false, error: '' }
  });
  const [retryCount, setRetryCount] = useState(0);

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

      // Check microphone permission
      if (requiresMicrophone) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ 
            audio: true 
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
      
      // Auto-proceed if all required permissions are granted
      const allGranted = 
        (!requiresCamera || newStatus.camera.granted) && 
        (!requiresMicrophone || newStatus.microphone.granted);
      
      if (allGranted) {
        setTimeout(() => onPermissionsGranted(), 500);
      }
      
    } catch (error) {
      console.error('Permission check error:', error);
    } finally {
      setCheckingPermissions(false);
    }
  }, [requiresCamera, requiresMicrophone, onPermissionsGranted]);

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

  const handleManualProceed = () => {
    const userConfirmed = window.confirm(
      '⚠️ Without camera/microphone access, your exam may be flagged or invalidated. Continue anyway?'
    );
    if (userConfirmed) {
      onPermissionsGranted();
    }
  };

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  const allRequiredGranted = 
    (!requiresCamera || permissionStatus.camera.granted) && 
    (!requiresMicrophone || permissionStatus.microphone.granted);

  return (
    <div className="permission-check-overlay">
      <div className="permission-check-modal">
        <div className="permission-header">
          <h2>📋 Exam Requirements Check</h2>
          <p>This exam requires the following permissions:</p>
        </div>

        <div className="permission-requirements">
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
            <div className={`requirement-item ${permissionStatus.microphone.granted ? 'granted' : 'denied'}`}>
              <div className="requirement-icon">
                {permissionStatus.microphone.granted ? '✅' : '❌'}
              </div>
              <div className="requirement-content">
                <h4>Microphone Access</h4>
                <p>Required for audio monitoring</p>
                {!permissionStatus.microphone.granted && permissionStatus.microphone.error && (
                  <div className="error-message">{permissionStatus.microphone.error}</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="permission-instructions">
          <h4>How to enable permissions:</h4>
          <ul>
            <li>Click the camera/microphone icon in your browser's address bar</li>
            <li>Select "Allow" for camera and microphone access</li>
            <li>Refresh the page and try again</li>
          </ul>
        </div>

        <div className="permission-actions">
          {checkingPermissions ? (
            <div className="checking-permissions">
              <div className="loading-spinner"></div>
              <span>Checking permissions...</span>
            </div>
          ) : (
            <>
              {allRequiredGranted ? (
                <button className="start-quiz-btn" onClick={() => onPermissionsGranted()}>
                  🚀 Start Exam
                </button>
              ) : (
                <div className="action-buttons">
                  <button className="retry-btn" onClick={handleRetry}>
                    🔄 Retry Permission Check
                  </button>
                  <button className="manual-proceed-btn" onClick={handleManualProceed}>
                    ⚠️ Continue Anyway
                  </button>
                </div>
              )}
              <button className="cancel-btn" onClick={onCancel}>
                ← Back to Dashboard
              </button>
            </>
          )}
        </div>

        {retryCount > 0 && (
          <div className="retry-hint">
            <p>💡 <strong>Still having issues?</strong></p>
            <ul>
              <li>Check if your camera/microphone is being used by another application</li>
              <li>Try using a different browser (Chrome recommended)</li>
              <li>Ensure your browser is up to date</li>
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
          autoGainControl: true
        }
      });
      
      streamRef.current = stream;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(1024, 1, 1);
      processorRef.current = processor;
      
      let lastAudioSend = 0;
      
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
        const isCurrentlySpeaking = level > 10;
        if (isCurrentlySpeaking !== micState.isSpeaking) {
          setMicState(prev => ({ ...prev, isSpeaking: isCurrentlySpeaking }));
        }

        // Send to backend every 3 seconds
        if (Date.now() - lastAudioSend > 3000) {
          const buffer = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            buffer[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
          }
          
          const audioBlob = new Blob([buffer], { type: 'audio/wav' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = () => {
            fetch('http://localhost:5000/process_audio', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audio: reader.result,
                exam_id: examId,
                student_id: 'student-user'
              })
            }).catch(error => {
              console.error('Audio send error:', error);
            });
          };
          lastAudioSend = Date.now();
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
  }, [requiresMicrophone, examId, onMicrophoneStateChange, micState.isConnected, micState.isMuted]);

  const initializeMicrophone = useCallback(async () => {
    if (!requiresMicrophone) return;

    try {
      setMicState(prev => ({ ...prev, isInitializing: true, error: '' }));

      // Clean up existing streams
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

      // Check microphone availability
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
      // Muting - stop audio capture
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
      // Unmuting - start audio capture
      setMicState(prev => ({ ...prev, isMuted: false, isConnected: true }));
      onMicrophoneStateChange?.(true);
      await captureAudio();
    }
  };

  const retryMicrophone = async () => {
    await initializeMicrophone();
  };

  // Audio level animation
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
      // Cleanup on unmount
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
  examId
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
      
      const response = await fetch('http://localhost:5000/detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageData,
          exam_id: examId,
          student_id: 'student-user',
          timestamp: new Date().toISOString()
        })
      });
      
      if (response.ok) {
        const results = await response.json();
        console.log('📊 Proctoring results:', results);
        
        if (results.suspiciousActivities && results.suspiciousActivities.length > 0) {
          results.suspiciousActivities.forEach(activity => {
            onProctoringAlert({
              message: activity,
              type: activity.includes('phone') || activity.includes('Multiple') ? 'danger' : 'warning',
              severity: activity.includes('phone') || activity.includes('Multiple') ? 'high' : 'medium',
              timestamp: new Date().toLocaleTimeString()
            });
          });
        }
        
        if (results.attentionScore < 70) {
          onProctoringAlert({
            message: `Low attention score: ${results.attentionScore}% - Focus on your exam`,
            type: 'warning',
            severity: 'medium',
            timestamp: new Date().toLocaleTimeString()
          });
        }
      }
    } catch (error) {
      console.error('Proctoring capture error:', error);
    }
  }, [requiresCamera, examId, onProctoringAlert, cameraState.isConnected, camOn]);
  
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
    // Add exposure compensation
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
        <div key={alert.id} className={`alert-text ${alert.type || 'warning'}`}>
          {alert.message}
        </div>
      ))}
    </div>
  );
});

// ==================== PROCTORING ALERTS PANEL ====================
const ProctoringAlertsPanel = React.memo(({ alerts, isOpen, onToggle }) => {
  if (!isOpen) return null;

  return (
    <div className="proctoring-alerts-panel">
      <div className="alerts-panel-header">
        <h3>📊 Proctoring Alerts</h3>
        <button className="close-alerts-btn" onClick={onToggle}>✕</button>
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
                {alert.type === 'warning' ? '⚠️' : 
                 alert.type === 'danger' ? '🚨' : 'ℹ️'}
              </div>
              <div className="alert-content">
                <div className="alert-message">{alert.message}</div>
                <div className="alert-time">{alert.timestamp}</div>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="alerts-summary">
        <span className="total-alerts">Total Alerts: {alerts.length}</span>
        {alerts.length > 0 && (
          <span className="latest-alert">
            Latest: {alerts[0]?.timestamp}
          </span>
        )}
      </div>
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

  // Quiz State Management
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(null);

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

  // Refs
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);

  // ==================== PERMISSION HANDLERS ====================
  const handlePermissionsGranted = useCallback(() => {
    setPermissionsGranted(true);
    if (requiresCamera) setCameraActive(true);
    if (requiresMicrophone) setMicrophoneActive(true);
  }, [requiresCamera, requiresMicrophone]);

  const handleCancelExam = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  // ==================== SOCKET.IO SETUP ====================
  useEffect(() => {
    if (!permissionsGranted) return;

    const token = localStorage.getItem('token');
    
    if (!token) {
      console.error('❌ No token available for socket connection');
      return;
    }

    if (socketRef.current && socketRef.current.connected) {
      console.log('✅ Socket already connected, skipping reconnection');
      return;
    }

    console.log('🔑 Connecting student socket...');

    const newSocket = io('http://localhost:3000', {
      auth: { 
        token: token 
      },
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
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Student Socket connection failed:', error);
    });

    // WebRTC Event Listeners
    newSocket.on('camera-request', handleCameraRequest);
    newSocket.on('webrtc-answer', handleWebRTCAnswer);
    newSocket.on('ice-candidate', handleICECandidate);
    
    // PROCTORING ALERTS LISTENER
    newSocket.on('proctoring-alert', handleProctoringAlert);

    socketRef.current = newSocket;

    return () => {
      console.log('🛑 Cleaning up student socket');
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [examId, permissionsGranted]);

  // ==================== WEBRTC HANDLERS ====================
  const handleCameraRequest = async (data, isRetry = false) => {
    console.log('📹 Camera request from teacher:', data);
    setCameraRequested(true);
    setTeacherSocketId(data.from);
    
    try {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24 },
          facingMode: 'user'
        }, 
        audio: false 
      });
      
      console.log('🎥 Camera accessed successfully');
     // After getting the stream
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
            target: data.from,
            candidate: event.candidate
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('🔗 Student WebRTC state:', pc.connectionState);
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('✅ Created local offer');

      if (socketRef.current) {
        socketRef.current.emit('webrtc-offer', {
          target: data.from,
          offer: offer
        });
        console.log('✅ Sent WebRTC offer to teacher');
      }

      setPeerConnection(pc);

    } catch (error) {
      console.error('❌ Error accessing camera:', error);
      setIsSharingCamera(false);
      setCameraActive(false);
      
      if (socketRef.current) {
        socketRef.current.emit('camera-response', {
          teacherSocketId: data.from,
          enabled: false
        });
      }
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
    console.log('🚨 Received proctoring alert:', alertData);
    
    const newAlert = {
      id: Date.now(),
      message: alertData.message || 'Suspicious activity detected',
      timestamp: new Date().toLocaleTimeString(),
      type: alertData.type || 'warning',
      severity: alertData.severity || 'medium'
    };
    
    setProctoringAlerts(prev => {
      if (prev.some(a => a.message === newAlert.message && 
          (Date.now() - a.id) < 5000)) {
        return prev;
      }
      
      const updatedAlerts = [newAlert, ...prev.slice(0, 19)];
      return updatedAlerts;
    });

    if (alertData.severity === 'high') {
      setShowAlertsPanel(true);
    }
  }, []);

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

        if (response.data.duration) {
          setTimeRemaining(response.data.duration * 60);
        }
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

  const handleSubmitQuiz = async () => {
    if (!window.confirm('Are you sure you want to submit your answers?')) return;
    
    // Camera and microphone check for exam mode
    if ((requiresCamera && !cameraActive) || (requiresMicrophone && !microphoneActive)) {
      const proceed = window.confirm(
        'Monitoring is not fully active. This may be reported to your instructor. Continue with submission?'
      );
      if (!proceed) return;
    }

    setSubmitting(true);
    try {
      const submissionResponse = await submitQuizAnswers(examId, answers);
      
      if (submissionResponse.success) {
        alert('✅ Answers submitted successfully!');
        
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
        }
        if (peerConnection) {
          peerConnection.close();
        }
        
        navigate('/dashboard');
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

  // ==================== TIMER MANAGEMENT ====================
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  if ((requiresCamera || requiresMicrophone) && !permissionsGranted) {
    return (
      <PermissionCheckComponent 
        requiresCamera={requiresCamera}
        requiresMicrophone={requiresMicrophone}
        onPermissionsGranted={handlePermissionsGranted}
        onCancel={handleCancelExam}
      />
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
            <h1>{quiz.title || examTitle}</h1>
            <p className="class-info">Class: {className}</p>
            <div className="quiz-meta">
              <span>{quiz.questions?.length || 0} questions</span>
              {quiz.totalPoints > 0 && (
                <span>Total points: {quiz.totalPoints}</span>
              )}
              {timeRemaining !== null && (
                <span className="timer">Time: {formatTime(timeRemaining)}</span>
              )}
            </div>
          </div>
        </div>
        
        {(requiresCamera || requiresMicrophone) && (
          <div className="monitoring-status-header">
            {requiresCamera && (
              <span className={`camera-indicator ${cameraActive ? 'active' : 'inactive'}`}>
                {cameraActive ? '📹 Live' : '📹 Off'}
              </span>
            )}
            {requiresMicrophone && (
              <span className={`microphone-indicator ${microphoneActive ? 'active' : 'inactive'}`}>
                {microphoneActive ? '🎤 Live' : '🎤 Muted'}
              </span>
            )}
            {isSharingCamera && (
              <span className="sharing-indicator">
                🔄 Sharing with Teacher
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

      <div className="quiz-progress">
        <div className="progress-info">
          <span className="progress-text">
            Answered: {answeredCount} / {quiz.questions?.length || 0}
          </span>
          {timeRemaining !== null && (
            <span className="time-remaining">
              Time Left: {formatTime(timeRemaining)}
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
            {timeRemaining !== null && timeRemaining < 300 && (
              <span className="time-warning">
                ⚠️ {formatTime(timeRemaining)} remaining
              </span>
            )}
          </div>
          <button 
            className={`submit-quiz-btn ${answeredCount === 0 ? 'disabled' : ''}`}
            onClick={handleSubmitQuiz}
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

      {/* ✅ ADD MICROPHONE COMPONENT HERE - BEFORE CAMERA */}
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
        />
      )}
    </div>
  );
}