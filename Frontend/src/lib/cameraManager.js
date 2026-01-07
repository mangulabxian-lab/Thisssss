// /Frontend/src/lib/cameraManager.js - FIXED VERSION
class CameraManager {
  constructor() {
    this.stream = null;
    this.videoElements = new Set();
    this.isInitialized = false;
    this.isCameraOn = true;
    this.lastError = null;
  }

  async initializeCamera() {
    console.log('🎥 [DEBUG] initializeCamera called');
    
    // If already have stream, return it
    if (this.stream && this.stream.active) {
      console.log('✅ [DEBUG] Using existing camera stream');
      this.attachToAllElements();
      return this.stream;
    }

    try {
      console.log('🎥 [DEBUG] Requesting camera access...');
      
      // Stop any existing stream
      this.cleanup();

      // FIRST: Check available devices
      console.log('🔍 [DEBUG] Checking available devices...');
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      console.log('📷 [DEBUG] Available cameras:', cameras);

      if (cameras.length === 0) {
        throw new Error('No camera found on this device');
      }

      // Get camera with SIMPLE constraints
      console.log('🎯 [DEBUG] Requesting camera with constraints...');
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { min: 320, ideal: 640, max: 1280 },
          height: { min: 240, ideal: 480, max: 720 },
          facingMode: 'user'
        },
        audio: false
      });

      console.log('✅ [DEBUG] Camera access granted');
      console.log('📹 [DEBUG] Stream tracks:', this.stream.getTracks().length);
      
      const videoTrack = this.stream.getVideoTracks()[0];
      if (videoTrack) {
        console.log('📹 [DEBUG] Video track settings:', videoTrack.getSettings());
      }

      this.isInitialized = true;
      this.isCameraOn = true;
      this.lastError = null;
      this.attachToAllElements();
      
      return this.stream;

    } catch (error) {
      console.error('❌ [DEBUG] Camera access failed:', error);
      console.error('❌ [DEBUG] Error name:', error.name);
      console.error('❌ [DEBUG] Error message:', error.message);
      
      this.stream = null;
      this.isInitialized = false;
      this.lastError = error;
      
      let errorMessage = 'Camera access failed';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow camera access in browser settings.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found. Please connect a camera.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is busy. Close other camera apps.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Camera constraints could not be met. Trying alternative...';
        // Try with even simpler constraints
        return this.initializeCameraWithSimpleConstraints();
      }
      
      throw new Error(errorMessage);
    }
  }

  async initializeCameraWithSimpleConstraints() {
    try {
      console.log('🔄 [DEBUG] Trying simple constraints...');
      
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: true, // Simplest possible
        audio: false
      });

      console.log('✅ [DEBUG] Simple constraints worked');
      this.isInitialized = true;
      this.isCameraOn = true;
      this.lastError = null;
      this.attachToAllElements();
      
      return this.stream;
    } catch (error) {
      console.error('❌ [DEBUG] Simple constraints also failed:', error);
      throw error;
    }
  }

  attachVideoElement(videoElement) {
    if (!videoElement || typeof videoElement !== 'object') {
      console.error('❌ [DEBUG] Invalid video element');
      return false;
    }
    
    console.log('📹 [DEBUG] Attaching video element');
    this.videoElements.add(videoElement);
    
    if (this.stream && this.stream.active) {
      console.log('🔗 [DEBUG] Stream is active, attaching...');
      return this.attachStreamToElement(videoElement);
    } else {
      console.log('⚠️ [DEBUG] No active stream to attach');
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
      console.log('⚠️ [DEBUG] No active stream to attach to elements');
      return;
    }
    
    console.log(`📹 [DEBUG] Attaching to ${this.videoElements.size} video elements`);
    this.videoElements.forEach(videoElement => {
      this.attachStreamToElement(videoElement);
    });
  }

  attachStreamToElement(videoElement) {
    if (!videoElement || !this.stream) {
      console.error('❌ [DEBUG] Missing video element or stream');
      return false;
    }
    
    try {
      console.log('🔗 [DEBUG] Attaching stream to video element');
      
      // Clear any existing stream
      if (videoElement.srcObject) {
        videoElement.srcObject = null;
      }
      
      // Set new stream
      videoElement.srcObject = this.stream;
      videoElement.style.transform = 'scaleX(-1)';
      videoElement.style.objectFit = 'cover';
      videoElement.style.backgroundColor = '#000';
      
      console.log('▶️ [DEBUG] Attempting to play video...');
      
      // Try to play the video
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log('✅ [DEBUG] Video playing successfully');
        }).catch(error => {
          console.warn('⚠️ [DEBUG] Video play blocked:', error.message);
          
          // Try again with user interaction
          const tryPlayOnClick = () => {
            videoElement.play().then(() => {
              console.log('✅ [DEBUG] Video playing after click');
            }).catch(e => {
              console.warn('⚠️ [DEBUG] Still blocked after click');
            });
            document.removeEventListener('click', tryPlayOnClick);
          };
          
          document.addEventListener('click', tryPlayOnClick);
        });
      }
      
      return true;
    } catch (error) {
      console.error('❌ [DEBUG] Failed to attach stream:', error);
      return false;
    }
  }

  getVideoTrack() {
    if (!this.stream) return null;
    const tracks = this.stream.getVideoTracks();
    return tracks.length > 0 ? tracks[0] : null;
  }

  toggleCamera(enabled) {
    const track = this.getVideoTrack();
    if (track) {
      track.enabled = enabled;
      this.isCameraOn = enabled;
      console.log(`📹 [DEBUG] Camera ${enabled ? 'ON' : 'OFF'}`);
      return enabled;
    }
    console.log(`📹 [DEBUG] No track to toggle`);
    return false;
  }

  isActive() {
    const track = this.getVideoTrack();
    return track ? track.enabled : false;
  }

  isStreamAvailable() {
    return this.stream !== null && this.stream.active;
  }

  getLastError() {
    return this.lastError;
  }

  cleanup() {
    console.log('🧹 [DEBUG] Cleaning up camera manager');
    
    if (this.stream) {
      console.log('🛑 [DEBUG] Stopping stream tracks');
      this.stream.getTracks().forEach(track => {
        console.log(`🛑 [DEBUG] Stopping ${track.kind} track`);
        track.stop();
      });
      this.stream = null;
    }
    
    this.videoElements.forEach(videoElement => {
      if (videoElement && videoElement.srcObject) {
        videoElement.srcObject = null;
      }
    });
    
    this.videoElements.clear();
    this.isInitialized = false;
    this.isCameraOn = false;
    this.lastError = null;
  }
}

export default new CameraManager();