import React, { useEffect, useRef, useState } from 'react';
import cameraManager from '../lib/cameraManager';
import './StudentExamCamera.css';

const StudentExamCamera = ({ examId, isRequired = true }) => {
  const videoRef = useRef(null);
  const [cameraState, setCameraState] = useState({
    isActive: false,
    isInitialized: false,
    error: '',
    permissionGranted: false,
    debugInfo: ''
  });

  // Initialize camera ONCE
  useEffect(() => {
    console.log('🚀 [DEBUG] StudentExamCamera mounting');
    console.log('🔍 [DEBUG] examId:', examId);
    console.log('🔍 [DEBUG] isRequired:', isRequired);
    
    let mounted = true;

    const initCamera = async () => {
      if (!isRequired || !mounted) return;

      try {
        console.log('🎥 [DEBUG] Initializing camera...');
        setCameraState(prev => ({ 
          ...prev, 
          error: '', 
          isInitialized: false,
          debugInfo: 'Starting camera initialization...'
        }));
        
        // Initialize camera through manager
        await cameraManager.initializeCamera();
        
        console.log('✅ [DEBUG] Camera manager initialized');
        
        // Attach video element
        if (mounted && videoRef.current) {
          console.log('📹 [DEBUG] Video element available, attaching...');
          const attached = cameraManager.attachVideoElement(videoRef.current);
          
          if (attached) {
            setCameraState({
              isActive: true,
              isInitialized: true,
              error: '',
              permissionGranted: true,
              debugInfo: 'Camera attached and streaming'
            });
            console.log('✅ [DEBUG] Camera attached successfully');
          } else {
            setCameraState({
              isActive: false,
              isInitialized: true,
              error: 'Failed to attach camera to video element',
              permissionGranted: false,
              debugInfo: 'Camera initialized but not attached to video'
            });
          }
        } else {
          setCameraState({
            isActive: false,
            isInitialized: true,
            error: 'Video element not available',
            permissionGranted: false,
            debugInfo: 'Video ref is null'
          });
        }
        
      } catch (error) {
        console.error('❌ [DEBUG] Camera init error:', error);
        if (mounted) {
          setCameraState({
            isActive: false,
            isInitialized: true,
            error: error.message,
            permissionGranted: false,
            debugInfo: `Error: ${error.name} - ${error.message}`
          });
        }
      }
    };

    // Start camera with delay
    const timer = setTimeout(() => {
      console.log('⏰ [DEBUG] Starting camera initialization timer');
      initCamera();
    }, 500);

    // Cleanup
    return () => {
      console.log('🧹 [DEBUG] StudentExamCamera cleanup');
      mounted = false;
      clearTimeout(timer);
      
      // Detach only our video element
      if (videoRef.current) {
        cameraManager.detachVideoElement(videoRef.current);
      }
    };
  }, [isRequired, examId]);

  // Force camera display
  useEffect(() => {
    // Force camera display
    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.style.display = 'block';
      videoEl.style.width = '100%';
      videoEl.style.height = '240px';
      videoEl.style.backgroundColor = '#000';
    }
  }, []);

  const retryCamera = async () => {
    console.log('🔄 [DEBUG] Retrying camera...');
    try {
      setCameraState(prev => ({ 
        ...prev, 
        error: '',
        debugInfo: 'Retrying camera access...'
      }));
      
      await cameraManager.initializeCamera();
      
      if (videoRef.current) {
        cameraManager.attachVideoElement(videoRef.current);
        setCameraState({
          isActive: true,
          isInitialized: true,
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
  };

  const openCameraSettings = () => {
    // Guide user to camera settings
    alert('📸 Camera Permission Help:\n\n' +
          '1. Click the camera icon in your browser address bar\n' +
          '2. Select "Always allow" or "Allow" for camera\n' +
          '3. Refresh this page\n\n' +
          'Or go to: chrome://settings/content/camera');
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
        
        {!cameraState.isActive && cameraState.isInitialized && (
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
        
        {(!cameraState.isActive || !cameraState.permissionGranted) && (
          <div className="camera-offline">
            <div className="offline-icon">
              {cameraState.error.includes('permission') ? '🔒' : '📷'}
            </div>
            <h4>Camera Required</h4>
            <p>{cameraState.error || 'Camera access is required for this exam'}</p>
            
            {cameraState.error.includes('permission') ? (
              <>
                <button onClick={openCameraSettings} className="enable-camera-btn">
                  🔓 Open Camera Settings
                </button>
                <p className="help-text">Then refresh this page</p>
              </>
            ) : (
              <button onClick={retryCamera} className="enable-camera-btn">
                📸 Enable Camera
              </button>
            )}
            
            {/* Debug info (visible in development) */}
            {process.env.NODE_ENV === 'development' && (
              <div className="debug-info">
                <small>{cameraState.debugInfo}</small>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentExamCamera;