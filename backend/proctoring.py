import os
os.environ['GLOG_minloglevel'] = '2'  # Suppress warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # Suppress TensorFlow warnings

from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64
import mediapipe as mp
from datetime import datetime
import socketio
import eventlet
import audioop
import wave
import tempfile
import threading
from collections import deque
import time
import requests  # IDAGDAG ITO SA IMPORTS
from collections import defaultdict


# Add this global variable to track mouse movement
mouse_movement_tracker = defaultdict(lambda: {
    'last_movement_time': None,
    'last_position': None,
    'stationary_start_time': None,
    'is_stationary_alert_sent': False
})
# Initialize Flask app FIRST
app = Flask(__name__)
CORS(app)

# THEN initialize Socket.IO
sio = socketio.Server(cors_allowed_origins="*", async_mode='eventlet')
app_socket = socketio.WSGIApp(sio, app)

# MediaPipe Init - ENHANCED VERSION
mp_face_detection = mp.solutions.face_detection
mp_face_mesh = mp.solutions.face_mesh
mp_hands = mp.solutions.hands
mp_pose = mp.solutions.pose

# ENHANCED confidence levels - Better balance
face_detector = mp_face_detection.FaceDetection(
    model_selection=1,
    min_detection_confidence=0.3  # Slightly lowered for better detection
)

face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=3,  # Increased for better multiple face detection
    refine_landmarks=True,
    min_detection_confidence=0.3,
    min_tracking_confidence=0.3
)

hand_detector = mp_hands.Hands(
    model_complexity=1,
    max_num_hands=3,  # Increased for better hand detection
    min_detection_confidence=0.3,
    min_tracking_confidence=0.3
)

pose_detector = mp_pose.Pose(
    min_detection_confidence=0.3,
    min_tracking_confidence=0.3
)

# Store connected clients and audio data
connected_clients = {}
audio_data_buffer = deque(maxlen=100)
detection_history = deque(maxlen=50)  # Track detection history for better accuracy


@sio.event
def connect(sid, environ):
    print(f"✅ Client connected: {sid}")
    connected_clients[sid] = {
        'connected_at': datetime.now(),
        'user_role': None,
        'exam_id': None,
        'audio_alerts': 0,
        'last_audio_alert': None,
        'detection_stats': {
            'face_detected_count': 0,
            'total_frames': 0,
            'recent_gaze': [],
            'recent_head_pose': []
        }
    }

# Sa server.py - ADD THESE SOCKET EVENTS:

@sio.event
def manual_violation(sid, data):
    """Teacher manually adds violation"""
    student_socket_id = data.get('studentSocketId')
    violation_type = data.get('violationType', 'Manual Violation')
    exam_id = data.get('examId')
    
    print(f"⚠️ Manual violation for {student_socket_id}: {violation_type}")
    
    # Forward to teacher
    sio.emit('student-violation', {
        'studentSocketId': student_socket_id,
        'violationType': violation_type,
        'severity': 'manual',
        'examId': exam_id,
        'timestamp': datetime.now().isoformat()
    }, room=f"exam-{exam_id}")

@sio.event
def disconnect_student(sid, data):
    """Teacher disconnects student"""
    student_socket_id = data.get('studentSocketId')
    reason = data.get('reason', 'Teacher disconnected')
    exam_id = data.get('examId')
    
    print(f"🔌 Disconnecting student {student_socket_id}: {reason}")
    
    # Send disconnect command to student
    sio.emit('teacher-disconnect', {
        'reason': reason,
        'examId': exam_id
    }, room=student_socket_id)


@sio.event
def join_exam(sid, data):
    """When student joins an exam"""
    exam_id = data.get('examId')
    user_role = data.get('userRole')
    
    if exam_id and user_role:
        connected_clients[sid]['exam_id'] = exam_id
        connected_clients[sid]['user_role'] = user_role
        sio.enter_room(sid, f"exam-{exam_id}")
        print(f"🎓 Student {sid} joined exam {exam_id}")

@sio.event
def disconnect(sid):
    print(f"❌ Client disconnected: {sid}")
    if sid in connected_clients:
        del connected_clients[sid]

def send_proctoring_alert(exam_id, alert_data):
    """Send proctoring alert to specific exam room"""
    room = f"exam-{exam_id}"
    sio.emit('proctoring-alert', alert_data, room=room)
    print(f"🚨 Sent proctoring alert to exam {exam_id}: {alert_data}")

def decode_image(image_base64):
    """Decode base64 → OpenCV image with enhanced error handling"""
    try:
        image_data = image_base64.split(',')[1] if "," in image_base64 else image_base64
        img_bytes = base64.b64decode(image_data)
        img_np = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(img_np, cv2.IMREAD_COLOR)
        
        if img is None:
            print("❌ Failed to decode image")
            return None
            
        # Enhance image quality for better detection
        img = enhance_image_quality(img)
        return img
        
    except Exception as e:
        print(f"❌ Image decode error: {e}")
        return None

def enhance_image_quality(img):
    """Enhance image quality for better detection"""
    try:
        # Convert to LAB color space for better processing
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        
        # Apply CLAHE to L channel for better contrast
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        l = clahe.apply(l)
        
        # Merge back and convert to BGR
        lab = cv2.merge([l, a, b])
        enhanced_img = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        
        # Apply mild sharpening
        kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
        enhanced_img = cv2.filter2D(enhanced_img, -1, kernel)
        
        return enhanced_img
        
    except Exception as e:
        print(f"Image enhancement error: {e}")
        return img

def get_gaze_direction_enhanced(face_landmarks, w, h):
    """ENHANCED gaze detection with better accuracy"""
    try:
        # Multiple eye landmarks for precise gaze tracking
        left_eye_left = face_landmarks.landmark[33]    # Left eye left corner
        left_eye_right = face_landmarks.landmark[133]  # Left eye right corner
        right_eye_left = face_landmarks.landmark[362]  # Right eye left corner
        right_eye_right = face_landmarks.landmark[263] # Right eye right corner
        
        left_pupil = face_landmarks.landmark[468]  # Left eye center
        right_pupil = face_landmarks.landmark[473] # Right eye center
        
        # Calculate eye centers with pupil consideration
        left_eye_center_x = (left_eye_left.x + left_eye_right.x) / 2
        right_eye_center_x = (right_eye_left.x + right_eye_right.x) / 2
        eye_center_x = (left_eye_center_x + right_eye_center_x) / 2
        
        # Calculate pupil positions relative to eye centers
        left_pupil_offset = left_pupil.x - left_eye_center_x
        right_pupil_offset = right_pupil.x - right_eye_center_x
        avg_pupil_offset = (left_pupil_offset + right_pupil_offset) / 2
        
        # Reference points
        nose_tip = face_landmarks.landmark[1]
        nose_bridge = face_landmarks.landmark[168]
        
        # ENHANCED Horizontal gaze detection with pupil tracking
        horizontal_gaze = "center"
        if avg_pupil_offset < -0.02:  # More sensitive threshold
            horizontal_gaze = "left"
        elif avg_pupil_offset > 0.02:
            horizontal_gaze = "right"
        
        # ENHANCED Vertical gaze detection
        left_eye_upper = face_landmarks.landmark[159]
        left_eye_lower = face_landmarks.landmark[145]
        right_eye_upper = face_landmarks.landmark[386]
        right_eye_lower = face_landmarks.landmark[374]
        
        left_eye_openness = abs(left_eye_upper.y - left_eye_lower.y)
        right_eye_openness = abs(right_eye_upper.y - right_eye_lower.y)
        
        # Calculate vertical gaze based on pupil position
        vertical_gaze = "center"
        avg_pupil_y = (left_pupil.y + right_pupil.y) / 2
        eye_center_y = (left_eye_upper.y + left_eye_lower.y + right_eye_upper.y + right_eye_lower.y) / 4
        
        if avg_pupil_y < eye_center_y - 0.01:
            vertical_gaze = "up"
        elif avg_pupil_y > eye_center_y + 0.01:
            vertical_gaze = "down"
        
        # Combine gaze directions
        if horizontal_gaze == "center" and vertical_gaze == "center":
            gaze = "forward"
        elif horizontal_gaze != "center" and vertical_gaze == "center":
            gaze = f"looking {horizontal_gaze}"
        elif horizontal_gaze == "center" and vertical_gaze != "center":
            gaze = f"looking {vertical_gaze}"
        else:
            gaze = f"looking {horizontal_gaze} and {vertical_gaze}"
        
        # Enhanced eye openness detection
        eyes_open = (left_eye_openness > 0.015 and right_eye_openness > 0.015)  # More sensitive
        is_blinking = (left_eye_openness < 0.02 or right_eye_openness < 0.02)  # More sensitive
        
        return gaze, eyes_open, is_blinking, avg_pupil_offset
        
    except Exception as e:
        print(f"Enhanced gaze detection error: {e}")
        return "unknown", True, False, 0

def detect_mouth_movement_enhanced(face_landmarks):
    """ENHANCED mouth movement detection"""
    try:
        # Multiple mouth landmarks for better detection
        upper_lip = face_landmarks.landmark[13]
        lower_lip = face_landmarks.landmark[14]
        mouth_left = face_landmarks.landmark[61]
        mouth_right = face_landmarks.landmark[291]
        mouth_center_upper = face_landmarks.landmark[0]
        mouth_center_lower = face_landmarks.landmark[17]
        
        # Calculate multiple mouth metrics
        mouth_openness_vertical = abs(upper_lip.y - lower_lip.y)
        mouth_openness_center = abs(mouth_center_upper.y - mouth_center_lower.y)
        mouth_width = abs(mouth_right.x - mouth_left.x)
        mouth_corner_movement = abs(mouth_left.y - mouth_right.y)
        
        # ENHANCED talking detection with multiple factors
        is_talking = (
            mouth_openness_vertical > 0.035 or  # More sensitive
            mouth_openness_center > 0.025 or    # Additional metric
            mouth_width > 0.18 or               # More sensitive
            mouth_corner_movement > 0.02        # New metric for corner movement
        )
        
        mouth_confidence = (
            (1 if mouth_openness_vertical > 0.035 else 0) +
            (1 if mouth_openness_center > 0.025 else 0) +
            (1 if mouth_width > 0.18 else 0) +
            (1 if mouth_corner_movement > 0.02 else 0)
        )
        
        return is_talking, mouth_openness_vertical, mouth_confidence
        
    except Exception as e:
        print(f"Enhanced mouth movement detection error: {e}")
        return False, 0, 0

def detect_head_pose_enhanced(face_landmarks, w, h):
    """ENHANCED head pose detection with better accuracy"""
    try:
        nose_tip = face_landmarks.landmark[1]
        left_eye = face_landmarks.landmark[33]
        right_eye = face_landmarks.landmark[263]
        chin = face_landmarks.landmark[152]
        forehead = face_landmarks.landmark[10]
        left_ear = face_landmarks.landmark[234]
        right_ear = face_landmarks.landmark[454]
        
        # Calculate multiple pose metrics
        eye_center_x = (left_eye.x + right_eye.x) / 2
        horizontal_diff = abs(nose_tip.x - eye_center_x)
        
        # Face symmetry analysis
        left_side_length = abs(left_ear.x - nose_tip.x)
        right_side_length = abs(right_ear.x - nose_tip.x)
        symmetry_ratio = min(left_side_length, right_side_length) / max(left_side_length, right_side_length)
        
        # Calculate head tilt with multiple points
        face_vertical = abs(chin.y - forehead.y)
        left_vertical = abs(left_eye.y - chin.y)
        right_vertical = abs(right_eye.y - chin.y)
        
        pose = "head forward"
        tilt = "upright"
        confidence = 1.0
        
        # ENHANCED Horizontal head rotation with symmetry check
        if horizontal_diff > 0.05 and symmetry_ratio < 0.85:  # More sensitive with symmetry
            if nose_tip.x < eye_center_x:
                pose = "head turned right"
                confidence = 1 - symmetry_ratio
            else:
                pose = "head turned left"
                confidence = 1 - symmetry_ratio
        
        # ENHANCED Vertical head tilt
        vertical_threshold = 0.25  # More sensitive
        vertical_diff = abs(left_vertical - right_vertical)
        
        if vertical_diff > vertical_threshold:
            if chin.y > (left_eye.y + right_eye.y) / 2:
                tilt = "head down"
                confidence = max(confidence, vertical_diff)
            else:
                tilt = "head up"
                confidence = max(confidence, vertical_diff)
        
        # Combine pose and tilt
        if pose != "head forward" and tilt != "upright":
            final_pose = f"{pose} and {tilt}"
        elif pose != "head forward":
            final_pose = pose
        elif tilt != "upright":
            final_pose = tilt
        else:
            final_pose = "head forward"
        
        return final_pose, confidence
                
    except Exception as e:
        print(f"Enhanced head pose error: {e}")
        return "unknown", 0.0

def detect_phone_usage_enhanced(hands_results, face_center_x, face_center_y, w, h):
    """ENHANCED phone detection with multiple factors"""
    try:
        if not hands_results.multi_hand_landmarks:
            return False, 0.0
            
        phone_confidence = 0.0
        max_confidence = 0.0
        
        for hand_landmarks in hands_results.multi_hand_landmarks:
            wrist = hand_landmarks.landmark[0]
            thumb_tip = hand_landmarks.landmark[4]
            index_tip = hand_landmarks.landmark[8]
            middle_tip = hand_landmarks.landmark[12]
            palm_center = hand_landmarks.landmark[9]
            
            # Multiple detection factors
            hand_face_distance = np.sqrt((wrist.x - face_center_x)**2 + (wrist.y - face_center_y)**2)
            thumb_index_distance = np.sqrt((thumb_tip.x - index_tip.x)**2 + (thumb_tip.y - index_tip.y)**2)
            palm_orientation = abs(palm_center.x - wrist.x)  # Palm facing direction
            
            # ENHANCED phone detection conditions
            confidence_factors = []
            
            # Distance factor (closer = higher confidence)
            if hand_face_distance < 0.15:
                confidence_factors.append(1.0)
            elif hand_face_distance < 0.25:
                confidence_factors.append(0.7)
            elif hand_face_distance < 0.35:
                confidence_factors.append(0.3)
            
            # Grip factor (pinching gesture)
            if thumb_index_distance < 0.03:
                confidence_factors.append(1.0)
            elif thumb_index_distance < 0.05:
                confidence_factors.append(0.5)
            
            # Palm orientation (vertical grip typical for phones)
            if palm_orientation < 0.1:  # Vertical orientation
                confidence_factors.append(0.8)
            
            # Multiple fingers extended (typing/scroll gesture)
            fingers_extended = 0
            if index_tip.y < wrist.y: fingers_extended += 1
            if middle_tip.y < wrist.y: fingers_extended += 1
            if fingers_extended >= 2:
                confidence_factors.append(0.6)
            
            # Calculate overall confidence
            if confidence_factors:
                hand_confidence = sum(confidence_factors) / len(confidence_factors)
                max_confidence = max(max_confidence, hand_confidence)
        
        # Require moderate confidence for phone detection
        return max_confidence > 0.4, max_confidence
                
    except Exception as e:
        print(f"Enhanced phone detection error: {e}")
        return False, 0.0

def detect_mouse_usage_enhanced(hands_results, pose_results, w, h):
    """ENHANCED mouse usage detection"""
    try:
        if not hands_results.multi_hand_landmarks:
            return False, 0.0
            
        mouse_confidence = 0.0
        
        for hand_landmarks in hands_results.multi_hand_landmarks:
            wrist = hand_landmarks.landmark[0]
            index_tip = hand_landmarks.landmark[8]
            middle_tip = hand_landmarks.landmark[12]
            thumb_tip = hand_landmarks.landmark[4]
            pinky_tip = hand_landmarks.landmark[20]
            
            # Mouse usage patterns
            hand_position = "right" if wrist.x > 0.5 else "left"
            
            # Finger configuration analysis
            index_extended = index_tip.y < wrist.y - 0.05  # Clearly extended
            middle_relaxed = middle_tip.y > wrist.y + 0.02  # Clearly relaxed
            thumb_position = abs(thumb_tip.x - index_tip.x) < 0.08  # Thumb near index
            
            # Hand stability and shape
            hand_flatness = abs(wrist.y - pinky_tip.y) < 0.1  # Flat hand
            finger_alignment = abs(index_tip.y - middle_tip.y) > 0.03  # Index higher than middle
            
            # ENHANCED mouse detection conditions
            confidence_factors = []
            
            if hand_position == "right":  # Typically right side for mouse
                confidence_factors.append(0.8)
            
            if index_extended:
                confidence_factors.append(1.0)
            
            if middle_relaxed:
                confidence_factors.append(0.8)
            
            if thumb_position:
                confidence_factors.append(0.6)
            
            if hand_flatness:
                confidence_factors.append(0.7)
            
            if finger_alignment:
                confidence_factors.append(0.9)
            
            # Calculate confidence
            if confidence_factors:
                hand_confidence = sum(confidence_factors) / len(confidence_factors)
                mouse_confidence = max(mouse_confidence, hand_confidence)
        
        return mouse_confidence > 0.5, mouse_confidence
                
    except Exception as e:
        print(f"Enhanced mouse detection error: {e}")
        return False, 0.0

def detect_multiple_people_enhanced(face_results, img, w, h):
    """ENHANCED multiple people detection"""
    try:
        if not face_results.detections:
            return False, 0.0
        
        face_count = len(face_results.detections)
        
        if face_count <= 1:
            return False, 0.0
        
        # Calculate face positions and sizes
        face_bboxes = []
        for detection in face_results.detections:
            bbox = detection.location_data.relative_bounding_box
            x_center = bbox.xmin + bbox.width / 2
            y_center = bbox.ymin + bbox.height / 2
            size = bbox.width * bbox.height
            
            face_bboxes.append({
                'center': (x_center, y_center),
                'size': size,
                'bbox': bbox
            })
        
        # Check if faces are distinct (not reflections/artifacts)
        distinct_faces = True
        confidence = min(1.0, face_count / 3.0)  # More faces = higher confidence
        
        # Additional checks for distinct faces
        if face_count >= 2:
            # Check if faces have significantly different sizes (likely different people)
            sizes = [face['size'] for face in face_bboxes]
            size_variance = np.var(sizes)
            if size_variance > 0.01:  # Significant size difference
                confidence += 0.2
            
            # Check face positions
            centers = [face['center'] for face in face_bboxes]
            avg_distance = 0
            for i in range(len(centers)):
                for j in range(i+1, len(centers)):
                    dist = np.sqrt((centers[i][0]-centers[j][0])**2 + (centers[i][1]-centers[j][1])**2)
                    avg_distance += dist
            
            if len(centers) > 1:
                avg_distance /= (len(centers)*(len(centers)-1)/2)
                if avg_distance > 0.3:  # Faces are far apart
                    confidence += 0.3
        
        return face_count >= 2, min(confidence, 1.0)
        
    except Exception as e:
        print(f"Enhanced multiple people detection error: {e}")
        return False, 0.0

def analyze_audio_enhanced(audio_data, sample_rate=16000):
    """ENHANCED audio analysis with better detection"""
    try:
        if not audio_data:
            return "silent", 0, 0.0
            
        # Convert audio data to numpy array
        audio_array = np.frombuffer(audio_data, dtype=np.int16)
        
        if len(audio_array) == 0:
            return "silent", 0, 0.0
        
        # Calculate multiple audio features
        rms = audioop.rms(audio_data, 2)  # Volume
        
        # Spectral analysis
        fft = np.fft.fft(audio_array)
        frequencies = np.fft.fftfreq(len(fft))
        magnitude = np.abs(fft)
        
        # Voice frequency range (85-255 Hz for male, 165-255 Hz for female)
        voice_mask = (np.abs(frequencies) > 85/sample_rate) & (np.abs(frequencies) < 255/sample_rate)
        voice_energy = np.sum(magnitude[voice_mask])
        total_energy = np.sum(magnitude)
        voice_ratio = voice_energy / total_energy if total_energy > 0 else 0
        
        # Zero-crossing rate
        zero_crossings = np.sum(np.diff(np.signbit(audio_array)) != 0)
        zcr = zero_crossings / len(audio_array)
        
        # ENHANCED speech detection with multiple factors
        speaking_confidence = 0.0
        
        # Volume factor
        if rms > 800:
            speaking_confidence += 0.4
        elif rms > 400:
            speaking_confidence += 0.2
        
        # Voice frequency factor
        if voice_ratio > 0.3:
            speaking_confidence += 0.3
        elif voice_ratio > 0.15:
            speaking_confidence += 0.15
        
        # Zero-crossing rate factor (speech typically has higher ZCR)
        if zcr > 0.12:
            speaking_confidence += 0.3
        elif zcr > 0.08:
            speaking_confidence += 0.15
        
        # Determine audio status with confidence
        if speaking_confidence > 0.6:
            return "speaking", rms, speaking_confidence
        elif speaking_confidence > 0.3:
            return "whispering", rms, speaking_confidence
        else:
            return "silent", rms, speaking_confidence
            
    except Exception as e:
        print(f"Enhanced audio analysis error: {e}")
        return "error", 0, 0.0

# Enhanced audio processing endpoint
@app.route('/process_audio', methods=['POST'])
def process_audio():
    try:
        data = request.json
        if not data or 'audio' not in data:
            return jsonify({"error": "No audio data provided"}), 400
            
        exam_id = data.get('exam_id')
        student_id = data.get('student_id')
        audio_base64 = data.get('audio')
        
        # Decode audio
        try:
            audio_data = base64.b64decode(audio_base64.split(',')[1] if "," in audio_base64 else audio_base64)
        except:
            return jsonify({"error": "Invalid audio data"}), 400
        
        # Analyze audio with enhanced detection
        audio_status, volume, confidence = analyze_audio_enhanced(audio_data)
        
        # Store audio data for trend analysis
        audio_data_buffer.append(volume)
        
        # Check for suspicious audio patterns with confidence threshold
        if exam_id and audio_status in ["speaking", "whispering"] and confidence > 0.5:
            # Check if this is a repeated alert (prevent spam)
            current_time = datetime.now()
            client = next((c for c in connected_clients.values() if c.get('exam_id') == exam_id), None)
            
            if client:
                last_alert = client.get('last_audio_alert')
                alert_cooldown = 20 if audio_status == "whispering" else 30  # Shorter cooldown for whispering
                
                if not last_alert or (current_time - last_alert).total_seconds() > alert_cooldown:
                    
                    alert_message = ""
                    alert_type = "warning"
                    
                    if audio_status == "whispering":
                        alert_message = f"🔇 Whispering detected (confidence: {confidence:.1%})"
                        alert_type = "warning"
                    elif audio_status == "speaking":
                        alert_message = f"🗣️ Speaking detected (confidence: {confidence:.1%})"
                        alert_type = "danger"
                    
                    send_proctoring_alert(exam_id, {
                        "message": alert_message,
                        "type": alert_type,
                        "severity": "high" if audio_status == "speaking" else "medium",
                        "timestamp": current_time.isoformat(),
                        "confidence": confidence
                    })
                    
                    client['last_audio_alert'] = current_time
                    client['audio_alerts'] = client.get('audio_alerts', 0) + 1
        
        return jsonify({
            "audioStatus": audio_status,
            "volume": volume,
            "confidence": confidence,
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"Audio processing error: {e}")
        return jsonify({"error": str(e)}), 500

# Sa server.py, palitan ang send_detection_to_teacher function:
import requests  # IDAGDAG ITO SA IMPORTS

def send_detection_to_teacher(exam_id, student_socket_id, detection_data):
    """Send detection alerts to teacher via HTTP API"""
    try:
        alert_data = {
            "studentSocketId": student_socket_id,
            "message": detection_data.get("message", "Suspicious activity detected"),
            "type": detection_data.get("type", "warning"),
            "severity": detection_data.get("severity", "medium"),
            "timestamp": datetime.now().isoformat(),
            "details": detection_data.get("details", {}),
            "confidence": detection_data.get("confidence", 0.0),
            "detectionType": detection_data.get("detectionType", "unknown"),
            "examId": exam_id,
            "source": "python_backend"
        }
        
        # ✅ FIX: Use HTTP API instead of direct socket
        response = requests.post(
            'http://localhost:3000/api/proctoring-alert',
            json=alert_data,
            headers={'Content-Type': 'application/json'},
            timeout=5
        )
        
        if response.status_code == 200:
            print(f"✅ Proctoring alert sent to teacher via API: {alert_data['message']}")
        else:
            print(f"❌ Failed to send alert: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error sending detection to teacher: {e}")

# THIS LINE SHOULD BE AT THE SAME INDENT LEVEL AS THE PREVIOUS FUNCTION
# Sa /detect endpoint, hanapin ang actual socket ID:
# SA server.py, i-debug kung nakukuha ang socket ID:
@app.route('/detect', methods=['POST'])
def detect():
    try:
        start_time = time.time()
        data = request.json
        
        print(f"🎯 Received detection request from student")
        
        if not data or 'image' not in data:
            return jsonify({"error": "No image data provided"}), 400
        
        # ✅ GET DATA
        detection_settings = data.get('detection_settings', {})
        exam_id = data.get('exam_id', 'unknown-exam')
        student_id = data.get('student_id', 'unknown-student')
        student_socket_id = data.get('student_socket_id', 'unknown-socket')  # ✅ ITO ANG BAGO
        
        print(f"📊 Student Socket ID from request: {student_socket_id}")
        print(f"🎓 Exam: {exam_id}, Student: {student_id}, Socket: {student_socket_id}")
        
        # ✅ DOUBLE CHECK SA CONNECTED CLIENTS
        actual_socket_id = None
        for sid, client_data in connected_clients.items():
            if client_data.get('exam_id') == exam_id and client_data.get('user_role') == 'student':
                actual_socket_id = sid
                break
        
        print(f"🔍 Actual socket ID from connected clients: {actual_socket_id}")
        
        # Use the one from request as fallback
        final_socket_id = student_socket_id if student_socket_id != 'unknown-socket' else actual_socket_id
        print(f"🎯 Using socket ID: {final_socket_id}")
        
        # ... rest of the function
        
        # ✅ CHECK IF ALL DETECTIONS ARE DISABLED - RETURN EARLY
        if detection_settings and not any([
            detection_settings.get('faceDetection', True),
            detection_settings.get('gazeDetection', True), 
            detection_settings.get('phoneDetection', True),
            detection_settings.get('mouthDetection', True),
            detection_settings.get('multiplePeopleDetection', True),
            detection_settings.get('audioDetection', True)
        ]):
            print("🛑 ALL DETECTIONS DISABLED - Returning minimal response")
            return jsonify({
                "faceDetected": False,
                "faceCount": 0,
                "gaze": "unknown",
                "eyesOpen": True,
                "headPose": "unknown",
                "phoneDetected": False,
                "mouseDetected": False,
                "mouthMoving": False,
                "multiplePeople": False,
                "blinking": False,
                "suspiciousActivities": [],
                "attentionScore": 100,
                "detectionConfidence": 0.0,
                "processingTime": round((time.time() - start_time) * 1000, 2),
                "message": "All detections disabled by teacher settings"
            })
            
        img = decode_image(data['image'])
        if img is None:
            print("❌ Failed to decode image")
            return jsonify({"error": "Invalid image"}), 400

        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        h, w, _ = img.shape

        # Initialize enhanced results
        results = {
            "faceDetected": False,
            "faceCount": 0,
            "gaze": "unknown",
            "eyesOpen": True,
            "headPose": "unknown",
            "phoneDetected": False,
            "mouseDetected": False,
            "mouthMoving": False,
            "multiplePeople": False,
            "faceOccluded": False,
            "blinking": False,
            "suspiciousActivities": [],
            "faceBoundingBox": None,
            "eyeDetected": False,
            "gazeForward": True,
            "debugImage": None,
            "attentionScore": 100,
            "detectionConfidence": 0.0,
            "processingTime": 0,
            "enhancedFeatures": {
                "gazeConfidence": 0.0,
                "headPoseConfidence": 0.0,
                "phoneConfidence": 0.0,
                "mouseConfidence": 0.0,
                "multiplePeopleConfidence": 0.0,
                "mouthMovementConfidence": 0.0
            }
        }

        # ✅ ONLY PROCESS FACE DETECTION IF ENABLED
        face_results = None
        if detection_settings.get('faceDetection', True):
            try:
                face_results = face_detector.process(rgb_img)
                print(f"✅ Face detection completed: {len(face_results.detections) if face_results and face_results.detections else 0} faces")
            except Exception as e:
                print(f"❌ Face detection error: {e}")
                face_results = None
        else:
            print("🛑 Face detection disabled - skipping")
            results["faceDetected"] = False
            results["faceCount"] = 0

        # If face detection is disabled, skip ALL face-related processing
        if not detection_settings.get('faceDetection', True):
            print("🛑 All face-related processing skipped due to settings")
            results["processingTime"] = round((time.time() - start_time) * 1000, 2)
            return jsonify(results)

        # Continue with face detection if enabled
        if face_results and face_results.detections:
            results["faceCount"] = len(face_results.detections)
            results["faceDetected"] = True

            # Process first face for detailed analysis
            detection = face_results.detections[0]
            bbox = detection.location_data.relative_bounding_box
            
            x1 = int(bbox.xmin * w)
            y1 = int(bbox.ymin * h)
            x2 = x1 + int(bbox.width * w)
            y2 = y1 + int(bbox.height * h)
            
            face_center_x = (x1 + x2) / 2 / w
            face_center_y = (y1 + y2) / 2 / h
            
            results["faceBoundingBox"] = {
                "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                "center_x": face_center_x,
                "center_y": face_center_y
            }
            
            cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)

            # ✅ ENHANCED FACE MESH - ONLY IF FACE DETECTION ENABLED
            mesh_results = face_mesh.process(rgb_img)
            if mesh_results.multi_face_landmarks:
                landmarks = mesh_results.multi_face_landmarks[0]
                results["eyeDetected"] = True
                
                # ✅ ONLY DO GAZE DETECTION IF ENABLED
                if detection_settings.get('gazeDetection', True):
                    try:
                        gaze_direction, eyes_open, is_blinking, gaze_confidence = get_gaze_direction_enhanced(landmarks, w, h)
                        results["gaze"] = gaze_direction
                        results["eyesOpen"] = eyes_open
                        results["blinking"] = is_blinking
                        results["gazeForward"] = (gaze_direction == "forward")
                        results["enhancedFeatures"]["gazeConfidence"] = abs(gaze_confidence)
                        
                        # Enhanced gaze monitoring - ONLY IF ENABLED
                        if gaze_direction != "forward" and abs(gaze_confidence) > 0.03:
                            alert_msg = f"👀 GAZE DEVIATION: {gaze_direction} (confidence: {abs(gaze_confidence):.3f})"
                            results["suspiciousActivities"].append(alert_msg)
                            
                            # Send to teacher
                            if exam_id and student_socket_id and any(direction in gaze_direction for direction in ["left", "right"]) and abs(gaze_confidence) > 0.05:
                                send_detection_to_teacher(exam_id, student_socket_id, {
                                    "message": alert_msg,
                                    "type": "warning",
                                    "severity": "medium",
                                    "detectionType": "gaze_deviation",
                                    "confidence": abs(gaze_confidence)
                                })
                    except Exception as e:
                        print(f"❌ Gaze detection error: {e}")
                else:
                    print("🛑 Gaze detection disabled")
                    results["gaze"] = "disabled"

                # ✅ ONLY DO HEAD POSE DETECTION IF ENABLED
                if detection_settings.get('gazeDetection', True):
                    try:
                        head_pose, head_pose_confidence = detect_head_pose_enhanced(landmarks, w, h)
                        results["headPose"] = head_pose
                        results["enhancedFeatures"]["headPoseConfidence"] = head_pose_confidence
                        
                        if head_pose != "head forward" and head_pose_confidence > 0.5:
                            alert_msg = f"🙄 HEAD POSE: {head_pose} (confidence: {head_pose_confidence:.1%})"
                            results["suspiciousActivities"].append(alert_msg)
                            
                            if exam_id and student_socket_id and head_pose_confidence > 0.6:
                                send_detection_to_teacher(exam_id, student_socket_id, {
                                    "message": alert_msg,
                                    "type": "warning", 
                                    "severity": "medium",
                                    "detectionType": "head_pose",
                                    "confidence": head_pose_confidence
                                })
                    except Exception as e:
                        print(f"❌ Head pose detection error: {e}")
                else:
                    print("🛑 Head pose detection disabled")
                    results["headPose"] = "disabled"

                # ✅ ONLY DO MOUTH MOVEMENT DETECTION IF ENABLED
                if detection_settings.get('mouthDetection', True):
                    try:
                        is_talking, mouth_openness, mouth_confidence = detect_mouth_movement_enhanced(landmarks)
                        results["mouthMoving"] = is_talking
                        results["enhancedFeatures"]["mouthMovementConfidence"] = mouth_confidence / 4.0
                        
                        if is_talking and mouth_confidence >= 2:
                            alert_msg = f"🗣️ MOUTH MOVEMENT: Possible talking (confidence: {mouth_confidence}/4)"
                            results["suspiciousActivities"].append(alert_msg)
                            
                            if exam_id and student_socket_id and mouth_confidence >= 3:
                                send_detection_to_teacher(exam_id, student_socket_id, {
                                    "message": alert_msg,
                                    "type": "warning",
                                    "severity": "medium",
                                    "detectionType": "mouth_movement",
                                    "confidence": mouth_confidence / 4.0
                                })
                    except Exception as e:
                        print(f"❌ Mouth detection error: {e}")
                else:
                    print("🛑 Mouth detection disabled")
                    results["mouthMoving"] = False

            # ✅ ONLY DO MULTIPLE PEOPLE DETECTION IF ENABLED
            if detection_settings.get('multiplePeopleDetection', True):
                try:
                    multiple_people, multiple_confidence = detect_multiple_people_enhanced(face_results, img, w, h)
                    results["multiplePeople"] = multiple_people
                    results["enhancedFeatures"]["multiplePeopleConfidence"] = multiple_confidence
                    
                    if multiple_people and multiple_confidence > 0.5:
                        alert_msg = f"👥 MULTIPLE PEOPLE DETECTED ({results['faceCount']} faces, confidence: {multiple_confidence:.1%})"
                        results["suspiciousActivities"].append(alert_msg)
                        
                        if exam_id and student_socket_id and multiple_confidence > 0.6:
                            send_detection_to_teacher(exam_id, student_socket_id, {
                                "message": f"👥 Multiple people detected ({results['faceCount']} faces)",
                                "type": "danger",
                                "severity": "high",
                                "detectionType": "multiple_people",
                                "confidence": multiple_confidence
                            })
                except Exception as e:
                    print(f"❌ Multiple people detection error: {e}")
            else:
                print("🛑 Multiple people detection disabled")

            # ✅ ONLY DO HAND DETECTION FOR PHONE/MOUSE IF ENABLED
            if detection_settings.get('phoneDetection', True):
                try:
                    hand_results = hand_detector.process(rgb_img)
                    pose_results = pose_detector.process(rgb_img)
                    
                    # Phone detection
                    phone_detected, phone_confidence = detect_phone_usage_enhanced(hand_results, face_center_x, face_center_y, w, h)
                    results["phoneDetected"] = phone_detected
                    results["enhancedFeatures"]["phoneConfidence"] = phone_confidence
                    
                    if phone_detected and phone_confidence > 0.5:
                        alert_msg = f"📱 POTENTIAL PHONE USAGE (confidence: {phone_confidence:.1%})"
                        results["suspiciousActivities"].append(alert_msg)
                        
                        if exam_id and student_socket_id and phone_confidence > 0.6:
                            send_detection_to_teacher(exam_id, student_socket_id, {
                                "message": "📱 Potential phone usage detected",
                                "type": "danger",
                                "severity": "high", 
                                "detectionType": "phone_usage",
                                "confidence": phone_confidence
                            })
                    
                    # Mouse detection
                    mouse_detected, mouse_confidence = detect_mouse_usage_enhanced(hand_results, pose_results, w, h)
                    results["mouseDetected"] = mouse_detected
                    results["enhancedFeatures"]["mouseConfidence"] = mouse_confidence
                    
                    if mouse_detected and mouse_confidence > 0.6:
                        alert_msg = f"🖱️ POTENTIAL MOUSE USAGE (confidence: {mouse_confidence:.1%})"
                        results["suspiciousActivities"].append(alert_msg)
                        
                        if exam_id and student_socket_id and mouse_confidence > 0.7:
                            send_detection_to_teacher(exam_id, student_socket_id, {
                                "message": "🖱️ Potential unauthorized device usage detected",
                                "type": "warning",
                                "severity": "medium", 
                                "detectionType": "mouse_usage",
                                "confidence": mouse_confidence
                            })
                except Exception as e:
                    print(f"❌ Hand detection error: {e}")
            else:
                print("🛑 Phone detection disabled")
                results["phoneDetected"] = False
                results["mouseDetected"] = False

        else:
            # Only show no face alert if face detection is enabled
            if detection_settings.get('faceDetection', True):
                alert_msg = "❌ NO FACE: Face not visible in camera"
                results["suspiciousActivities"].append(alert_msg)
                
                if exam_id and student_socket_id:
                    send_detection_to_teacher(exam_id, student_socket_id, {
                        "message": "❌ Face not visible - Please adjust camera position",
                        "type": "warning",
                        "severity": "high",
                        "detectionType": "no_face"
                    })

        # ✅ ENHANCED attention score calculation
        violation_count = len(results["suspiciousActivities"])
        confidence_penalty = min(50, violation_count * 10)  # Cap at 50% penalty
        
        results["attentionScore"] = max(0, 100 - confidence_penalty)
        results["detectionConfidence"] = calculate_overall_confidence(results)
        
        # Only send low attention alert if relevant detections are enabled
        if exam_id and student_socket_id and results["attentionScore"] < 70 and violation_count > 0:
            send_detection_to_teacher(exam_id, student_socket_id, {
                "message": f"📉 Low attention score: {results['attentionScore']}% - High distraction level",
                "type": "danger",
                "severity": "high",
                "detectionType": "low_attention",
                "confidence": results["detectionConfidence"]
            })

        results["processingTime"] = round((time.time() - start_time) * 1000, 2)

        print(f"✅ Detection completed - Alerts: {len(results['suspiciousActivities'])}")
        return jsonify(results)

    except Exception as e:
        print(f"❌ Detection error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e), "message": "Internal server error occurred"}), 500
        
        print(f"🎯 Received detection settings: {detection_settings}")
        
        # ✅ CHECK IF ALL DETECTIONS ARE DISABLED - RETURN EARLY
        if detection_settings and not any([
            detection_settings.get('faceDetection', True),
            detection_settings.get('gazeDetection', True), 
            detection_settings.get('phoneDetection', True),
            detection_settings.get('mouthDetection', True),
            detection_settings.get('multiplePeopleDetection', True),
            detection_settings.get('audioDetection', True)
        ]):
            print("🛑 ALL DETECTIONS DISABLED - Returning minimal response")
            return jsonify({
                "faceDetected": False,
                "faceCount": 0,
                "gaze": "unknown",
                "eyesOpen": True,
                "headPose": "unknown",
                "phoneDetected": False,
                "mouseDetected": False,
                "mouthMoving": False,
                "multiplePeople": False,
                "blinking": False,
                "suspiciousActivities": [],
                "attentionScore": 100,
                "detectionConfidence": 0.0,
                "processingTime": round((time.time() - start_time) * 1000, 2),
                "message": "All detections disabled by teacher settings"
            })
            
        img = decode_image(data['image'])
        if img is None:
            return jsonify({"error": "Invalid image"}), 400

        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        h, w, _ = img.shape

        # Initialize enhanced results
        results = {
            "faceDetected": False,
            "faceCount": 0,
            "gaze": "unknown",
            "eyesOpen": True,
            "headPose": "unknown",
            "phoneDetected": False,
            "mouseDetected": False,
            "mouthMoving": False,
            "multiplePeople": False,
            "faceOccluded": False,
            "blinking": False,
            "suspiciousActivities": [],
            "faceBoundingBox": None,
            "eyeDetected": False,
            "gazeForward": True,
            "debugImage": None,
            "attentionScore": 100,
            "detectionConfidence": 0.0,
            "processingTime": 0,
            "enhancedFeatures": {
                "gazeConfidence": 0.0,
                "headPoseConfidence": 0.0,
                "phoneConfidence": 0.0,
                "mouseConfidence": 0.0,
                "multiplePeopleConfidence": 0.0,
                "mouthMovementConfidence": 0.0
            }
        }

        # ✅ ONLY PROCESS FACE DETECTION IF ENABLED
        face_results = None
        if detection_settings.get('faceDetection', True):
            face_results = face_detector.process(rgb_img)
        else:
            # Skip face detection entirely
            print("🛑 Face detection disabled - skipping")
            results["faceDetected"] = False
            results["faceCount"] = 0

        # If face detection is disabled, skip ALL face-related processing
        if not detection_settings.get('faceDetection', True):
            print("🛑 All face-related processing skipped due to settings")
            results["processingTime"] = round((time.time() - start_time) * 1000, 2)
            return jsonify(results)

        # Continue with face detection if enabled
        if face_results and face_results.detections:
            results["faceCount"] = len(face_results.detections)
            results["faceDetected"] = True

            # ✅ ONLY DO MULTIPLE PEOPLE DETECTION IF ENABLED
            if detection_settings.get('multiplePeopleDetection', True):
                multiple_people, multiple_confidence = detect_multiple_people_enhanced(face_results, img, w, h)
                results["multiplePeople"] = multiple_people
                results["enhancedFeatures"]["multiplePeopleConfidence"] = multiple_confidence
                
                if multiple_people and multiple_confidence > 0.5:
                    results["suspiciousActivities"].append(f"👥 MULTIPLE PEOPLE DETECTED ({results['faceCount']} faces, confidence: {multiple_confidence:.1%})")
                    
                    if exam_id and multiple_confidence > 0.6:
                        send_proctoring_alert(exam_id, {
                            "message": f"👥 Multiple people detected ({results['faceCount']} faces)",
                            "type": "danger",
                            "severity": "high",
                            "timestamp": datetime.now().isoformat(),
                            "confidence": multiple_confidence
                        })
            else:
                print("🛑 Multiple people detection disabled")

            # Process first face for detailed analysis
            detection = face_results.detections[0]
            bbox = detection.location_data.relative_bounding_box
            
            x1 = int(bbox.xmin * w)
            y1 = int(bbox.ymin * h)
            x2 = x1 + int(bbox.width * w)
            y2 = y1 + int(bbox.height * h)
            
            face_center_x = (x1 + x2) / 2 / w
            face_center_y = (y1 + y2) / 2 / h
            
            results["faceBoundingBox"] = {
                "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                "center_x": face_center_x,
                "center_y": face_center_y
            }
            
            cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)

            # ✅ ENHANCED FACE MESH - ONLY IF FACE DETECTION ENABLED
            mesh_results = face_mesh.process(rgb_img)
            if mesh_results.multi_face_landmarks:
                landmarks = mesh_results.multi_face_landmarks[0]
                results["eyeDetected"] = True
                
                # ✅ ONLY DO GAZE DETECTION IF ENABLED
                if detection_settings.get('gazeDetection', True):
                    gaze_direction, eyes_open, is_blinking, gaze_confidence = get_gaze_direction_enhanced(landmarks, w, h)
                    results["gaze"] = gaze_direction
                    results["eyesOpen"] = eyes_open
                    results["blinking"] = is_blinking
                    results["gazeForward"] = (gaze_direction == "forward")
                    results["enhancedFeatures"]["gazeConfidence"] = abs(gaze_confidence)
                    
                    # Enhanced gaze monitoring - ONLY IF ENABLED
                    if gaze_direction != "forward" and abs(gaze_confidence) > 0.03:
                        results["suspiciousActivities"].append(f"👀 GAZE DEVIATION: {gaze_direction} (confidence: {abs(gaze_confidence):.3f})")
                        
                        if exam_id and any(direction in gaze_direction for direction in ["left", "right"]) and abs(gaze_confidence) > 0.05:
                            send_proctoring_alert(exam_id, {
                                "message": f"👀 Eye movement detected: {gaze_direction}",
                                "type": "warning",
                                "severity": "medium",
                                "timestamp": datetime.now().isoformat(),
                                "confidence": abs(gaze_confidence)
                            })
                else:
                    print("🛑 Gaze detection disabled")
                    results["gaze"] = "disabled"
                    results["eyesOpen"] = True
                    results["blinking"] = False

                # ✅ ONLY DO HEAD POSE DETECTION IF ENABLED
                if detection_settings.get('gazeDetection', True):  # Head pose usually tied to gaze
                    head_pose, head_pose_confidence = detect_head_pose_enhanced(landmarks, w, h)
                    results["headPose"] = head_pose
                    results["enhancedFeatures"]["headPoseConfidence"] = head_pose_confidence
                    
                    if head_pose != "head forward" and head_pose_confidence > 0.5:
                        results["suspiciousActivities"].append(f"🙄 HEAD POSE: {head_pose} (confidence: {head_pose_confidence:.1%})")
                        
                        if exam_id and head_pose_confidence > 0.6:
                            send_proctoring_alert(exam_id, {
                                "message": f"🙄 Head movement: {head_pose}",
                                "type": "warning", 
                                "severity": "medium",
                                "timestamp": datetime.now().isoformat(),
                                "confidence": head_pose_confidence
                            })
                else:
                    print("🛑 Head pose detection disabled")
                    results["headPose"] = "disabled"

                # ✅ ONLY DO MOUTH MOVEMENT DETECTION IF ENABLED
                if detection_settings.get('mouthDetection', True):
                    is_talking, mouth_openness, mouth_confidence = detect_mouth_movement_enhanced(landmarks)
                    results["mouthMoving"] = is_talking
                    results["enhancedFeatures"]["mouthMovementConfidence"] = mouth_confidence / 4.0  # Normalize to 0-1
                    
                    if is_talking and mouth_confidence >= 2:
                        results["suspiciousActivities"].append(f"🗣️ MOUTH MOVEMENT: Possible talking (confidence: {mouth_confidence}/4)")
                        
                        if exam_id and mouth_confidence >= 3:
                            send_proctoring_alert(exam_id, {
                                "message": "🗣️ Suspicious mouth movement detected - Possible communication",
                                "type": "warning",
                                "severity": "medium",
                                "timestamp": datetime.now().isoformat(),
                                "confidence": mouth_confidence / 4.0
                            })
                else:
                    print("🛑 Mouth detection disabled")
                    results["mouthMoving"] = False

            # ✅ ONLY DO HAND DETECTION FOR PHONE/MOUSE IF ENABLED
            if detection_settings.get('phoneDetection', True):
                hand_results = hand_detector.process(rgb_img)
                pose_results = pose_detector.process(rgb_img)
                
                # ✅ ONLY DO PHONE DETECTION IF ENABLED
                phone_detected, phone_confidence = detect_phone_usage_enhanced(hand_results, face_center_x, face_center_y, w, h)
                results["phoneDetected"] = phone_detected
                results["enhancedFeatures"]["phoneConfidence"] = phone_confidence
                
                if phone_detected and phone_confidence > 0.5:
                    results["suspiciousActivities"].append(f"📱 POTENTIAL PHONE USAGE (confidence: {phone_confidence:.1%})")
                    
                    if exam_id and phone_confidence > 0.6:
                        send_proctoring_alert(exam_id, {
                            "message": "📱 Potential phone usage detected",
                            "type": "danger",
                            "severity": "high", 
                            "timestamp": datetime.now().isoformat(),
                            "confidence": phone_confidence
                        })
            else:
                print("🛑 Phone detection disabled")
                results["phoneDetected"] = False

            # ✅ ONLY DO MOUSE DETECTION IF ENABLED (usually tied to phone detection)
            if detection_settings.get('phoneDetection', True):
                mouse_detected, mouse_confidence = detect_mouse_usage_enhanced(hand_results, pose_results, w, h)
                results["mouseDetected"] = mouse_detected
                results["enhancedFeatures"]["mouseConfidence"] = mouse_confidence
                
                if mouse_detected and mouse_confidence > 0.6:
                    results["suspiciousActivities"].append(f"🖱️ POTENTIAL MOUSE USAGE (confidence: {mouse_confidence:.1%})")
                    
                    if exam_id and mouse_confidence > 0.7:
                        send_proctoring_alert(exam_id, {
                            "message": "🖱️ Potential unauthorized device usage detected",
                            "type": "warning",
                            "severity": "medium", 
                            "timestamp": datetime.now().isoformat(),
                            "confidence": mouse_confidence
                        })
            else:
                print("🛑 Mouse detection disabled")
                results["mouseDetected"] = False

        else:
            # Only show no face alert if face detection is enabled
            if detection_settings.get('faceDetection', True):
                results["suspiciousActivities"].append("❌ NO FACE: Face not visible in camera")
                
                if exam_id:
                    send_proctoring_alert(exam_id, {
                        "message": "❌ Face not visible - Please adjust camera position",
                        "type": "warning",
                        "severity": "high",
                        "timestamp": datetime.now().isoformat()
                    })

        # ✅ ENHANCED attention score calculation - ONLY COUNT ENABLED DETECTIONS
        violation_count = len(results["suspiciousActivities"])
        
        # Calculate weighted penalty based on confidence - ONLY FOR ENABLED DETECTIONS
        confidence_penalty = 0
        for activity in results["suspiciousActivities"]:
            if "confidence:" in activity:
                try:
                    # Extract confidence from activity string
                    conf_str = activity.split("confidence:")[1].split(")")[0].split("%")[0]
                    if "/" in conf_str:
                        # Handle fraction-based confidence (e.g., "2/4")
                        parts = conf_str.split("/")
                        if len(parts) == 2:
                            confidence_val = float(parts[0]) / float(parts[1])
                    else:
                        confidence_val = float(conf_str.strip().rstrip('%')) / 100.0
                    
                    confidence_penalty += min(25, 20 * confidence_val)
                except:
                    confidence_penalty += 15  # Default penalty
        
        results["attentionScore"] = max(0, 100 - confidence_penalty)
        results["detectionConfidence"] = calculate_overall_confidence(results)
        
        # Only send low attention alert if relevant detections are enabled
        if exam_id and results["attentionScore"] < 70 and any([
            detection_settings.get('gazeDetection', True),
            detection_settings.get('phoneDetection', True),
            detection_settings.get('multiplePeopleDetection', True)
        ]):
            send_proctoring_alert(exam_id, {
                "message": f"📉 Low attention score: {results['attentionScore']}% - High distraction level",
                "type": "danger",
                "severity": "high",
                "timestamp": datetime.now().isoformat(),
                "confidence": results["detectionConfidence"]
            })

        # Enhanced debug image with settings information
        try:
            settings_status = f"Settings: Face:{detection_settings.get('faceDetection',True)} Gaze:{detection_settings.get('gazeDetection',True)}"
            status_text = f"Faces: {results['faceCount']} | Gaze: {results['gaze']} | Head: {results['headPose']}"
            confidence_text = f"Overall Confidence: {results['detectionConfidence']:.1%}"
            score_text = f"Attention: {results['attentionScore']}% | Alerts: {violation_count}"
            
            cv2.putText(img, "ENHANCED PROCTORING SYSTEM", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            cv2.putText(img, settings_status, (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
            cv2.putText(img, status_text, (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            cv2.putText(img, confidence_text, (10, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            cv2.putText(img, score_text, (10, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            
            # Display confidence levels
            y_offset = 180
            for feature, confidence in results["enhancedFeatures"].items():
                if confidence > 0:
                    feature_name = feature.replace("Confidence", "").replace("_", " ").title()
                    conf_text = f"{feature_name}: {confidence:.1%}"
                    cv2.putText(img, conf_text, (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
                    y_offset += 20
            
            if results["suspiciousActivities"]:
                for i, activity in enumerate(results["suspiciousActivities"][:3]):
                    color = (0, 0, 255) if any(keyword in activity for keyword in ["PHONE", "MULTIPLE", "LOW ATTENTION"]) else (0, 165, 255)
                    cv2.putText(img, f"• {activity}", (10, y_offset + i*25), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

            _, buffer = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 80])
            debug_img = base64.b64encode(buffer).decode("utf-8")
            results["debugImage"] = f"data:image/jpeg;base64,{debug_img}"
        except Exception as e:
            print(f"Debug image error: {e}")

        # Calculate processing time
        results["processingTime"] = round((time.time() - start_time) * 1000, 2)

        print(f"✅ Detection completed - Settings: {detection_settings}, Alerts: {len(results['suspiciousActivities'])}")
        return jsonify(results)

    except Exception as e:
        print(f"Detection error: {e}")
        return jsonify({"error": str(e), "message": "Internal server error occurred"}), 500

def calculate_overall_confidence(results):
    """Calculate overall detection confidence"""
    try:
        confidences = []
        
        # Face detection confidence
        if results["faceDetected"]:
            confidences.append(0.8)
        else:
            confidences.append(0.2)
        
        # Add feature confidences
        for feature, confidence in results["enhancedFeatures"].items():
            if confidence > 0:
                confidences.append(confidence)
        
        # Calculate weighted average
        if confidences:
            return sum(confidences) / len(confidences)
        else:
            return 0.5  # Default medium confidence
            
    except Exception as e:
        print(f"Confidence calculation error: {e}")
        return 0.5

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy", 
        "timestamp": datetime.now().isoformat(),
        "version": "enhanced-proctoring-with-settings",
        "connected_clients": len(connected_clients),
        "features": [
            "Respects teacher detection settings",
            "Configurable face detection",
            "Configurable gaze detection", 
            "Configurable phone detection",
            "Configurable mouth detection",
            "Configurable multiple people detection"
        ]
    })

@app.route('/test', methods=['GET'])
def test_endpoint():
    return jsonify({
        "message": "ENHANCED Proctoring Backend is working!", 
        "status": "success",
        "features": [
            "Enhanced gaze detection with pupil tracking",
            "Improved head pose analysis with symmetry checks",
            "Advanced phone detection with multiple factors",
            "Enhanced mouth movement detection",
            "Confidence-based alert system",
            "Image quality enhancement"
        ]
    })

if __name__ == "__main__":
    print("🚀 ENHANCED PROCTORING Server Running...")
    print("📡 ENHANCED Features:")
    print("   • Improved gaze detection with pupil tracking")
    print("   • Enhanced head pose analysis with symmetry checks")
    print("   • Advanced phone detection with multiple confidence factors")
    print("   • Better mouth movement detection with multiple metrics")
    print("   • Confidence-based alert system")
    print("   • Image quality enhancement for better detection")
    print("   • Multiple people detection with position analysis")
    print("   • Enhanced audio analysis with spectral features")
    print("🌐 Access the server at: http://localhost:5000")
    eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 5000)), app_socket)