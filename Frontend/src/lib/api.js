// src/lib/api.js - FIXED VERSION WITH DEFAULT EXPORT
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
  withCredentials: true,
  timeout: 10000, // ✅ ADD TIMEOUT
});

// SINGLE Request interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('✅ Token added to request');
  } else {
    console.warn('⚠️ No token found in localStorage');
    
    // Don't block the request, let the server handle authentication
    // This prevents infinite loops when token is expired
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor for handling auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.log('🔐 Authentication failed, redirecting to login');
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ===== NOTIFICATION FUNCTIONS =====
export const getNotifications = async (page = 1, limit = 20) => {
  const response = await api.get(`/notifications?page=${page}&limit=${limit}`);
  return response.data;
};

export const markNotificationAsRead = async (notificationId) => {
  const response = await api.put(`/notifications/${notificationId}/read`);
  return response.data;
};

export const markAllNotificationsAsRead = async () => {
  const response = await api.put('/notifications/read-all');
  return response.data;
};

export const deleteNotification = async (notificationId) => {
  const response = await api.delete(`/notifications/${notificationId}`);
  return response.data;
};

export const clearAllNotifications = async () => {
  const response = await api.delete('/notifications');
  return response.data;
};

export const getUnreadCount = async () => {
  const response = await api.get('/notifications/unread-count');
  return response.data;
};

export const updateNotificationPreferences = async (preferences) => {
  const response = await api.put('/auth/notification-preferences', {
    notificationPreferences: preferences
  });
  return response.data;
};

// ===== STUDENT MANAGEMENT API FUNCTIONS =====
export const getClassPeople = async (classId) => {
  const response = await api.get(`/student-management/${classId}/students`);
  return response.data;
};

export const removeStudentFromClass = async (classId, studentId) => {
  const response = await api.delete(`/student-management/${classId}/students/${studentId}`);
  return response.data;
};

export const toggleStudentMute = async (classId, studentId) => {
  const response = await api.patch(`/student-management/${classId}/students/${studentId}/mute`);
  return response.data;
};

export const emailStudents = async (classId, emailData) => {
  const response = await api.post(`/student-management/${classId}/email-students`, emailData);
  return response.data;
};

// ===== QUIZ/EXAM FUNCTIONS =====
export const createQuiz = async (classId, quizData) => {
  const response = await api.post(`/exams/create/${classId}`, quizData);
  return response.data;
};

export const updateQuiz = async (examId, quizData) => {
  const response = await api.put(`/exams/${examId}/quiz-questions`, quizData);
  return response.data;
};

export const getQuizForEdit = async (examId) => {
  const response = await api.get(`/exams/${examId}/edit`);
  return response.data;
};

export const deployExam = async (examId) => {
  const response = await api.patch(`/exams/deploy/${examId}`);
  return response.data;
};

// ===== REAL FILE UPLOAD & PARSE =====
export const uploadFileAndParse = async (formData) => {
  try {
    console.log('📁 REAL: Uploading file for parsing...');
    
    const response = await api.post('/exams/upload-parse', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    console.log('✅ File uploaded and parsed successfully:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('❌ File upload failed:', error);
    
    if (error.response?.status === 413) {
      throw new Error('File too large. Maximum size is 10MB.');
    } else if (error.response?.status === 400) {
      throw new Error(error.response.data?.message || 'Invalid file format.');
    } else if (error.response?.status === 403) {
      throw new Error('You are not authorized to upload files to this class.');
    } else if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    } else {
      throw new Error('Failed to process file. Please try again.');
    }
  }
};

export const getExams = async (classId) => {
  const response = await api.get(`/exams/${classId}`);
  return response.data;
};

export const getExamDetails = async (examId) => {
  const response = await api.get(`/exams/${examId}/details`);
  return response.data;
};

// ===== STUDENT QUIZ FUNCTIONS =====
export const getQuizForStudent = async (examId) => {
  try {
    console.log('🎯 Getting quiz for student, exam ID:', examId);
    
    const response = await api.get(`/exams/take/${examId}`);
    console.log('✅ Student quiz response:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get quiz for student:', error);
    
    // Better error handling
    if (error.response?.status === 404) {
      return {
        success: false,
        message: "Quiz not found. It may have been deleted or you don't have access."
      };
    } else if (error.response?.status === 403) {
      return {
        success: false,
        message: error.response.data?.message || "You don't have permission to access this quiz."
      };
    } else if (error.response?.data?.message) {
      return {
        success: false,
        message: error.response.data.message
      };
    } else {
      return {
        success: false,
        message: "Network error. Please check your connection and try again."
      };
    }
  }
};

// FIXED: Submit quiz answers function
export const submitQuizAnswers = async (examId, answers) => {
  try {
    console.log('📝 Submitting quiz answers for exam:', examId);
    
    const response = await api.post(`/exams/${examId}/submit`, { answers });
    console.log('✅ Quiz submission response:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('❌ Failed to submit quiz answers:', error);
    
    if (error.response?.data?.message) {
      return {
        success: false,
        message: error.response.data.message
      };
    } else {
      return {
        success: false,
        message: "Failed to submit answers. Please try again."
      };
    }
  }
};

// ===== INDIVIDUAL QUIZ DELETE =====
export const deleteQuiz = async (examId) => {
  const response = await api.delete(`/exams/${examId}`);
  return response.data;
};

// ===== DELETE ALL QUIZZES/FORMS =====
export const deleteAllQuizzes = async (classId) => {
  const response = await api.delete(`/exams/class/${classId}/delete-all`);
  return response.data;
};

// ===== CLASSWORK API FUNCTIONS =====
export const getClasswork = async (classId) => {
  try {
    const response = await api.get(`/classwork/${classId}`);
    return response.data;
  } catch (error) {
    console.log("Classwork endpoint not available, returning empty array");
    return { success: true, data: [] };
  }
};

export const createClasswork = async (classworkData) => {
  const response = await api.post("/classwork/create", classworkData);
  return response.data;
};

export const updateClasswork = async (classworkId, classworkData) => {
  const response = await api.put(`/classwork/${classworkId}`, classworkData);
  return response.data;
};

export const deleteClasswork = async (classworkId) => {
  const response = await api.delete(`/classwork/${classworkId}`);
  return response.data;
};

export const getClassTopics = async (classId) => {
  const response = await api.get(`/classwork/${classId}/topics`);
  return response.data;
};

// ===== CLASS FUNCTIONS =====
export const getClassDetails = async (classId) => {
  const response = await api.get(`/class/${classId}`);
  return response.data;
};

export const getClassMembers = async (classId) => {
  const response = await api.get(`/class/${classId}/members`);
  return response.data;
};

export const createClass = async (classData) => {
  const response = await api.post('/class', classData);
  return response.data;
};

export const joinClass = async (classCode) => {
  const response = await api.post('/class/join', { code: classCode });
  return response.data;
};

export const getMyClasses = async () => {
  const response = await api.get('/class/my-classes');
  return response.data;
};

export const archiveClass = async (classId) => {
  const response = await api.put(`/class/${classId}/archive`);
  return response.data;
};

export const restoreClass = async (classId) => {
  const response = await api.put(`/class/${classId}/restore`);
  return response.data;
};

export const getArchivedClasses = async () => {
  const response = await api.get('/class/archived');
  return response.data;
};

export const unenrollFromClass = async (classId) => {
  const response = await api.delete(`/class/${classId}/unenroll`);
  return response.data;
};

// ===== AUTH FUNCTIONS =====
export const getAuthStatus = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const logoutUser = async () => {
  const response = await api.post('/auth/logout');
  return response.data;
};

// ===== USER FUNCTIONS =====
export const getUserProfile = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const updateUserProfile = async (userData) => {
  const response = await api.put('/auth/profile', userData);
  return response.data;
};

// ===== FILE UPLOAD FUNCTIONS =====
export const uploadFile = async (file, classId) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('classId', classId);

  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const deleteFile = async (fileId) => {
  const response = await api.delete(`/upload/${fileId}`);
  return response.data;
};

// ===== SUBMISSION FUNCTIONS =====
export const submitAssignment = async (assignmentId, submissionData) => {
  const response = await api.post(`/assignments/${assignmentId}/submit`, submissionData);
  return response.data;
};

export const getSubmissions = async (assignmentId) => {
  const response = await api.get(`/assignments/${assignmentId}/submissions`);
  return response.data;
};

export const gradeSubmission = async (submissionId, gradeData) => {
  const response = await api.put(`/submissions/${submissionId}/grade`, gradeData);
  return response.data;
};

// ===== ANALYTICS FUNCTIONS =====
export const getClassAnalytics = async (classId) => {
  const response = await api.get(`/analytics/class/${classId}`);
  return response.data;
};

export const getExamAnalytics = async (examId) => {
  const response = await api.get(`/analytics/exam/${examId}`);
  return response.data;
};

// ===== EXAM SESSION FUNCTIONS =====
export const startExamSession = async (examId) => {
  try {
    const response = await api.post(`/exams/${examId}/start-session`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const endExamSession = async (examId) => {
  try {
    const response = await api.post(`/exams/${examId}/end`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getExamSession = async (examId) => {
  try {
    const response = await api.get(`/exams/${examId}/session`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// ✅ GET ACTIVE EXAM SESSIONS FOR TEACHER
export const getTeacherActiveSessions = async () => {
  try {
    const response = await api.get('/exams/teacher/active-sessions');
    return response.data;
  } catch (error) {
    console.error('Failed to get active sessions:', error);
    throw error;
  }
};

// ✅ GET JOINED STUDENTS
export const getJoinedStudents = async (examId) => {
  try {
    const response = await api.get(`/exams/${examId}/joined-students`);
    return response.data;
  } catch (error) {
    console.error('Failed to get joined students:', error);
    throw error;
  }
};

// ✅ STUDENT JOIN EXAM
export const joinExamSession = async (examId) => {
  try {
    const response = await api.post(`/exams/${examId}/join`);
    return response.data;
  } catch (error) {
    console.error('Failed to join exam session:', error);
    
    // Handle specific errors
    if (error.response?.status === 403) {
      throw new Error(error.response.data.message || "Exam session is not active");
    }
    throw error;
  }
};

// Get exam session status (for timer sync)
export const getExamSessionStatus = async (examId) => {
  try {
    const response = await api.get(`/exams/${examId}/session-status`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Report proctoring alert to teacher
export const reportProctoringAlert = async (examId, alertData) => {
  try {
    const response = await api.post(`/exams/${examId}/proctoring-alert`, alertData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Proctoring endpoints
export const checkProctoringHealth = async () => {
  try {
    const response = await fetch('http://localhost:5000/health');
    return await response.json();
  } catch (error) {
    throw error;
  }
};

export const analyzeProctoringFrame = async (imageData) => {
  try {
    const response = await fetch('http://localhost:5000/detect-faces', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageData }),
    });
    return await response.json();
  } catch (error) {
    throw error;
  }
};

// ✅ ADD THIS LINE - DEFAULT EXPORT FOR THE API INSTANCE
export default api;