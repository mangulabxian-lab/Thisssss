export const VIOLATION_TYPES = {
  GAZE_DEVIATION: 'gaze_deviation',
  HEAD_POSE: 'head_pose',
  PHONE_USAGE: 'phone_usage',
  MULTIPLE_PEOPLE: 'multiple_people',
  MOUTH_MOVEMENT: 'mouth_movement',
  NO_FACE: 'no_face',
  AUDIO_DETECTION: 'audio_detection',
  LOW_ATTENTION: 'low_attention',
  MOUSE_USAGE: 'mouse_usage',
  TAB_SWITCHING: 'tab_switching',
  MANUAL_VIOLATION: 'manual_violation'
};

export const VIOLATION_MESSAGES = {
  [VIOLATION_TYPES.GAZE_DEVIATION]: 'EYE GAZE deviation detected',
  [VIOLATION_TYPES.HEAD_POSE]: 'HEAD POSE deviation detected',
  [VIOLATION_TYPES.PHONE_USAGE]: 'PHONE USAGE detected',
  [VIOLATION_TYPES.MULTIPLE_PEOPLE]: 'MULTIPLE PEOPLE detected',
  [VIOLATION_TYPES.MOUTH_MOVEMENT]: 'MOUTH MOVEMENT detected',
  [VIOLATION_TYPES.NO_FACE]: 'NO FACE detected',
  [VIOLATION_TYPES.AUDIO_DETECTION]: 'AUDIO anomaly detected',
  [VIOLATION_TYPES.LOW_ATTENTION]: 'LOW ATTENTION detected',
  [VIOLATION_TYPES.MOUSE_USAGE]: 'Suspicious MOUSE USAGE',
  [VIOLATION_TYPES.TAB_SWITCHING]: 'TAB SWITCHING detected',
  [VIOLATION_TYPES.MANUAL_VIOLATION]: 'Manual violation issued by teacher'
};