
// /Frontend/src/components/StudentExamCamera.jsx - SIMPLIFIED VERSION
import React, { useEffect, useRef, useState } from 'react';
import cameraManager from '../lib/cameraManager';
import './StudentExamCamera.css';

const StudentExamCamera = ({ examId, isRequired = true }) => {
  const videoRef = useRef(null);
  const [cameraState, setCameraState] = useState({
    isActive: false,
    error: '',
    permissionGranted: false,
    debugInfo: 'Initializing...'
  });

  // Initialize camera
  useEffect(() => {
    console.log('🚀 [DEBUG] StudentExamCamera mounting');
    console.log('🔍 [DEBUG] examId:', examId);
    console.log('🔍 [DEBUG] isRequired:', isRequired);
    
    if (!isRequired) {
      console.log('📹 [DEBUG] Camera not required, skipping');
      return;
    }
    
    let mounted = true;
    
    const initCamera = async () => {
      try {
        console.log('🎥 [DEBUG] Starting camera initialization...');
        setCameraState({
          isActive: false,
          error: '',
          permissionGranted: false,
          debugInfo: 'Requesting camera access...'
        });
        
        // Check if camera API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera API not supported in this browser');
        }
        
        // Get camera stream through manager
        const stream = await cameraManager.initializeCamera();
        
        console.log('✅ [DEBUG] Camera stream obtained');
        
        if (mounted && videoRef.current) {
          console.log('📹 [DEBUG] Video element found, attaching...');
          
          // Attach stream to our video element
          const attached = cameraManager.attachVideoElement(videoRef.current);
          
          if (attached) {
            console.log('✅ [DEBUG] Camera attached successfully');
            
            // Force video display
            setTimeout(() => {
              if (videoRef.current && mounted) {
                videoRef.current.style.display = 'block';
                videoRef.current.play().catch(e => {
                  console.warn('⚠️ [DEBUG] Auto-play prevented:', e.message);
                });
              }
            }, 100);
            
            setCameraState({
              isActive: true,
              error: '',
              permissionGranted: true,
              debugInfo: 'Camera active and streaming'
            });
          } else {
            console.error('❌ [DEBUG] Failed to attach camera');
            setCameraState({
              isActive: false,
              error: 'Failed to attach camera to video element',
              permissionGranted: false,
              debugInfo: 'Camera stream obtained but not attached'
            });
          }
        }
        
      } catch (error) {
        console.error('❌ [DEBUG] Camera initialization failed:', error);
        
        if (mounted) {
          let errorMessage = error.message;
          
          if (error.name === 'NotAllowedError') {
            errorMessage = 'Camera permission denied. Please allow camera access.';
          } else if (error.name === 'NotFoundError') {
            errorMessage = 'No camera found. Please connect a camera.';
          } else if (error.name === 'NotReadableError') {
            errorMessage = 'Camera is in use by another application.';
          }
          
          setCameraState({
            isActive: false,
            error: errorMessage,
            permissionGranted: false,
            debugInfo: `Error: ${error.name} - ${error.message}`
          });
        }
      }
    };

    // Start initialization with a small delay
    const initTimer = setTimeout(() => {
      initCamera();
    }, 100);

    // Cleanup
    return () => {
      console.log('🧹 [DEBUG] StudentExamCamera cleanup');
      mounted = false;
      clearTimeout(initTimer);
      
      // Detach our video element from manager
      if (videoRef.current) {
        cameraManager.detachVideoElement(videoRef.current);
      }
    };
  }, [isRequired, examId]);

  // Force video to play when component is mounted
  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && cameraState.isActive) {
      const tryPlay = () => {
        videoEl.play().catch(e => {
          console.warn('⚠️ [DEBUG] Video play failed, trying again on click:', e.message);
          // Try again on user interaction
          document.addEventListener('click', () => {
            videoEl.play().catch(e => console.warn('Still blocked:', e.message));
          }, { once: true });
        });
      };
      
      setTimeout(tryPlay, 300);
    }
  }, [cameraState.isActive]);

  const retryCamera = async () => {
    console.log('🔄 [DEBUG] Retrying camera...');
    try {
      setCameraState({
        isActive: false,
        error: '',
        permissionGranted: false,
        debugInfo: 'Retrying camera access...'
      });
      
      // Clean up and retry
      cameraManager.cleanup();
      
      // Small delay before retry
      setTimeout(async () => {
        try {
          await cameraManager.initializeCamera();
          
          if (videoRef.current) {
            cameraManager.attachVideoElement(videoRef.current);
            setCameraState({
              isActive: true,
              error: '',
              permissionGranted: true,
              debugInfo: 'Camera retry successful'
            });
          }
        } catch (error) {
          console.error('❌ [DEBUG] Camera retry failed:', error);
          setCameraState(prev => ({
            ...prev,
            error: error.message,
            debugInfo: `Retry failed: ${error.name}`
          }));
        }
      }, 500);
      
    } catch (error) {
      console.error('❌ [DEBUG] Retry error:', error);
      setCameraState(prev => ({
        ...prev,
        error: error.message,
        debugInfo: `Retry error: ${error.name}`
      }));
    }
  };

  const openCameraSettings = () => {
    alert('📸 Camera Permission Help:\n\n' +
          '1. Look for a camera icon in your browser address bar\n' +
          '2. Click it and select "Allow" or "Always allow"\n' +
          '3. Refresh this page\n\n' +
          'Or go to browser settings:\n' +
          'Chrome: chrome://settings/content/camera\n' +
          'Edge: edge://settings/content/camera\n' +
          'Firefox: about:preferences#privacy');
  };

  return (
    <div className="student-exam-camera">
      <div className="camera-header">
        <div className="camera-status">
          <span className={`status-indicator ${cameraState.isActive ? 'active' : 'inactive'}`}>
            {cameraState.isActive ? '●' : '○'}
          </span>
          <span className="status-text">
            {cameraState.isActive ? '📹 Camera Active' : '📹 Camera Off'}
          </span>
        </div>
        
        {!cameraState.isActive && (
          <div className="camera-actions">
            <button onClick={retryCamera} className="retry-camera-btn">
              🔄 Retry
            </button>
            <button onClick={openCameraSettings} className="settings-camera-btn">
              ⚙️ Settings
            </button>
          </div>
        )}
      </div>

      <div className="camera-preview">
        {/* VIDEO ELEMENT - THIS MUST BE VISIBLE */}
        <video 
          ref={videoRef}
          autoPlay 
          muted 
          playsInline
          className="camera-video"
          style={{ 
            display: cameraState.isActive ? 'block' : 'none',
            transform: 'scaleX(-1)',
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
        
        {/* OFFLINE/ERROR STATE */}
        {!cameraState.isActive && (
          <div className="camera-offline">
            <div className="offline-icon">
              {cameraState.error.includes('permission') ? '🔒' : '📷❌'}
            </div>
            <h4>Camera Required</h4>
            <p>{cameraState.error || 'Camera access is required for this exam'}</p>
            
            <button onClick={retryCamera} className="enable-camera-btn">
              {cameraState.error.includes('permission') ? '🔓 Grant Permission' : '📸 Enable Camera'}
            </button>
            
            {/* DEBUG INFO */}
            <div className="debug-info">
              <small>{cameraState.debugInfo}</small>
              <small>Browser: {navigator.userAgent}</small>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentExamCamera;