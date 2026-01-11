// /Frontend/src/lib/cameraManager.js - SIMPLIFIED FIXED VERSION
class CameraManager {
  constructor() {
    this.stream = null;
    this.videoElements = new Set();
    this.isInitialized = false;
    this.isCameraOn = true;
    this.lastError = null;
    this.pendingPromise = null; // To prevent multiple simultaneous requests
  }

  async initializeCamera() {
    console.log('🎥 [DEBUG] initializeCamera called');
    
    // If already have active stream, return it
    if (this.stream && this.stream.active) {
      console.log('✅ [DEBUG] Using existing active camera stream');
      this.attachToAllElements();
      return this.stream;
    }

    // If we're already trying to initialize, return the pending promise
    if (this.pendingPromise) {
      console.log('⏳ [DEBUG] Camera initialization already in progress');
      return this.pendingPromise;
    }

    try {
      // Create pending promise
      this.pendingPromise = this._getCameraStream();
      const stream = await this.pendingPromise;
      
      this.stream = stream;
      this.isInitialized = true;
      this.isCameraOn = true;
      this.lastError = null;
      
      console.log('✅ [DEBUG] Camera initialized successfully');
      console.log('📹 [DEBUG] Stream active:', stream.active);
      console.log('📹 [DEBUG] Video tracks:', stream.getVideoTracks().length);
      
      this.attachToAllElements();
      return stream;
      
    } catch (error) {
      console.error('❌ [DEBUG] Camera initialization failed:', error);
      this.stream = null;
      this.isInitialized = false;
      this.lastError = error;
      throw error;
    } finally {
      this.pendingPromise = null;
    }
  }

  async _getCameraStream() {
    console.log('🎥 [DEBUG] Requesting camera access...');
    
    try {
      // Clean up any existing stream
      this._cleanupStream();
      
      // Get available cameras first
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      console.log('📷 [DEBUG] Available cameras:', cameras.map(c => ({ id: c.deviceId, label: c.label })));

      if (cameras.length === 0) {
        throw new Error('No camera found on this device. Please connect a webcam.');
      }

      // Try with ideal constraints first
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      };

      console.log('🎯 [DEBUG] Requesting camera with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (!stream) {
        throw new Error('Camera stream is null');
      }
      
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        console.log('📹 [DEBUG] Camera settings:', settings);
        console.log('📹 [DEBUG] Video track ready:', videoTrack.readyState);
        console.log('📹 [DEBUG] Video track enabled:', videoTrack.enabled);
      }
      
      return stream;
      
    } catch (error) {
      console.error('❌ [DEBUG] Camera access error:', error.name, error.message);
      
      // Try with simpler constraints if first attempt fails
      if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
        console.log('🔄 [DEBUG] Trying simpler constraints...');
        try {
          const simpleStream = await navigator.mediaDevices.getUserMedia({
            video: true, // Let browser choose defaults
            audio: false
          });
          return simpleStream;
        } catch (simpleError) {
          console.error('❌ [DEBUG] Simple constraints also failed:', simpleError);
          throw simpleError;
        }
      }
      
      throw error;
    }
  }

  attachVideoElement(videoElement) {
    if (!videoElement || !(videoElement instanceof HTMLVideoElement)) {
      console.error('❌ [DEBUG] Invalid video element provided');
      return false;
    }
    
    console.log('📹 [DEBUG] Adding video element to manager');
    this.videoElements.add(videoElement);
    
    // If we have an active stream, attach it immediately
    if (this.stream && this.stream.active) {
      return this.attachStreamToElement(videoElement);
    }
    
    return false;
  }

  attachStreamToElement(videoElement) {
    if (!videoElement || !this.stream) {
      console.error('❌ [DEBUG] Cannot attach: missing video element or stream');
      return false;
    }
    
    try {
      console.log('🔗 [DEBUG] Attaching stream to video element');
      
      // Clear any existing stream first
      if (videoElement.srcObject) {
        videoElement.srcObject = null;
      }
      
      // Set the new stream
      videoElement.srcObject = this.stream;
      
      // Force video properties
      videoElement.muted = true;
      videoElement.playsInline = true;
      videoElement.style.transform = 'scaleX(-1)';
      videoElement.style.objectFit = 'cover';
      videoElement.style.backgroundColor = '#000';
      
      console.log('▶️ [DEBUG] Starting video playback...');
      
      // Play the video
      const playPromise = videoElement.play();
      
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log('✅ [DEBUG] Video is playing');
          console.log('📹 [DEBUG] Video readyState:', videoElement.readyState);
          console.log('📹 [DEBUG] Video width:', videoElement.videoWidth);
          console.log('📹 [DEBUG] Video height:', videoElement.videoHeight);
        }).catch(error => {
          console.warn('⚠️ [DEBUG] Video play was prevented:', error.message);
          console.warn('⚠️ [DEBUG] This is normal if page is not focused');
        });
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ [DEBUG] Failed to attach stream to element:', error);
      return false;
    }
  }

  detachVideoElement(videoElement) {
    if (videoElement) {
      console.log('📹 [DEBUG] Detaching video element');
      this.videoElements.delete(videoElement);
      
      if (videoElement.srcObject) {
        videoElement.srcObject = null;
      }
    }
  }

  attachToAllElements() {
    if (!this.stream || !this.stream.active) {
      console.log('⚠️ [DEBUG] No active stream to attach');
      return;
    }
    
    console.log(`📹 [DEBUG] Attaching stream to ${this.videoElements.size} video elements`);
    
    this.videoElements.forEach(videoElement => {
      this.attachStreamToElement(videoElement);
    });
  }

  _cleanupStream() {
    if (this.stream) {
      console.log('🧹 [DEBUG] Cleaning up old stream');
      this.stream.getTracks().forEach(track => {
        console.log(`🛑 [DEBUG] Stopping ${track.kind} track`);
        track.stop();
      });
      this.stream = null;
    }
  }

  getVideoTrack() {
    if (!this.stream) return null;
    const tracks = this.stream.getVideoTracks();
    return tracks.length > 0 ? tracks[0] : null;
  }

  isStreamAvailable() {
    return this.stream !== null && this.stream.active;
  }

  getLastError() {
    return this.lastError;
  }

  cleanup() {
    console.log('🧹 [DEBUG] Cleaning up camera manager completely');
    
    this._cleanupStream();
    
    this.videoElements.forEach(videoElement => {
      if (videoElement && videoElement.srcObject) {
        videoElement.srcObject = null;
      }
    });
    
    this.videoElements.clear();
    this.isInitialized = false;
    this.isCameraOn = false;
    this.lastError = null;
    this.pendingPromise = null;
  }
}

// Export a single instance
export default new CameraManager();