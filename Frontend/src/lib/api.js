// src/lib/api.js - UPDATED VERSION WITH ANNOUNCEMENT FUNCTIONS
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
  withCredentials: true,
  timeout: 10000,
});

// SINGLE Request interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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

// ===== ANNOUNCEMENT FUNCTIONS =====
export const createAnnouncement = async (announcementData) => {
  const response = await api.post('/announcements', announcementData);
  return response.data;
};

export const getAnnouncements = async (classId) => {
  const response = await api.get(`/announcements/class/${classId}`);
  return response.data;
};

export const updateAnnouncement = async (announcementId, updateData) => {
  const response = await api.put(`/announcements/${announcementId}`, updateData);
  return response.data;
};

export const deleteAnnouncement = async (announcementId) => {
  const response = await api.delete(`/announcements/${announcementId}`);
  return response.data;
};

export const addCommentToAnnouncement = async (announcementId, commentData) => {
  const response = await api.post(`/announcements/${announcementId}/comments`, commentData);
  return response.data;
};

export const deleteCommentFromAnnouncement = async (announcementId, commentId) => {
  const response = await api.delete(`/announcements/${announcementId}/comments/${commentId}`);
  return response.data;
};

export const getAnnouncementComments = async (announcementId) => {
  const response = await api.get(`/announcements/${announcementId}/comments`);
  return response.data;
};

// ===== QUIZ COMMENT FUNCTIONS =====
// ✅ OLD COMMENT FUNCTIONS (renamed to avoid conflicts)
export const getQuizCommentsOld = (quizId) => api.get(`/comments/${quizId}`);
export const postQuizCommentOld = (quizId, text) =>
  api.post(`/comments/${quizId}`, { text });

// ✅ NEW COMMENT FUNCTIONS
export const getQuizComments = async (classId, quizId) => {
  const response = await api.get(`/classwork/${classId}/quiz/${quizId}/comments`);
  return response.data;
};

export const addQuizComment = async (classId, quizId, content) => {
  const response = await api.post(`/classwork/${classId}/quiz/${quizId}/comments`, {
    content
  });
  return response.data;
};

export const deleteQuizComment = async (classId, quizId, commentId) => {
  const response = await api.delete(`/classwork/${classId}/quiz/${quizId}/comments/${commentId}`);
  return response.data;
};

// ===== USER PROFILE WITH IMAGE SUPPORT =====
export const getUserProfile = async () => {
  const response = await api.get('/auth/me');
  console.log('👤 User profile response:', response.data);
  return response.data;
};

export const updateUserProfile = async (userData) => {
  // Check if userData contains a file (profile image)
  if (userData.profileImage instanceof File) {
    const formData = new FormData();
    
    // Append all user data to formData
    Object.keys(userData).forEach(key => {
      if (key === 'profileImage' && userData[key] instanceof File) {
        formData.append('profileImage', userData[key]);
      } else if (key !== 'profileImage') {
        formData.append(key, userData[key]);
      }
    });

    console.log('🖼️ Uploading profile image with FormData');
    const response = await api.put('/auth/profile', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  } else {
    // Regular JSON update
    const response = await api.put('/auth/profile', userData);
    return response.data;
  }
};

// Enhanced profile image upload function
export const uploadProfileImage = async (imageFile) => {
  try {
    const formData = new FormData();
    formData.append('profileImage', imageFile);

    console.log('📤 Uploading profile image...');
    const response = await api.post('/auth/upload-profile-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000 // Longer timeout for image uploads
    });

    console.log('✅ Profile image uploaded successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Profile image upload failed:', error);
    
    if (error.response?.status === 413) {
      throw new Error('Profile image too large. Maximum size is 5MB.');
    }
    if (error.response?.status === 400) {
      throw new Error(error.response.data?.message || 'Invalid image format. Use JPG, PNG, or WebP.');
    }
    
    throw new Error(error.response?.data?.message || 'Failed to upload profile image.');
  }
};

// Delete profile image
export const deleteProfileImage = async () => {
  const response = await api.delete('/auth/profile-image');
  return response.data;
};

// Get user profile by ID (for student/teacher profiles)
export const getUserProfileById = async (userId) => {
  const response = await api.get(`/auth/users/${userId}/profile`);
  console.log('👤 User profile by ID response:', response.data);
  return response.data;
};

// ===== STUDENT MANAGEMENT API WITH PROFILE IMAGES =====
export const getClassPeople = async (classId) => {
  try {
    const response = await api.get(`/student-management/${classId}/students`);
    console.log('👥 Class people API response:', response.data);
    
    if (response.data.success && response.data.data) {
      const { teachers, students } = response.data.data;
      
      console.log('📊 Profile Image Stats:', {
        teachers: teachers?.length || 0,
        students: students?.length || 0,
        teachersWithImages: teachers?.filter(t => t.profileImage)?.length || 0,
        studentsWithImages: students?.filter(s => s.profileImage)?.length || 0
      });
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching class people:', error);
    throw error;
  }
};

// Update student profile (for teachers)
export const updateStudentProfile = async (studentId, studentData) => {
  if (studentData.profileImage instanceof File) {
    const formData = new FormData();
    Object.keys(studentData).forEach(key => {
      if (key === 'profileImage' && studentData[key] instanceof File) {
        formData.append('profileImage', studentData[key]);
      } else if (key !== 'profileImage') {
        formData.append(key, studentData[key]);
      }
    });

    const response = await api.put(`/student-management/students/${studentId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  } else {
    const response = await api.put(`/student-management/students/${studentId}`, studentData);
    return response.data;
  }
};

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

// ===== STUDENT MANAGEMENT API =====
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
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    console.log('✅ File uploaded and parsed successfully:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('❌ File upload failed:', error);

    if (error.response?.status === 413)
      throw new Error('File too large. Maximum size is 10MB.');
    if (error.response?.status === 400)
      throw new Error(error.response.data?.message || 'Invalid file format.');
    if (error.response?.status === 403)
      throw new Error('You are not authorized to upload files to this class.');

    throw new Error(error.response?.data?.message || 'Failed to process file.');
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

// ===== COMPLETION TRACKING API =====
export const markExamAsCompleted = async (examId, completionData) => {
  const response = await api.post(`/exams/${examId}/complete`, completionData);
  return response.data;
};

export const getCompletedExams = async () => {
  const response = await api.get('/exams/student/completed');
  return response.data;
};

export const getExamCompletionStatus = async (examId) => {
  const response = await api.get(`/exams/${examId}/completion-status`);
  return response.data;
};

// ===== STUDENT QUIZ =====
export const getQuizForStudent = async (examId) => {
  try {
    const response = await api.get(`/exams/take/${examId}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404)
      return { success: false, message: "Quiz not found." };

    if (error.response?.status === 403)
      return { success: false, message: error.response.data?.message };

    return { success: false, message: "Network error." };
  }
};

export const submitQuizAnswers = async (examId, answers) => {
  try {
    const response = await api.post(`/exams/${examId}/submit`, { answers });
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to submit answers."
    };
  }
};

// ===== QUIZ DELETE =====
export const deleteQuiz = async (examId) => {
  try {
    const response = await api.delete(`/exams/${examId}`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to delete quiz:', error);
    
    if (error.response?.status === 404) {
      throw new Error('Quiz not found. It may have already been deleted.');
    }
    if (error.response?.status === 403) {
      throw new Error('You are not authorized to delete this quiz.');
    }
    
    throw new Error(error.response?.data?.message || 'Failed to delete quiz.');
  }
};

export const deleteAllQuizzes = async (classId) => {
  try {
    console.log(`🗑️ Deleting all quizzes for class: ${classId}`);
    const response = await api.delete(`/exams/class/${classId}/delete-all`);
    console.log('✅ All quizzes deleted successfully');
    return response.data;
  } catch (error) {
    console.error('❌ Failed to delete all quizzes:', error);
    
    if (error.response?.status === 404) {
      throw new Error('Class not found or no quizzes to delete.');
    }
    if (error.response?.status === 403) {
      throw new Error('You are not authorized to delete quizzes from this class.');
    }
    
    throw new Error(error.response?.data?.message || 'Failed to delete all quizzes.');
  }
};

// ===== CLASSWORK =====
export const getClasswork = async (classId) => {
  try {
    const response = await api.get(`/classwork/${classId}`);
    return response.data;
  } catch {
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

// ===== AUTH =====
export const getAuthStatus = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const logoutUser = async () => {
  const response = await api.post('/auth/logout');
  return response.data;
};

// ===== FILE UPLOAD =====
export const uploadFile = async (file, classId) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('classId', classId);

  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const deleteFile = async (fileId) => {
  const response = await api.delete(`/upload/${fileId}`);
  return response.data;
};

// ===== SUBMISSION =====
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

// ===== ANALYTICS =====
export const getClassAnalytics = async (classId) => {
  const response = await api.get(`/analytics/class/${classId}`);
  return response.data;
};

export const getExamAnalytics = async (examId) => {
  const response = await api.get(`/analytics/exam/${examId}`);
  return response.data;
};

// ===== EXAM SESSION =====
export const startExamSession = async (examId) => {
  const response = await api.post(`/exams/${examId}/start-session`);
  return response.data;
};

export const endExamSession = async (examId) => {
  try {
    const response = await api.post(`/exams/${examId}/end-session`);
    return response.data;
  } catch (error) {
    console.error('Error ending exam session:', error);
    throw error;
  }
};

export const getExamSession = async (examId) => {
  const response = await api.get(`/exams/${examId}/session`);
  return response.data;
};

export const getTeacherActiveSessions = async () => {
  const response = await api.get('/exams/teacher/active-sessions');
  return response.data;
};

export const getJoinedStudents = async (examId) => {
  const response = await api.get(`/exams/${examId}/joined-students`);
  return response.data;
};

export const joinExamSession = async (examId) => {
  try {
    const response = await api.post(`/exams/${examId}/join`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 403)
      throw new Error(error.response.data.message || "Exam session is not active");
    throw error;
  }
};

export const getExamSessionStatus = async (examId) => {
  const response = await api.get(`/exams/${examId}/session-status`);
  return response.data;
};

export const reportProctoringAlert = async (examId, alertData) => {
  const response = await api.post(`/exams/${examId}/proctoring-alert`, alertData);
  return response.data;
};

// Proctoring
export const checkProctoringHealth = async () => {
  const response = await fetch('http://localhost:5000/health');
  return await response.json();
};

export const analyzeProctoringFrame = async (imageData) => {
  const response = await fetch('http://localhost:5000/detect-faces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageData })
  });
  return await response.json();
};

// DEFAULT EXPORT
export default api;