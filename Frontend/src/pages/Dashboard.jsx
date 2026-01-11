// src/pages/Dashboard.jsx - UPDATED WITH SIMPLIFIED SETTINGS
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaPlus, FaHome, FaCalendarAlt, FaArchive, FaCog, FaSignOutAlt, FaBook, FaUserPlus, FaBars, FaChevronLeft, FaChevronRight, FaEdit, FaTrash, FaEllipsisV, FaChevronDown, FaEnvelope, FaUserMinus, FaVolumeMute, FaVolumeUp, FaSave, FaTimes, FaCheckCircle, FaClock, FaExclamationTriangle } from "react-icons/fa";
import api, { 
  deleteAllQuizzes, 
  deleteQuiz, 
  getQuizForStudent, 
  joinExamSession
} from "../lib/api";
import "./Dashboard.css";
import io from 'socket.io-client';
import * as XLSX from 'xlsx';

// ✅ ADDED: Import components from correct paths
import ViolationSummaryModal from '../components/ViolationSummaryModal';
import ClassCard from "../components/ClassCard";
// ✅ ADDED: Import separated tab components from components folder
import PeopleTab from '../components/PeopleTab';
import GradesTab from '../components/GradesTab';

// Utility function to format exam type display
const getExamTypeDisplay = (exam) => {
  // ✅ ALWAYS SHOW AS LIVE CLASS
  return {
    type: 'live',
    label: '🎥 Live Class',
    icon: '🎥',
    color: 'bg-blue-100 text-blue-800 border border-blue-200'
  };
};

// ✅ ADDED: Function to check live session status (polling backup)
const checkLiveSessionStatus = async (examId) => {
  try {
    const response = await api.get(`/exams/${examId}/session-status`);
    if (response.data.success && response.data.data.isActive) {
      return { isActive: true, data: response.data.data };
    }
  } catch (error) {
    console.log('Session check failed:', error);
  }
  return { isActive: false };
};

// ✅ UPDATED: Utility function to get appropriate action button - LIVE CLASSES ONLY
const getExamActionButton = (exam, userRole, userId) => {
  // ✅ ALL EXAMS ARE NOW LIVE CLASSES
  const isLiveClass = true; // Always true now
  
  if (userRole === 'teacher') {
    // Teacher can only manage live classes
    if (exam.isActive) {
      return {
        label: 'Manage Class',
        variant: 'live-active',
        icon: '🎥',
        action: 'manage-live-class'
      };
    } else {
      return {
        label: 'Start Class',
        variant: 'live',
        icon: '🎥',
        action: 'start-live-class'
      };
    }
  } else {
    // Student view for live classes only
    const hasCompleted = exam.completedBy?.some(completion => 
      completion.studentId === userId
    );
    
    if (hasCompleted) {
      return {
        label: 'Review Answers',
        variant: 'completed',
        icon: '📊',
        action: 'review'
      };
    }
    
    // Check if live class has ended
    if (exam.endedAt && new Date(exam.endedAt) < new Date()) {
      return {
        label: 'Session Ended',
        variant: 'disabled',
        icon: '🛑',
        action: 'none'
      };
    }
    
    if (exam.isActive) {
      return {
        label: 'Join Class',
        variant: 'live',
        icon: '🎥',
        action: 'join-live-class'
      };
    } else {
      return {
        label: 'Not Started',
        variant: 'disabled',
        icon: '⏸️',
        action: 'none'
      };
    }
  }
};

export default function Dashboard() {
  // ===== ROUTING HOOKS =====
  const navigate = useNavigate();
  const location = useLocation();

  // ===== USER AT CLASS STATES =====
  const [user, setUser] = useState({ name: "Loading...", email: "", _id: "", profileImage: "" });
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [activeSidebar, setActiveSidebar] = useState("home");
  const [activeTab, setActiveTab] = useState("classwork");

  // ===== SOCKET REF =====
  const socketRef = useRef(null);

  // ===== GRADES SORT STATE =====
  const [gradeSortBy, setGradeSortBy] = useState("lastName");
  const [showSortMenu, setShowSortMenu] = useState(false);

  // ===== MODAL STATES =====
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [className, setClassName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  // ===== SETTINGS MODAL STATES =====
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsData, setSettingsData] = useState({
    name: "",
    email: "",
    profilePicture: "",
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // ===== CHANGE PASSWORD MODAL STATES (ADDED) =====
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [changingPassword, setChangingPassword] = useState(false);

  // ===== EXAM DEPLOYMENT STATES =====
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [examToDeploy, setExamToDeploy] = useState(null);
  const [deployingExam, setDeployingExam] = useState(false);
  const [deployedExams, setDeployedExams] = useState([]);

  // ===== CLASS DETAILS STATES =====
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);

  // ===== DROPDOWN STATES =====
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showCreateJoinDropdown, setShowCreateJoinDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [quizLoading, setQuizLoading] = useState(false);

  // ===== ANNOUNCEMENT STATES =====
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementContent, setAnnouncementContent] = useState("");
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  // ===== COMMENT STATES =====
  const [postingComments, setPostingComments] = useState({});
  const [showCommentMenu, setShowCommentMenu] = useState(null);
  const [showCommentDeleteMenu, setShowCommentDeleteMenu] = useState(null);

  // ===== CLASSWORK STATES =====
  const [classwork, setClasswork] = useState([]);

  // ===== QUIZ MANAGEMENT STATES =====
  const [deletingAll, setDeletingAll] = useState(false);
  const [deletingQuiz, setDeletingQuiz] = useState(null);

  // ===== QUIZ MENU STATES =====
  const [showQuizMenu, setShowQuizMenu] = useState(null);
  const [quizToDelete, setQuizToDelete] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ===== QUIZ CARDS DATA STATE =====
  const [quizCardsData, setQuizCardsData] = useState([]);

  // ===== CLASS MANAGEMENT STATES =====
  const [showMenuForClass, setShowMenuForClass] = useState(null);
  const [showUnenrollModal, setShowUnenrollModal] = useState(false);
  const [classToUnenroll, setClassToUnenroll] = useState(null);

  // ===== ARCHIVE STATES =====
  const [archivedClasses, setArchivedClasses] = useState([]);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [classToArchive, setClassToArchive] = useState(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [classToRestore, setClassToRestore] = useState(null);

  // ===== CALENDAR STATES =====
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState("all");

  // ===== USER ROLE STATE =====
  const [userRole, setUserRole] = useState("");

  // ===== SIDEBAR DROPDOWN STATES =====
  const [enrolledDropdownOpen, setEnrolledDropdownOpen] = useState(false);
  const [teachingDropdownOpen, setTeachingDropdownOpen] = useState(false);

  // ===== REVIEW COUNT STATE =====
  const [itemsToReview, setItemsToReview] = useState(0);

  // ===== PEOPLE TAB STATES =====
  const [classPeople, setClassPeople] = useState({ teachers: [], students: [] });
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [activeActions, setActiveActions] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [emailData, setEmailData] = useState({ subject: '', message: '' });

  // ===== COMPLETED EXAMS STATE =====
  const [completedExams, setCompletedExams] = useState([]);
  const [loadingCompleted, setLoadingCompleted] = useState(false);

  // ===== GRADES TAB STATE =====
  const [gradesLoading, setGradesLoading] = useState(false);
  const [gradesData, setGradesData] = useState({
    overall: null,
    examStats: [],
    studentStats: [],
    exams: [],      // raw exams with completedBy[]
    students: []    // class roster
  });

  // which screen we are in inside Grades tab
  // "overview" | "exam" | "student"
  const [gradesView, setGradesView] = useState("overview");
  const [selectedExamId, setSelectedExamId] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  // ===== TO DO TAB STATES =====
  const [todoAssignments, setTodoAssignments] = useState([]);
  const [todoCompletedAssignments, setTodoCompletedAssignments] = useState([]);
  const [todoActiveTab, setTodoActiveTab] = useState("assigned");
  const [todoLoading, setTodoLoading] = useState(false);

  // ===== VIOLATION SUMMARY MODAL STATE =====
  const [showViolationSummary, setShowViolationSummary] = useState(false);
  const [selectedExamForSummary, setSelectedExamForSummary] = useState(null);

  // ===== REFS FOR CLICK OUTSIDE DETECTION =====
  const userDropdownRef = useRef(null);
  const createJoinDropdownRef = useRef(null);
  const sidebarRef = useRef(null);
  const menuRef = useRef(null);
  const commentMenuRef = useRef(null);
  const commentDeleteMenuRef = useRef(null);
  const actionsDropdownRef = useRef(null);
  const settingsModalRef = useRef(null);

  // ===== LOCAL STATE FOR SETTINGS INPUTS =====
  const [localName, setLocalName] = useState("");
  const [localEmail, setLocalEmail] = useState("");

  // ===== SEPARATE CLASSES BY ROLE =====
  const teachingClasses = classes.filter(classData => classData.userRole === "teacher" || classData.isTeacher);
  const enrolledClasses = classes.filter(classData => classData.userRole === "student" || !classData.isTeacher);
  const allClasses = [...classes];

  // ===== VIOLATION SUMMARY HANDLER =====
  const handleViewViolationSummary = (exam) => {
    console.log('📊 Viewing violation summary for exam:', exam._id, exam.title);
    setSelectedExamForSummary(exam);
    setShowViolationSummary(true);
  };

  // ===== FIXED: JOIN CLASS FUNCTION WITH BETTER ERROR HANDLING =====
  const joinClass = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/class/join", { code: joinCode });
      console.log('Join class response:', res.data);
      
      if (res.data.success) {
        const joinedClass = res.data.data || res.data;
        setClasses(prev => [...prev, { ...joinedClass, userRole: "student" }]);
        setJoinCode("");
        setShowJoinModal(false);
        alert("✅ Successfully joined class!");
        
        // Refresh the classes list
        try {
          const classesRes = await api.get("/class/my-classes");
          const classesData = classesRes.data.data || classesRes.data;
          setClasses(classesData);
        } catch (refreshError) {
          console.error("Failed to refresh classes:", refreshError);
        }
      } else {
        alert("❌ Failed to join class: " + res.data.message);
      }
    } catch (error) {
      console.error("Join class error:", error);
      alert("❌ Failed to join class: " + (error.response?.data?.message || "Invalid class code or server error"));
    }
  };

  // ✅ ADDED: Excel Export Function
  const exportGradesToExcel = async () => {
    if (!selectedClass) return;
    
    try {
      console.log("📤 Exporting grades for class:", selectedClass._id);
      
      // Show loading state
      const response = await api.get(`/exams/${selectedClass._id}/export-grades`);
      
      if (response.data.success) {
        const { data, metadata } = response.data;
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet([
          // Header row 1: Class info
          [`${metadata.className} - Grades Report`],
          [`Exported on: ${new Date(metadata.exportedAt).toLocaleString()}`],
          [`Students: ${metadata.studentCount} | Exams: ${metadata.examCount}`],
          [], // Empty row
          // Data headers
          data.headers
        ]);
        
        // Add student data
        XLSX.utils.sheet_add_aoa(ws, data.rows, { origin: -1 });
        
        // Set column widths
        const colWidths = data.headers.map((_, index) => ({
          wch: index === 0 ? 25 : index === 1 ? 30 : 20
        }));
        ws['!cols'] = colWidths;
        
        // Add styles (bold header)
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: data.headers.length - 1 } });
        
        // Add to workbook
        XLSX.utils.book_append_sheet(wb, ws, "Grades");
        
        // Create summary sheet
        const summaryWs = XLSX.utils.aoa_to_sheet([
          ["Class Summary", metadata.className],
          ["Class Code", selectedClass.code],
          ["Teacher", user.name],
          ["Export Date", new Date(metadata.exportedAt).toLocaleString()],
          [],
          ["Statistics", "Value"],
          ["Total Students", metadata.studentCount],
          ["Total Exams", metadata.examCount],
          [],
          ["Exam List", "Total Points"],
          ...data.exams.map(exam => [exam.title, exam.totalPoints])
        ]);
        
        XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");
        
        // Generate filename
        const fileName = `Grades_${metadata.className.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        // Save file
        XLSX.writeFile(wb, fileName);
        
        alert(`✅ Grades exported successfully! File: ${fileName}`);
      } else {
        throw new Error(response.data.message || "Failed to export grades");
      }
    } catch (error) {
      console.error("❌ Export error:", error);
      alert(`❌ Failed to export grades: ${error.message}`);
    }
  };

  // ✅ ADDED: Real-time socket connection for live classes only
  useEffect(() => {
    if (!selectedClass || !selectedClass._id) return;

    // Initialize socket connection
    const socket = io('http://localhost:3000');
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Dashboard socket connected for live classes');
      
      // Join the class room for real-time updates
      socket.emit('join-class', { 
        classId: selectedClass._id,
        userId: user._id,
        userRole: selectedClass.userRole
      });
    });

    // Listen for live class started events
    socket.on('live-class-started', (data) => {
      console.log('🎥 Live class started:', data);
      
      // Update the specific exam in classwork
      setClasswork(prev => prev.map(item => 
        item._id === data.examId 
          ? { 
              ...item, 
              isActive: true,
              status: 'active',
              statusText: '🔴 LIVE Now',
              examType: 'live-class'
            }
          : item
      ));
      
      // Also update quizCardsData if you're using it
      if (setQuizCardsData) {
        setQuizCardsData(prev => prev.map(quiz => 
          quiz._id === data.examId 
            ? { ...quiz, isActive: true, examType: 'live-class' }
            : quiz
        ));
      }
    });

    socket.on('live-class-ended', (data) => {
      console.log('🛑 Live class ended:', data);
      
      // ✅ Update ALL exams with this examId (not just current classwork)
      setClasswork(prev => prev.map(item => 
        item._id === data.examId 
          ? { 
              ...item, 
              isActive: false,
              endedAt: data.endedAt || new Date().toISOString(),
              status: 'ended'
            }
          : item
      ));

      // Update quizCardsData if you're using it
      if (setQuizCardsData) {
        setQuizCardsData(prev => prev.map(quiz => 
          quiz._id === data.examId 
            ? { 
                ...quiz, 
                isActive: false, 
                endedAt: data.endedAt,
                examType: 'live-class' 
              }
            : quiz
        ));
      }
      
      // Show notification to user
      alert(`🛑 Live class "${data.examTitle || 'Session'}" has ended`);
    });

    // Listen for broadcast live class start (from teacher)
    socket.on('broadcast-live-class-start', (data) => {
      console.log('📢 Received broadcast live class start:', data);
      
      setClasswork(prev => prev.map(item => 
        item._id === data.examId 
          ? { 
              ...item, 
              isActive: true,
              status: 'active',
              statusText: '🔴 LIVE Now',
              examType: 'live-class'
            }
          : item
      ));
    });

    // Listen for live class status updates
    socket.on('live-class-status-update', (data) => {
      console.log('🔄 Live class status update:', data);
      
      if (data.status === 'started') {
        setClasswork(prev => prev.map(item => 
          item._id === data.examId 
            ? { 
                ...item, 
                isActive: true,
                status: 'active',
                statusText: '🔴 LIVE Now'
              }
            : item
        ));
      } else if (data.status === 'ended') {
        setClasswork(prev => prev.map(item => 
          item._id === data.examId 
            ? { 
                ...item, 
                isActive: false,
                status: 'ended',
                statusText: 'Ended'
              }
            : item
        ));
      }
    });

    // Cleanup on component unmount or when selectedClass changes
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [selectedClass, user._id]);

  // ✅ ADDED: Poll for live session status updates (backup mechanism)
  useEffect(() => {
    if (activeTab !== 'classwork' || !selectedClass) return;
    
    const interval = setInterval(() => {
      classwork.forEach(async (item) => {
        if (item.isLiveClass && !item.isActive) {
          try {
            const status = await checkLiveSessionStatus(item._id);
            if (status.isActive) {
              // Update the exam to active
              setClasswork(prev => prev.map(exam => 
                exam._id === item._id 
                  ? { ...exam, isActive: true }
                  : exam
              ));
            }
          } catch (error) {
            console.log('Polling check failed for exam:', item._id, error);
          }
        }
      });
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [classwork, activeTab, selectedClass]);

  // ✅ ADDED: Enhanced checkLiveSessionStatus function
  const checkLiveSessionStatusForExam = async (examId) => {
    try {
      const response = await api.get(`/exams/${examId}/session-status`);
      if (response.data.success && response.data.data.isActive) {
        // Update the exam to active
        setClasswork(prev => prev.map(item => 
          item._id === examId 
            ? { ...item, isActive: true }
            : item
        ));
        
        // ✅ ALSO UPDATE QUIZ CARDS DATA
        if (setQuizCardsData) {
          setQuizCardsData(prev => prev.map(quiz => 
            quiz._id === examId 
              ? { ...quiz, isActive: true }
              : quiz
          ));
        }
        
        return true;
      }
    } catch (error) {
      console.log('Session check failed:', error);
    }
    return false;
  };

  // ===== DEBUG: LOG USER DATA =====
  useEffect(() => {
    console.log('🔄 Current user data:', user);
    console.log('🖼️ User profile image:', user?.profileImage);
  }, [user]);

  // ===== TO DO DATA FETCHING =====
  useEffect(() => {
    if (activeTab === "todo" && selectedClass) {
      fetchToDoData();
    }
  }, [activeTab, selectedClass]);

  // ===== GRADES DATA FETCHING =====
  useEffect(() => {
    if (!selectedClass) return;

    if (activeTab === "grades") {
      if (selectedClass.userRole === "teacher") {
        fetchGradesDataForTeacher();
      } else if (selectedClass.userRole === "student") {
        fetchCompletedExams();
      }
    }
  }, [activeTab, selectedClass]);

  // ===== RESET GRADES VIEW WHEN LEAVING TAB OR CHANGING CLASS =====
  useEffect(() => {
    if (activeTab !== "grades" || !selectedClass) {
      setGradesView("overview");
      setSelectedExamId(null);
      setSelectedStudentId(null);
    }
  }, [activeTab, selectedClass]);

  // ✅ ADDED: Debug useEffect for student data
  useEffect(() => {
    if (selectedClass?.userRole === 'student') {
      console.log('👨‍🎓 STUDENT VIEW - Current classwork data:');
      classwork.forEach((item, index) => {
        if (item.type === 'quiz' || item.isQuiz) {
          console.log(`📊 Quiz ${index + 1}:`, {
            title: item.title,
            examType: item.examType,
            isLiveClass: item.isLiveClass,
            isActive: item.isActive,
            isDeployed: item.isDeployed,
            isPublished: item.isPublished,
            timeLimit: item.timeLimit,
            completedBy: item.completedBy,
            status: item.status
          });
        }
      });
    }
  }, [classwork, selectedClass]);

  const fetchToDoData = async () => {
    setTodoLoading(true);
    try {
      // Fetch assignments for this specific class
      const assignmentsRes = await api.get(`/exams/${selectedClass._id}`);
      const classExams = assignmentsRes.data.data || assignmentsRes.data || [];

      // Process assignments
      const processedAssignments = await Promise.all(
        classExams.map(async (exam) => {
          try {
            const completionRes = await api.get(`/exams/${exam._id}/completion-status`);
            const hasCompleted = completionRes.data?.data?.hasCompleted || false;

            return {
              _id: exam._id,
              title: exam.title || "Untitled Exam",
              classId: selectedClass._id,
              className: selectedClass.name,
              teacherName: selectedClass.ownerId?.name || "Teacher",
              postedDate: exam.createdAt ? new Date(exam.createdAt) : new Date(),
              dueDate: exam.scheduledAt ? new Date(exam.scheduledAt) : null,
              status: hasCompleted ? "done" : "assigned",
              isDeployed: exam.isDeployed,
              isCompleted: hasCompleted,
              type: "exam",
              ...(hasCompleted && {
                completedAt: completionRes.data?.data?.completion?.completedAt,
                score: completionRes.data?.data?.completion?.score,
                percentage: completionRes.data?.data?.completion?.percentage
              })
            };
          } catch (error) {
            console.error(`Error checking completion for exam ${exam._id}:`, error);
            return {
              _id: exam._id,
              title: exam.title || "Untitled Exam",
              classId: selectedClass._id,
              className: selectedClass.name,
              teacherName: selectedClass.ownerId?.name || "Teacher",
              postedDate: exam.createdAt ? new Date(exam.createdAt) : new Date(),
              dueDate: exam.scheduledAt ? new Date(exam.scheduledAt) : null,
              status: "assigned",
              isDeployed: exam.isDeployed,
              isCompleted: false,
              type: "exam"
            };
          }
        })
      );

      setTodoAssignments(processedAssignments);

      // Fetch completed exams for this class
      const completedRes = await api.get("/exams/student/completed");
      if (completedRes.data.success) {
        const classCompletedExams = completedRes.data.data
          .filter(exam => exam.classId === selectedClass._id)
          .map(exam => ({
            ...exam,
            status: "done",
            type: "exam",
            isCompleted: true,
            completedAt: exam.completedAt || exam.submittedAt
          }));
        setTodoCompletedAssignments(classCompletedExams);
      }
    } catch (error) {
      console.error("Failed to fetch To Do data:", error);
      // Fallback demo data
      setTodoAssignments([
        {
          _id: "1",
          title: "Sample Quiz",
          classId: selectedClass._id,
          className: selectedClass.name,
          teacherName: "Teacher",
          postedDate: new Date("2025-11-17"),
          dueDate: null,
          status: "assigned",
          isDeployed: true,
          isCompleted: false,
          type: "exam",
        },
      ]);
    } finally {
      setTodoLoading(false);
    }
  };

  // ===== SETTINGS FUNCTIONS =====
  const handleManageSettings = () => {
    setSettingsData({
      name: user.name || "",
      email: user.email || "",
      profilePicture: user.profileImage || '',
    });
    setLocalName(user.name || "");
    setLocalEmail(user.email || "");
    setShowSettingsModal(true);
  };

  const handleSaveSettings = async () => {
    const updatedSettings = {
      ...settingsData,
      name: localName,
      email: localEmail
    };
    
    setSavingSettings(true);
    try {
      const response = await api.put("/auth/profile", {
        name: updatedSettings.name,
        email: updatedSettings.email,
        profilePicture: updatedSettings.profilePicture
      });
      
      if (response.data.success) {
        setSettingsData(updatedSettings);
        setUser(prev => ({ ...prev, ...updatedSettings, profileImage: updatedSettings.profilePicture }));
        alert("✅ Settings updated successfully!");
        setShowSettingsModal(false);
      } else {
        throw new Error(response.data.message || "Failed to update settings");
      }
    } catch (error) {
      console.error("Failed to update settings:", error);
      alert("❌ Failed to update settings: " + (error.response?.data?.message || error.message));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSettingsInputChange = (field, value) => {
    setSettingsData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleProfilePictureUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setSettingsData(prev => ({
        ...prev,
        profilePicture: imageUrl
      }));
    }
  };

  // ===== QUIZ MENU FUNCTIONS =====
  const toggleQuizMenu = (quizId, event) => {
    event.stopPropagation();
    setShowQuizMenu(showQuizMenu === quizId ? null : quizId);
  };

  // ===== UPDATED: Handle Edit Function with Demo Quiz Check =====
  const handleEditQuiz = (quiz) => {
    console.log("✏️ Editing quiz:", quiz);
    
    // Check if it's a demo quiz
    if (quiz.isDemo || quiz._id.startsWith('demo-') || quiz._id.startsWith('quiz')) {
      alert("This is a demo quiz. Create a real quiz to edit it.");
      return;
    }
    
    if (selectedClass && quiz._id) {
      navigate(`/class/${selectedClass._id}/quiz/${quiz._id}/edit`);
    } else {
      alert("Cannot edit this quiz - missing class or quiz ID");
    }
    setShowQuizMenu(null);
  };

  const handleDeleteQuizClick = (quiz, event) => {
    event.stopPropagation();
    setQuizToDelete(quiz);
    setShowDeleteConfirm(true);
    setShowQuizMenu(null);
  };

  // ===== UPDATED: confirmDeleteQuiz FUNCTION =====
  const confirmDeleteQuiz = async () => {
    if (!quizToDelete) return;
    
    try {
      console.log("🗑️ Deleting quiz:", quizToDelete._id);
      
      // Check if it's a mock quiz (like quiz3, quiz2, quiz1) or demo quiz
      if (quizToDelete._id.startsWith('quiz') || quizToDelete.isDemo) {
        // For mock/demo quizzes, just remove from local state
        console.log("🗑️ Removing mock/demo quiz from local state");
        
        // Update classwork to remove the deleted quiz
        setClasswork(prev => prev.filter(item => item._id !== quizToDelete._id));
        
        // Also update the quizCardsData if it exists separately
        if (setQuizCardsData) {
          setQuizCardsData(prev => prev.filter(quiz => quiz._id !== quizToDelete._id));
        }
        
        alert(`✅ "${quizToDelete.title}" deleted successfully!`);
      } else {
        // For real quizzes, call the API
        const response = await api.delete(`/exams/${quizToDelete._id}`);
        
        if (response.data.success) {
          alert(`✅ "${quizToDelete.title}" deleted successfully!`);
          
          // ✅ FIX: Update both classwork and quizCardsData state
          setClasswork(prev => prev.filter(item => item._id !== quizToDelete._id));
          
          if (setQuizCardsData) {
            setQuizCardsData(prev => prev.filter(quiz => quiz._id !== quizToDelete._id));
          }
          
          // Refresh classwork to ensure consistency
          fetchClasswork();
        } else {
          throw new Error(response.data.message || "Failed to delete quiz");
        }
      }
    } catch (error) {
      console.error("❌ Failed to delete quiz:", error);
      
      // More specific error handling
      if (error.response?.status === 404) {
        alert("Quiz not found. It may have already been deleted.");
        // Even if API fails, remove from local state if it was a ghost quiz
        setClasswork(prev => prev.filter(item => item._id !== quizToDelete._id));
      } else if (error.response?.status === 403) {
        alert("You don't have permission to delete this quiz.");
      } else if (error.response?.status === 500) {
        alert("Server error. The quiz might not exist in the database.");
        // Remove from local state to prevent ghost quizzes
        setClasswork(prev => prev.filter(item => item._id !== quizToDelete._id));
      } else {
        alert("Failed to delete quiz: " + (error.response?.data?.message || error.message));
      }
    } finally {
      setShowDeleteConfirm(false);
      setQuizToDelete(null);
      setShowQuizMenu(null); // ✅ Close the menu after deletion
    }
  };

  // ===== PEOPLE TAB FUNCTIONS - FIXED =====
  const fetchClassPeople = async () => {
    if (!selectedClass) {
      console.log('❌ No selected class');
      return;
    }
    
    console.log('🔄 Fetching people data for class:', selectedClass._id);
    setLoadingPeople(true);
    
    try {
      // ✅ FIXED: Using correct API endpoint with api instance
      const response = await api.get(`/student-management/${selectedClass._id}/students`);
      
      console.log('👥 Class members API response:', response.data);
      
      if (response.data.success) {
        setClassPeople(response.data.data);
        
        console.log('✅ People data loaded:', { 
          teachers: response.data.data.teachers?.length || 0, 
          students: response.data.data.students?.length || 0,
          teachersWithProfiles: response.data.data.teachers?.filter(t => t.profileImage).length || 0,
          studentsWithProfiles: response.data.data.students?.filter(s => s.profileImage).length || 0
        });
      } else {
        console.error('Failed to fetch people data:', response.data.message);
        setClassPeople({ teachers: [], students: [] });
      }
    } catch (err) {
      console.error('❌ Error fetching people data:', err);
      console.error('❌ Error details:', err.response?.data);
      setClassPeople({ teachers: [], students: [] });
    } finally {
      setLoadingPeople(false);
    }
  };

  const handleRemoveStudent = async (studentId, studentName) => {
    if (!window.confirm(`Are you sure you want to remove ${studentName} from this class?`)) {
      return;
    }

    try {
      const response = await api.delete(`/student-management/${selectedClass._id}/students/${studentId}`);

      if (response.data.success) {
        alert('Student removed successfully');
        fetchClassPeople();
      } else {
        alert('Failed to remove student: ' + response.data.message);
      }
    } catch (err) {
      alert('Failed to remove student');
      console.error('Error removing student:', err);
    }
  };

  const handleToggleMute = async (studentId, studentName, isCurrentlyMuted) => {
    try {
      const response = await api.patch(`/student-management/${selectedClass._id}/students/${studentId}/mute`);

      if (response.data.success) {
        alert(`Student ${isCurrentlyMuted ? 'unmuted' : 'muted'} successfully`);
        fetchClassPeople();
      } else {
        alert('Failed to update student: ' + response.data.message);
      }
    } catch (err) {
      alert('Failed to update student');
      console.error('Error toggling mute:', err);
    }
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const selectAllStudents = () => {
    if (selectedStudents.length === classPeople.students.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(classPeople.students.map(student => student._id));
    }
  };

  const handleEmailStudents = async () => {
    if (!emailData.subject.trim() || !emailData.message.trim()) {
      alert('Please enter both subject and message');
      return;
    }

    try {
      const response = await api.post(`/student-management/${selectedClass._id}/email-students`, {
        studentIds: selectedStudents,
        subject: emailData.subject,
        message: emailData.message
      });

      if (response.data.success) {
        alert(`Email prepared for ${response.data.data.recipients} students`);
        setShowEmailModal(false);
        setSelectedStudents([]);
        setEmailData({ subject: '', message: '' });
      } else {
        alert('Failed to send emails: ' + response.data.message);
      }
    } catch (err) {
      alert('Failed to send emails');
      console.error('Error sending emails:', err);
    }
  };

  // ✅ UPDATED: QUIZ ACTION HANDLER WITH LIVE CLASSES ONLY
  const handleQuizAction = (exam) => {
    const examTypeDisplay = getExamTypeDisplay(exam);
    const actionButton = getExamActionButton(exam, selectedClass?.userRole, user._id);
    
    console.log('📱 Handling quiz action:', {
      examId: exam._id,
      examTitle: exam.title,
      examType: exam.examType,
      userRole: selectedClass?.userRole,
      action: actionButton?.action,
      isLiveClass: exam.isLiveClass,
      isActive: exam.isActive,
      isDeployed: exam.isDeployed
    });

    if (!actionButton || actionButton.action === 'none') return;

    if (selectedClass?.userRole === 'teacher') {
      // Teacher actions for live classes only
      if (exam.isActive) {
        navigate(`/teacher-exam/${exam._id}`);
      } else {
        navigate(`/teacher-exam/${exam._id}?action=start`);
      }
    } else {
      // Student actions - LIVE CLASSES ONLY
      if (actionButton.action === 'review') {
        // Navigate to review answers
        navigate(`/review-exam/${exam._id}`);
        return;
      }
      
      // Only live class logic
      if (exam.isActive) {
        if (socketRef.current) {
          socketRef.current.emit('student-joining-live-class', {
            examId: exam._id,
            classId: selectedClass._id,
            studentId: user._id,
            studentName: user.name
          });
        }
        
        navigate(`/student-quiz/${exam._id}`, {
          state: {
            isLiveClass: true,
            requiresCamera: true,
            requiresMicrophone: true,
            examTitle: exam.title,
            className: selectedClass?.name || 'Class',
            classId: selectedClass?._id
          }
        });
      } else {
        checkLiveSessionStatusForExam(exam._id).then(isActive => {
          if (isActive) {
            alert('Live class has started! Redirecting you now...');
            navigate(`/student-quiz/${exam._id}`);
          } else {
            alert('Live class has not started yet. Please wait for the teacher to begin.');
          }
        });
      }
    }
  };

  const handleStartQuiz = async (examId, examTitle) => {
    try {
      setQuizLoading(true);
      
      const sessionCheck = await api.get(`/exams/${examId}/session-status`);
      const isActiveSession = sessionCheck.success && sessionCheck.data.isActive;
      
      navigate(`/student-quiz/${examId}`, {
        state: {
          examTitle,
          classId: selectedClass?._id,
          className: selectedClass?.name,
          requiresCamera: isActiveSession,
          isExamSession: isActiveSession
        }
      });
      
    } catch (error) {
      console.error("Failed to start quiz:", error);
      alert("❌ Failed to start quiz. Please try again.");
    } finally {
      setQuizLoading(false);
    }
  };

  const handleStartExamSession = async (exam) => {
    try {
      console.log(" Starting exam session for:", exam._id);
      
      const response = await api.post(`/exams/${exam._id}/start-session`);
      
      if (response.data.success) {
        console.log("✅ Session started successfully");
        
        setClasswork(prev => prev.map(item => 
          item._id === exam._id 
            ? { 
                ...item, 
                isActive: true, 
                isDeployed: true,
                startedAt: new Date()
              }
            : item
        ));
        
        // Notify socket that live class has started
        if (socketRef.current) {
          socketRef.current.emit('broadcast-live-class-start', {
            classId: selectedClass?._id,
            examId: exam._id,
            examTitle: exam?.title || 'Live Class',
            teacherName: user.name
          });
        }
        
        alert('✅ Live exam session started! Students can now join.');
        
        navigate(`/teacher-exam/${exam._id}`);
      } else {
        alert('Failed to start session: ' + response.data.message);
      }
    } catch (error) {
      console.error('❌ Failed to start exam session:', error);
      
      let errorMessage = 'Failed to start exam session';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert('❌ ' + errorMessage);
    }
  };

  const handleEndExamSession = async (examId) => {
    if (!window.confirm('Are you sure you want to end the live session? Students will be disconnected.')) {
      return;
    }
    
    try {
      console.log("🛑 Ending exam session for:", examId);
      
      const response = await api.post(`/exams/${examId}/end-session`);
      
      if (response.data.success) {
        console.log("✅ Session ended successfully");
        
        setClasswork(prev => prev.map(item => 
          item._id === examId 
            ? { 
                ...item, 
                isActive: false,
                endedAt: new Date()
              }
            : item
        ));
        
        // Notify socket that live class has ended
        if (socketRef.current) {
          socketRef.current.emit('broadcast-live-class-end', {
            examId: examId,
            classId: selectedClass?._id
          });
        }
        
        alert('✅ Exam session ended!');
      } else {
        alert('Failed to end session: ' + response.data.message);
      }
    } catch (error) {
      console.error('❌ Failed to end exam session:', error);
      
      let errorMessage = 'Failed to end exam session';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert('❌ ' + errorMessage);
    }
  };

  // ✅ UPDATED: isQuizAvailableForStudent function - LIVE CLASSES ONLY
  const isQuizAvailableForStudent = (item) => {
    if (!item) return false;
    
    // ✅ CHECK IF LIVE CLASS HAS ENDED
    if (item.isLiveClass) {
      if (item.endedAt && new Date(item.endedAt) < new Date()) {
        console.log('🛑 Live class has ended:', item.endedAt);
        return false; // ❌ Class has ended, not available
      }
    }
    
    console.log("📊 Checking quiz availability:", {
      title: item.title,
      isLiveClass: item.isLiveClass,
      isActive: item.isActive,
      isDeployed: item.isDeployed,
      endedAt: item.endedAt
    });
    
    // For live classes, check if active and not ended
    return item.isLiveClass && 
      (item.isActive || item.isDeployed) &&
      !(item.endedAt && new Date(item.endedAt) < new Date());
  };

  const handleDeleteQuiz = async (quizId, quizTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${quizTitle}"? This action cannot be undone.`)) {
      return;
    }
    
    setDeletingQuiz(quizId);
    try {
      const response = await deleteQuiz(quizId);
      
      if (response.success) {
        alert(`✅ "${quizTitle}" deleted successfully!`);
        fetchClasswork();
      }
    } catch (error) {
      console.error("Failed to delete quiz:", error);
      alert("Failed to delete quiz: " + (error.response?.data?.message || error.message));
    } finally {
      setDeletingQuiz(null);
    }
  };

  const handleDeployExam = async (exam) => {
    setExamToDeploy(exam);
    setShowDeployModal(true);
  };

  const confirmDeployExam = async () => {
    if (!examToDeploy) return;
    
    setDeployingExam(true);
    try {
      const response = await api.post(`/exams/${examToDeploy._id}/deploy`, {
        isDeployed: true,
        deploymentTime: new Date().toISOString()
      });
      
      if (response.success) {
        setClasswork(prev => prev.map(item => 
          item._id === examToDeploy._id 
            ? { ...item, isDeployed: true, deploymentTime: new Date().toISOString() }
            : item
        ));
        
        setDeployedExams(prev => [...prev, {
          ...examToDeploy,
          isDeployed: true,
          deploymentTime: new Date().toISOString()
        }]);
        
        setShowDeployModal(false);
        setExamToDeploy(null);
        alert('✅ Exam deployed successfully! Students can now join the exam session.');
      }
    } catch (error) {
      console.error('Failed to deploy exam:', error);
      alert('Failed to deploy exam: ' + (error.response?.data?.message || error.message));
    } finally {
      setDeployingExam(false);
    }
  };

  const handleUndeployExam = async (examId) => {
    if (!window.confirm('Are you sure you want to undeploy this exam? Students will no longer be able to join.')) {
      return;
    }
    
    try {
      const response = await api.post(`/exams/${examId}/deploy`, {
        isDeployed: false
      });
      
      if (response.success) {
        setClasswork(prev => prev.map(item => 
          item._id === examId 
            ? { ...item, isDeployed: false }
            : item
        ));
        
        setDeployedExams(prev => prev.filter(exam => exam._id !== examId));
        
        alert('✅ Exam undeployed successfully!');
      }
    } catch (error) {
      console.error('Failed to undeploy exam:', error);
      alert('Failed to undeploy exam: ' + (error.response?.data?.message || error.message));
    }
  };

  // ===== FIXED: DELETE ALL QUIZZES FUNCTION =====
  const handleDeleteAllQuizzes = async () => {
    if (!selectedClass) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ALL quizzes and exams from "${selectedClass.name}"? This action cannot be undone.`
    );
    
    if (!confirmDelete) return;
    
    setDeletingAll(true);
    try {
      const response = await deleteAllQuizzes(selectedClass._id);
      
      if (response.success) {
        alert(`✅ ${response.message}`);
        // Refresh the classwork to show empty state
        fetchClasswork();
      } else {
        throw new Error(response.message || 'Failed to delete quizzes');
      }
    } catch (error) {
      console.error("Failed to delete all quizzes:", error);
      
      // More specific error messages
      if (error.response?.status === 404) {
        alert("Class not found. Please refresh the page and try again.");
      } else if (error.response?.status === 403) {
        alert("You don't have permission to delete quizzes from this class.");
      } else if (error.response?.status === 400) {
        alert("Invalid request. Please check if the class information is correct.");
      } else {
        alert("Failed to delete quizzes: " + (error.response?.data?.message || error.message));
      }
    } finally {
      setDeletingAll(false);
    }
  };

  // ===== COMPLETED EXAMS FUNCTIONS =====
  const fetchCompletedExams = async () => {
    if (selectedClass?.userRole !== 'student') return;
    
    setLoadingCompleted(true);
    try {
      const response = await api.get('/exams/student/completed');
      if (response.data.success) {
        const classCompletedExams = response.data.data.filter(exam => 
          exam.classId === selectedClass._id
        );
        setCompletedExams(classCompletedExams);
      }
    } catch (error) {
      console.error('Failed to fetch completed exams:', error);
    } finally {
      setLoadingCompleted(false);
    }
  };

  // ===== GRADES DATA FOR TEACHERS =====
  const fetchGradesDataForTeacher = async () => {
    if (!selectedClass || selectedClass.userRole !== 'teacher') return;

    setGradesLoading(true);
    try {
      // Get all exams for this class
      const examsRes = await api.get(`/exams/${selectedClass._id}`);
      const exams = examsRes.data?.data || examsRes.data || [];

      // Get class roster (students)
      const peopleRes = await api.get(`/student-management/${selectedClass._id}/students`);
      const students = peopleRes.data?.data?.students || [];

      const allPercentages = [];

      // ---- per-exam stats ----
      const examStats = exams.map(exam => {
        const submissions = exam.completedBy || [];

        const percentages = submissions
          .map(sub => {
            const maxScore = sub.maxScore || exam.totalPoints || 0;
            let pct = sub.percentage;
            if ((pct === undefined || pct === null) && maxScore > 0) {
              pct = ((sub.score || 0) / maxScore) * 100;
            }
            return pct;
          })
          .filter(pct => pct !== null && pct !== undefined);

        percentages.forEach(p => allPercentages.push(p));

        let average = null;
        let highest = null;
        let lowest = null;

        if (percentages.length > 0) {
          const sum = percentages.reduce((a, b) => a + b, 0);
          average = sum / percentages.length;
          highest = Math.max(...percentages);
          lowest = Math.min(...percentages);
        }

        return {
          examId: exam._id,
          title: exam.title || "Untitled exam",
          totalPoints: exam.totalPoints || 0,
          submissions: submissions.length,
          totalStudents: students.length,
          average,
          highest,
          lowest
        };
      });

      // ---- overall stats ----
      let overall = null;
      if (allPercentages.length > 0) {
        const sum = allPercentages.reduce((a, b) => a + b, 0);
        overall = {
          average: sum / allPercentages.length,
          highest: Math.max(...allPercentages),
          lowest: Math.min(...allPercentages),
          examsCount: exams.length,
          submissionsCount: allPercentages.length
        };
      }

      // ---- per-student stats ----
      const studentStats = students
        .map(student => {
          const details = [];

          exams.forEach(exam => {
            const submissions = exam.completedBy || [];
            const match = submissions.find(sub => {
              const subId = sub.studentId?._id || sub.studentId;
              return subId && subId.toString() === student._id;
            });

            if (match) {
              const maxScore = match.maxScore || exam.totalPoints || 0;
              let pct = match.percentage;
              if ((pct === undefined || pct === null) && maxScore > 0) {
                pct = ((match.score || 0) / maxScore) * 100;
              }

              details.push({
                examId: exam._id,
                examTitle: exam.title || "Untitled exam",
                score: match.score ?? null,
                maxScore,
                percentage: pct
              });
            }
          });

          if (details.length === 0) return null;

          const percentages = details
            .map(d => d.percentage)
            .filter(pct => pct !== null && pct !== undefined);

          let average = null;
          if (percentages.length > 0) {
            const sum = percentages.reduce((a, b) => a + b, 0);
            average = sum / percentages.length;
          }

          return {
            studentId: student._id,
            name: student.name || student.email,
            email: student.email,
            examsTaken: details.length,
            average,
            details
          };
        })
        .filter(Boolean);

      setGradesData({ 
        overall, 
        examStats, 
        studentStats,
        exams,       // keep raw exams
        students     // keep roster
      });
    } catch (error) {
      console.error("Failed to load grades data:", error);
      setGradesData({ 
        overall: null, 
        examStats: [], 
        studentStats: [],
        exams: [],
        students: []
      });
    } finally {
      setGradesLoading(false);
    }
  };

  // ===== EFFECT FOR HANDLING REDIRECT STATE =====
  useEffect(() => {
    if (location.state) {
      const { selectedClassId, activeTab, showClasswork, refreshClasswork, examCompleted } = location.state;
      
      console.log("🔄 Handling redirect state:", location.state);
      
      if (examCompleted) {
        fetchClasswork();
        fetchCompletedExams();
        alert('✅ Quiz completed successfully! It has been moved to your completed work.');
      }
      
      if (selectedClassId && classes.length > 0) {
        const targetClass = classes.find(c => c._id === selectedClassId);
        if (targetClass) {
          console.log(" Selecting class from redirect:", targetClass.name);
          setSelectedClass(targetClass);
          
          if (activeTab) {
            setActiveTab(activeTab);
            console.log("📁 Setting active tab:", activeTab);
          }
          
          if (showClasswork) {
            setActiveTab('classwork');
            console.log(" Forcing classwork tab");
          }
          
          if (refreshClasswork && activeTab === 'classwork') {
            fetchClasswork();
            console.log("🔄 Refreshing classwork data");
          }
        }
      }
      
      window.history.replaceState({}, document.title);
    }
  }, [location.state, classes]);

  // ✅ ADDED: New useEffect to handle navigation state specifically for quiz deployment
  useEffect(() => {
    const handleNavigationState = async () => {
      if (location.state?.refresh && location.state?.activeTab === 'classwork' && selectedClass) {
        console.log("🔄 Refreshing classwork after quiz deployment");
        
        await fetchClasswork();
        
        if (location.state.showSuccess) {
         
        }
        
        window.history.replaceState({}, document.title);
      }
    };
    
    handleNavigationState();
  }, [location.state, selectedClass]);

  // ===== ANNOUNCEMENT FUNCTIONS =====
  const handleDeleteAnnouncement = async (announcementId) => {
    if (!window.confirm("Are you sure you want to delete this announcement?")) return;
    
    try {
      console.log("🗑️ Attempting to delete announcement:", announcementId);
      
      const response = await deleteAnnouncement(announcementId);
      console.log("✅ Delete response:", response);
      
      if (response.success) {
        setAnnouncements(prev => prev.filter(announcement => announcement._id !== announcementId));
        setShowCommentMenu(null);
        alert("Announcement deleted successfully!");
      } else {
        console.error("❌ Delete failed - no success in response");
        alert("Failed to delete announcement: " + (response.message || "Unknown error"));
      }
    } catch (error) {
      console.error("❌ Failed to delete announcement:", error);
      console.error("Error response:", error.response?.data);
      alert("Failed to delete announcement: " + (error.response?.data?.message || error.message));
    }
  };

  const handleDeleteComment = async (announcementId, commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    
    try {
      console.log("🗑️ Attempting to delete comment:", commentId, "from announcement:", announcementId);
      
      const response = await deleteCommentFromAnnouncement(announcementId, commentId);
      console.log("✅ Delete comment response:", response);
      
      if (response.success) {
        setAnnouncements(prev => prev.map(announcement => 
          announcement._id === announcementId 
            ? {
                ...announcement,
                comments: announcement.comments.filter(comment => comment._id !== commentId)
              }
            : announcement
        ));
        setShowCommentDeleteMenu(null);
        alert("Comment deleted successfully!");
      } else {
        console.error("❌ Comment delete failed - no success in response");
        alert("Failed to delete comment: " + (response.message || "Unknown error"));
      }
    } catch (error) {
      console.error("❌ Failed to delete comment:", error);
      console.error("Error response:", error.response?.data);
      alert("Failed to delete comment: " + (error.response?.data?.message || error.message));
    }
  };

  const toggleCommentMenu = (announcementId, event) => {
    event.stopPropagation();
    setShowCommentMenu(showCommentMenu === announcementId ? null : announcementId);
  };

  const toggleCommentDeleteMenu = (commentId, event) => {
    event.stopPropagation();
    setShowCommentDeleteMenu(showCommentDeleteMenu === commentId ? null : commentId);
  };

  const isTeacher = selectedClass?.userRole === "teacher";

  const canDeleteComment = (comment, announcement) => {
    if (!user._id) return false;
    
    const isCommentAuthor = comment.author?._id === user._id;
    const isAnnouncementCreator = announcement.createdBy?._id === user._id;
    const userIsTeacher = isTeacher;
    
    return isCommentAuthor || isAnnouncementCreator || userIsTeacher;
  };

  // ===== CLICK OUTSIDE HANDLER =====
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (commentDeleteMenuRef.current && !commentDeleteMenuRef.current.contains(event.target)) {
        setShowDeleteMenu(false);
      }
      
      if (createJoinDropdownRef.current && !createJoinDropdownRef.current.contains(event.target)) {
        setShowCreateJoinDropdown(false);
      }

      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenuForClass(null);
      }

      if (commentMenuRef.current && !commentMenuRef.current.contains(event.target)) {
        setShowCommentMenu(null);
      }

      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(event.target)) {
        setActiveActions(null);
      }

      if (settingsModalRef.current && !settingsModalRef.current.contains(event.target)) {
        setShowSettingsModal(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ===== DATA FETCHING FUNCTIONS =====
  const fetchArchivedClasses = async () => {
    try {
      console.log("📦 Fetching archived classes...");
    } catch (error) {
      console.error("❌ Failed to fetch archived classes:", error);
    }
  };

  const fetchReviewCount = async () => {
    if (userRole === 'teacher') {
      try {
        console.log("📊 Fetching review count...");
      } catch (error) {
        console.error('❌ Failed to fetch review count:', error);
      }
    }
  };

  const fetchAnnouncements = async () => {
    if (!selectedClass) return;
    
    setLoadingAnnouncements(true);
    try {
      console.log("📢 Fetching announcements for class:", selectedClass._id);
      const res = await api.get(`/announcements/class/${selectedClass._id}`);
      console.log("✅ Announcements response:", res.data);
      
      const announcementsWithComments = (res.data.data || []).map(announcement => ({
        ...announcement,
        comments: announcement.comments || []
      }));
      
      setAnnouncements(announcementsWithComments);
    } catch (error) {
      console.error("❌ Failed to fetch announcements:", error);
      if (announcements.length === 0) {
        setAnnouncements([]);
      }
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  // ===== MAIN DATA FETCHING EFFECT =====
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        console.log("👤 Fetching user data...");
        const userRes = await api.get("/auth/me");
        const userData = userRes.data;
        setUser(userData);
        console.log("✅ User data with profile image:", userData);

        const storedRole = localStorage.getItem('userRole');
        const userRoleFromAPI = userData.role;
        
        if (!storedRole && !userRoleFromAPI && !userData.hasSelectedRole) {
          navigate('/auth/success?token=' + token);
          return;
        }

        let finalRole = storedRole || userRoleFromAPI;
        
        if (!finalRole) {
          try {
            console.log("🎭 Detecting role from classes...");
            const classesRes = await api.get("/class/my-classes");
            const classesData = classesRes.data.data || classesRes.data;
            const hasTeachingClasses = classesData.some(
              classData => classData.userRole === "teacher" || classData.isTeacher
            );
            finalRole = hasTeachingClasses ? "teacher" : "student";
            localStorage.setItem('userRole', finalRole);
            console.log("✅ Detected role:", finalRole);
          } catch (classError) {
            console.error("❌ Failed to fetch classes for role detection:", classError);
            finalRole = "student";
          }
        }

        setUserRole(finalRole);

        try {
          console.log("🏫 Fetching classes...");
          const classesRes = await api.get("/class/my-classes");
          const classesData = classesRes.data.data || classesRes.data;
          setClasses(classesData);
          console.log("✅ Classes loaded:", classesData.length);
        } catch (classError) {
          console.error("❌ Failed to fetch classes:", classError);
          setClasses([]);
        }

        await fetchArchivedClasses();
        
      } catch (error) {
        console.error("❌ Failed to fetch user data:", error);
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('userRole');
          navigate('/login');
        }
      }
    };
    fetchData();
  }, [navigate]);

  useEffect(() => {
    if (userRole) {
      fetchReviewCount();
    }
  }, [userRole]);

  useEffect(() => {
    if (selectedClass && activeTab === 'stream') {
      fetchAnnouncements();
    }
  }, [selectedClass, activeTab]);

  useEffect(() => {
    if (selectedClass && activeTab === 'classwork') {
      fetchClasswork();
    }
  }, [selectedClass, activeTab]);

  // ✅ UPDATED: Enhanced effect for people data fetching
  useEffect(() => {
    if (selectedClass && activeTab === 'people') {
      console.log('🔄 Fetching people data for class:', selectedClass._id);
      fetchClassPeople();
    }
  }, [selectedClass, activeTab]);

  useEffect(() => {
    generateCalendarEvents();
  }, [classes]);

  useEffect(() => {
    if (selectedClass && selectedClass.userRole === 'student') {
      fetchCompletedExams();
    }
  }, [selectedClass]);

  // ✅ UPDATED: fetchClasswork function - ALL EXAMS ARE LIVE CLASSES
  const fetchClasswork = async () => {
    if (!selectedClass) return;
    
    try {
      console.log("📚 Fetching classwork for class:", selectedClass._id);
      
      // Fetch exams for this class
      const examsRes = await api.get(`/exams/${selectedClass._id}`);
      let examsData = [];
      
      if (examsRes.data?.data) {
        examsData = Array.isArray(examsRes.data.data) ? examsRes.data.data : [];
      } else if (examsRes.data) {
        examsData = Array.isArray(examsRes.data) ? examsRes.data : [];
      }
    
      console.log("✅ Exams loaded from API:", examsData.length, "items");
      
      // Convert exams to classwork format - ALL EXAMS ARE LIVE CLASSES
      const classworkData = examsData.map(exam => {
        // Check if student has completed this exam
        const hasCompleted = exam.completedBy?.some(completion => {
          const studentId = completion.studentId?._id || completion.studentId;
          return studentId === user._id;
        });
        
        return {
          _id: exam._id,
          title: exam.title || 'Untitled Exam',
          description: exam.description || '',
          type: 'quiz',
          isQuiz: true,
          examType: 'live-class', // ✅ FORCED TO LIVE CLASS
          isLiveClass: true, // ✅ ALWAYS TRUE
          isActive: exam.isActive || false,
          isDeployed: exam.isDeployed || false,
          isPublished: exam.isPublished || false,
          status: exam.status || 'draft',
          timeLimit: exam.timeLimit || 60,
          completedBy: exam.completedBy || [],
          hasCompleted: hasCompleted,
          createdAt: exam.createdAt,
          createdBy: exam.createdBy,
          scheduledDate: exam.scheduledAt ? new Date(exam.scheduledAt) : null,
          postedAt: exam.createdAt ? new Date(exam.createdAt) : new Date(),
          statusText: exam.isPublished ? 
            `Posted ${new Date(exam.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 
            'Draft'
        };
      });
      
      console.log("✅ Classwork processed:", classworkData);
      setClasswork(classworkData);
    } catch (error) {
      console.error("❌ Failed to fetch classwork:", error);
      setClasswork([]);
    }
  };

  // ✅ ADDED: Effect to refresh classwork when returning from quiz deployment
  useEffect(() => {
    const handleNavigationState = () => {
      if (location.state?.refresh) {
        console.log("🔄 Refreshing classwork from navigation state");
        fetchClasswork();
        
        // Clear the state to prevent infinite refreshes
        window.history.replaceState({}, document.title);
      }
    };
    
    handleNavigationState();
  }, [location.state]);

  // Function para gumawa ng announcement
  const createAnnouncement = useCallback(async (e) => {
    e.preventDefault();
    if (!announcementContent.trim() || !selectedClass) return;
    
    setPostingAnnouncement(true);
    try {
      const res = await api.post("/announcements", {
        classId: selectedClass._id,
        content: announcementContent,
        status: 'published'
      });

      const newAnnouncement = { ...res.data.data, comments: [] };
      setAnnouncements(prev => [newAnnouncement, ...prev]);
      
      setAnnouncementContent("");
      setShowAnnouncementModal(false);
      
      alert("Announcement posted successfully!");
    } catch (error) {
      console.error("Failed to create announcement:", error);
      alert(error.response?.data?.message || "Failed to post announcement");
    } finally {
      setPostingAnnouncement(false);
    }
  }, [announcementContent, selectedClass]);

  // Handler para sa announcement input change
  const handleAnnouncementInputChange = useCallback((e) => {
    setAnnouncementContent(e.target.value);
  }, []);

  // Function para makuha ang icon base sa classwork type
  const getClassworkIcon = (type) => {
    const icons = {
      assignment: "📝",
      quiz: "❓",
      question: "💬",
      material: "📎",
      announcement: "📢",
      topic: "📂"
    };
    return icons[type] || "📄";
  };

  // ===== CALENDAR FUNCTIONS =====
  const getClassColor = (classId) => {
    const colors = [
      '#4285f4', '#34a853', '#fbbc04', '#ea4335', '#a142f4', 
      '#00bcd4', '#ff6d00', '#2962ff', '#00c853', '#aa00ff'
    ];
    const index = classId ? classId.charCodeAt(0) % colors.length : 0;
    return colors[index];
  };

  const generateCalendarEvents = () => {
    const events = [];
    
    classes.forEach(classData => {
      if (classData.exams && classData.exams.length > 0) {
        classData.exams.forEach(exam => {
          events.push({
            id: exam._id,
            title: exam.title || 'Exam',
            class: classData.name,
            classId: classData._id,
            date: exam.scheduledAt ? new Date(exam.scheduledAt) : new Date(),
            type: 'exam',
            color: getClassColor(classData._id)
          });
        });
      }
    });

    if (events.length === 0) {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      classes.slice(0, 3).forEach((classData, index) => {
        const demoDate1 = new Date(currentYear, currentMonth, 10 + index * 3);
        const demoDate2 = new Date(currentYear, currentMonth, 15 + index * 2);
        
        events.push(
          {
            id: `demo-${classData._id}-1`,
            title: `${classData.name} Assignment`,
            class: classData.name,
            classId: classData._id,
            date: demoDate1,
            type: 'assignment',
            color: getClassColor(classData._id)
          },
          {
            id: `demo-${classData._id}-2`,
            title: `${classData.name} Quiz`,
            class: classData.name,
            classId: classData._id,
            date: demoDate2,
            type: 'exam',
            color: getClassColor(classData._id)
          }
        );
      });
    }

    setCalendarEvents(events);
  };

  // Calendar utility functions
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getEventsForDate = (date) => {
    return calendarEvents.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.getDate() === date.getDate() &&
             eventDate.getMonth() === date.getMonth() &&
             eventDate.getFullYear() === date.getFullYear() &&
             (selectedClassFilter === "all" || event.classId === selectedClassFilter);
    });
  };

  const getFilteredEvents = () => {
    if (selectedClassFilter === "all") {
      return calendarEvents;
    }
    return calendarEvents.filter(event => event.classId === selectedClassFilter);
  };

  const formatMonthYear = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // ===== CLASS MANAGEMENT FUNCTIONS =====
  const toggleMenu = (classId, event) => {
    event.stopPropagation();
    setShowMenuForClass(showMenuForClass === classId ? null : classId);
  };

  const confirmUnenroll = (classData, event) => {
    event.stopPropagation();
    setClassToUnenroll(classData);
    setShowUnenrollModal(true);
    setShowMenuForClass(null);
  };

  const unenrollFromClass = async () => {
    if (!classToUnenroll) return;
    
    try {
      await api.delete(`/class/${classToUnenroll._id}/unenroll`);
      
      setClasses(prevClasses => prevClasses.filter(classData => classData._id !== classToUnenroll._id));
      
      if (selectedClass && selectedClass._id === classToUnenroll._id) {
        setSelectedClass(null);
      }
      
      setShowUnenrollModal(false);
      setClassToUnenroll(null);
      
      alert("Successfully unenrolled from class!");
    } catch (error) {
      console.error("Failed to unenroll:", error);
      alert(error.response?.data?.message || "Failed to unenroll from class");
    }
  };

  const confirmArchive = (classData, event) => {
    event.stopPropagation();
    setClassToArchive(classData);
    setShowArchiveModal(true);
    setShowMenuForClass(null);
  };

  const archiveClass = async () => {
    if (!classToArchive) return;
    
    try {
      await api.put(`/class/${classToArchive._id}/archive`);
      
      setClasses(prevClasses => prevClasses.filter(classData => classData._id !== classToArchive._id));
      setArchivedClasses(prev => [...prev, { ...classToArchive, isArchived: true }]);
      
      if (selectedClass && selectedClass._id === classToArchive._id) {
        setSelectedClass(null);
      }
      
      setShowArchiveModal(false);
      setClassToArchive(null);
      
      alert("Class archived successfully!");
    } catch (error) {
      console.error("Failed to archive class:", error);
      alert(error.response?.data?.message || "Failed to archive class");
    }
  };

  const confirmRestore = (classData, event) => {
    event.stopPropagation();
    setClassToRestore(classData);
    setShowRestoreModal(true);
  };

  const restoreClass = async () => {
    if (!classToRestore) return;
    
    try {
      await api.put(`/class/${classToRestore._id}/restore`);
      
      setArchivedClasses(prev => prev.filter(classData => classData._id !== classToRestore._id));
      setClasses(prevClasses => [...prevClasses, { ...classToRestore, isArchived: false }]);
      
      setShowRestoreModal(false);
      setClassToRestore(null);
      
      alert("Class restored successfully!");
    } catch (error) {
      console.error("Failed to restore class:", error);
      alert(error.response?.data?.message || "Failed to restore class");
    }
  };

  // ===== CLASS CREATION =====
  const createClass = useCallback(async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/class", { name: className });
      const newClass = res.data.data || res.data;
      setClasses([...classes, { ...newClass, userRole: "teacher" }]);
      setClassName("");
      setShowCreateModal(false);
      alert("Class created successfully!");
    } catch (error) {
      alert(error.response?.data?.message || "Failed to create class");
    }
  }, [className, classes]);

  const handleSelectClass = async (classData) => {
    console.log(" Selecting class:", classData.name);
    setSelectedClass(classData);
    setActiveTab("classwork");
    
    try {
      const examsRes = await api.get(`/exams/${classData._id}`);
      setExams(examsRes.data || []);

      const membersRes = await api.get(`/class/${classData._id}/members`);
      setStudents(membersRes.data || []);
      
      fetchClasswork();
    } catch (error) {
      console.error("Failed to fetch class details:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    localStorage.removeItem("userRole");
    window.location.href = "/login";
  };

  const getRandomColor = () => {
    const colors = ['blue', 'green', 'yellow', 'red', 'purple', 'teal'];
    const colorIndex = Math.floor(Math.random() * colors.length);
    return colors[colorIndex];
  };

  // ===== COMPLETED EXAMS RENDERER =====
  const renderCompletedExams = () => {
    if (selectedClass?.userRole !== 'student' || completedExams.length === 0) {
      return null;
    }

    return (
      <div className="completed-exams-section">
        <div className="section-header">
          <h3>✅ Completed Work</h3>
          <p>Exams and quizzes you've finished</p>
        </div>
        
        <div className="completed-exams-grid">
          {completedExams.map((exam) => (
            <div key={exam._id} className="completed-exam-card">
              <div className="exam-header">
                <span className="exam-icon">📝</span>
                <h4>{exam.title}</h4>
              </div>
              
              <div className="exam-details">
                <p className="exam-description">{exam.description || 'Completed exam'}</p>
                
                <div className="completion-info">
                  <div className="score-info">
                    <span className="score">Score: {exam.score}/{exam.maxScore}</span>
                    <span className="percentage">({exam.percentage}%)</span>
                  </div>
                  <div className="completion-date">
                    Completed: {new Date(exam.completedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              
              <div className="exam-actions">
                <button className="review-btn" onClick={() => {
                  navigate(`/review-exam/${exam._id}`);
                }}>
                  Review Answers
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ===== TO DO TAB RENDERER =====
  const renderToDoTab = () => {
    const assignmentsByTab = todoAssignments.filter((assignment) => {
      if (todoActiveTab === "assigned") return assignment.status === "assigned" && !assignment.isCompleted;
      if (todoActiveTab === "missing") return assignment.status === "missing";
      if (todoActiveTab === "done") {
        return assignment.isCompleted || assignment.status === "done";
      }
      return false;
    });

    const getFilteredAssignments = () => {
      if (todoActiveTab === "done") {
        const completedClasswork = todoAssignments.filter(a => a.isCompleted || a.status === "done");
        const allCompleted = [...completedClasswork, ...todoCompletedAssignments];
        
        const uniqueCompleted = allCompleted.filter((assignment, index, self) =>
          index === self.findIndex(a => a._id === assignment._id)
        );
        return uniqueCompleted;
      }
      return assignmentsByTab;
    };

    const filteredAssignments = getFilteredAssignments();

    const categorizeAssignments = (items) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + 7);

      const startOfNextWeek = new Date(endOfWeek);
      startOfNextWeek.setDate(endOfWeek.getDate() + 1);

      const endOfNextWeek = new Date(startOfNextWeek);
      endOfNextWeek.setDate(startOfNextWeek.getDate() + 7);

      const noDueDate = items.filter((a) => !a.dueDate);

      const thisWeek = items.filter((a) => {
        if (!a.dueDate) return false;
        const due = new Date(a.dueDate);
        due.setHours(0, 0, 0, 0);
        return due >= today && due <= endOfWeek;
      });

      const nextWeek = items.filter((a) => {
        if (!a.dueDate) return false;
        const due = new Date(a.dueDate);
        due.setHours(0, 0, 0, 0);
        return due >= startOfNextWeek && due <= endOfNextWeek;
      });

      const later = items.filter((a) => {
        if (!a.dueDate) return false;
        const due = new Date(a.dueDate);
        due.setHours(0, 0, 0, 0);
        return due > endOfNextWeek;
      });

      return { noDueDate, thisWeek, nextWeek, later };
    };

    const { noDueDate, thisWeek, nextWeek, later } = categorizeAssignments(filteredAssignments);

    const formatPostedDate = (date) => {
      const postedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (postedDate.toDateString() === today.toDateString()) {
        return "Posted today";
      } else if (postedDate.toDateString() === yesterday.toDateString()) {
        return "Posted yesterday";
      } else {
        return `Posted ${postedDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        })}`;
      }
    };

    const formatCompletionDate = (date) => {
      if (!date) return "Completed recently";
      
      const completedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (completedDate.toDateString() === today.toDateString()) {
        return "Completed today";
      } else if (completedDate.toDateString() === yesterday.toDateString()) {
        return "Completed yesterday";
      } else {
        return `Completed ${completedDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}`;
      }
    };

    const AssignmentCard = ({ assignment, index }) => {
      const isCompleted = assignment.isCompleted || assignment.status === 'done';
      
      return (
        <div className={`assignment-card ${isCompleted ? 'completed' : ''}`}>
          <div className="assignment-number">
            {isCompleted ? <FaCheckCircle className="completed-icon" /> : index + 1}
          </div>
          <div className="assignment-content">
            <div className="assignment-header">
              <h4 className="assignment-title">{assignment.title}</h4>
              <div className="assignment-meta">
                <span className="teacher-name">{assignment.className}</span>
                <span className="posted-date">
                  {isCompleted ? formatCompletionDate(assignment.completedAt) : formatPostedDate(assignment.postedDate)}
                </span>
              </div>
            </div>
            <div className="assignment-class">{assignment.teacherName}</div>
            
            {isCompleted && assignment.percentage !== undefined && (
              <div className="completion-info">
                <span className="score-badge">
                  Score: {assignment.score !== undefined ? `${assignment.score}/${assignment.maxScore || assignment.totalPoints}` : 'Graded'} 
                  {assignment.percentage !== undefined && ` (${assignment.percentage}%)`}
                </span>
              </div>
            )}
          </div>
          <div className="assignment-actions">
            <button
              className={`action-btn ${
                isCompleted ? "review" : assignment.status === "missing" ? "missing" : "start"
              }`}
              onClick={() => {
                if (isCompleted) {
                  alert(`Reviewing ${assignment.title}\nScore: ${assignment.score}/${assignment.maxScore} (${assignment.percentage}%)`);
                } else if (assignment.isDeployed && assignment.type === "exam") {
                  window.open(`/exam/form/${assignment._id}`, "_blank");
                } else {
                  alert("This assignment is not yet available.");
                }
              }}
            >
              {isCompleted ? "Review" : assignment.status === "missing" ? "Missing" : "Start"}
            </button>
          </div>
        </div>
      );
    };

    const AssignmentSection = ({ title, assignments, defaultOpen = true }) => {
      const [isOpen, setIsOpen] = useState(defaultOpen);

      if (assignments.length === 0) return null;

      return (
        <div className="assignment-section">
          <div className="section-header" onClick={() => setIsOpen(!isOpen)}>
            <h3 className="section-title">{title}</h3>
            <span className={`toggle-arrow ${isOpen ? "open" : ""}`}>
              <FaChevronLeft />
            </span>
          </div>
          {isOpen && (
            <div className="assignment-list">
              {assignments.map((assignment, index) => (
                <AssignmentCard
                  key={assignment._id}
                  assignment={assignment}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      );
    };

    if (todoLoading) {
      return <div className="loading">Loading assignments...</div>;
    }

    return (
      <div className="todo-tab">
        <div className="todo-header-section">
          
        </div>

        {/* Tabs */}
        <div className="google-classroom-tabs">
          <button
            className={`tab ${todoActiveTab === "assigned" ? "active" : ""}`}
            onClick={() => setTodoActiveTab("assigned")}
          >
            <FaClock className="tab-icon" />
            Assigned
            <span className="tab-count">
              {todoAssignments.filter(a => !a.isCompleted && a.status !== "done").length}
            </span>
          </button>
          <button
            className={`tab ${todoActiveTab === "missing" ? "active" : ""}`}
            onClick={() => setTodoActiveTab("missing")}
          >
            <FaExclamationTriangle className="tab-icon" />
            Missing
            <span className="tab-count">
              {todoAssignments.filter(a => a.status === "missing").length}
            </span>
          </button>
          <button
            className={`tab ${todoActiveTab === "done" ? "active" : ""}`}
            onClick={() => setTodoActiveTab("done")}
          >
            <FaCheckCircle className="tab-icon" />
            Done
            <span className="tab-count">
              {filteredAssignments.length}
            </span>
          </button>
        </div>

        <div className="todo-content">
          {todoActiveTab === "done" ? (
            <div className="done-tab-content">
              {filteredAssignments.length === 0 ? (
                <div className="empty-todo">
                  <div className="empty-state-icon">✅</div>
                  <h3>No completed work yet</h3>
                  <p>When you complete exams and assignments, they will appear here.</p>
                </div>
              ) : (
                <div className="completed-assignments-list">
                  <div className="completed-header">
                   
                  </div>
                  {filteredAssignments.map((assignment, index) => (
                    <AssignmentCard
                      key={assignment._id}
                      assignment={assignment}
                      index={index}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="all-classes-section">
              <AssignmentSection title="No due date" assignments={noDueDate} />
              <AssignmentSection title="This week" assignments={thisWeek} />
              <AssignmentSection title="Next week" assignments={nextWeek} />
              <AssignmentSection title="Later" assignments={later} />

              {filteredAssignments.length === 0 && (
                <div className="empty-todo">
                  <div className="empty-state-icon">
                    {todoActiveTab === "missing"
                      ? "📝"
                      : todoActiveTab === "assigned"
                      ? "📚"
                      : "✅"}
                  </div>
                  <h3>
                    {todoActiveTab === "missing"
                      ? "No missing work"
                      : todoActiveTab === "assigned"
                      ? "No work assigned"
                      : "No completed work"}
                  </h3>
                  <p>
                    {todoActiveTab === "missing"
                      ? "You're all caught up! No assignments are missing."
                      : todoActiveTab === "assigned"
                      ? "You have no upcoming work right now."
                      : "You haven't completed any work yet."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ===== SETTINGS MODAL COMPONENT - UPDATED WITH CHANGE PASSWORD LINK =====
  // ✅ FIXED COMPLETELY: SettingsModal Component with working inputs
const SettingsModal = () => {
  if (!showSettingsModal) return null;

  const [localName, setLocalName] = useState(settingsData.name || "");
  const [localEmail, setLocalEmail] = useState(settingsData.email || "");

  // Initialize local states when modal opens
  useEffect(() => {
    if (showSettingsModal) {
      setLocalName(user.name || "");
      setLocalEmail(user.email || "");
    }
  }, [showSettingsModal]);

  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  // Simple input handlers - NO FOCUS/ONBLUR LOGIC
  const handleNameChange = (e) => {
    setLocalName(e.target.value);
  };

  const handleEmailChange = (e) => {
    setLocalEmail(e.target.value);
  };

  const handleSave = async () => {
    if (!localName.trim() || !localEmail.trim()) {
      alert("Please fill in both name and email");
      return;
    }

    const updatedSettings = {
      ...settingsData,
      name: localName,
      email: localEmail
    };

    setSavingSettings(true);
    try {
      const response = await api.put("/auth/profile", {
        name: updatedSettings.name,
        email: updatedSettings.email,
        profilePicture: updatedSettings.profilePicture
      });

      if (response.data.success) {
        setSettingsData(updatedSettings);
        setUser(prev => ({ ...prev, ...updatedSettings, profileImage: updatedSettings.profilePicture }));
        alert("✅ Settings updated successfully!");
        setShowSettingsModal(false);
      } else {
        throw new Error(response.data.message || "Failed to update settings");
      }
    } catch (error) {
      console.error("Failed to update settings:", error);
      alert("❌ Failed to update settings: " + (error.response?.data?.message || error.message));
    } finally {
      setSavingSettings(false);
    }
  };

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showSettingsModal) {
        setShowSettingsModal(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showSettingsModal]);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      onClick={() => setShowSettingsModal(false)}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
        ref={settingsModalRef}
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
          <button 
            className="text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => setShowSettingsModal(false)}
            type="button"
          >
            <FaTimes className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Profile Section */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h3>
            
            {/* Profile Picture */}
            <div className="flex items-center space-x-6 mb-6">
              <div className="relative">
                <img 
                  src={settingsData.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(localName)}&background=203a43&color=fff`}
                  alt="Profile"
                  className="w-20 h-20 rounded-full border-2 border-gray-300"
                />
                <label htmlFor="profile-picture" className="absolute bottom-0 right-0 bg-blue-600 text-white p-1 rounded-full cursor-pointer hover:bg-blue-700 transition-colors">
                  <FaEdit className="w-3 h-3" />
                  <input
                    id="profile-picture"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleProfilePictureUpload}
                  />
                </label>
              </div>
              <div>
                <p className="text-sm text-gray-600">Click the edit icon to change your profile picture</p>
              </div>
            </div>

            {/* Name and Email Inputs - COMPLETELY FIXED */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={localName}
                  onChange={handleNameChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') e.stopPropagation();
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Enter your full name"
                  autoComplete="name"
                  onFocus={(e) => e.stopPropagation()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={localEmail}
                  onChange={handleEmailChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') e.stopPropagation();
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Enter your email"
                  autoComplete="email"
                  onFocus={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          </div>
          
          {/* Account Settings */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Settings</h3>
            
            <div className="space-y-3">
              <button 
                type="button"
                className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => {
                  setShowSettingsModal(false);
                  setShowChangePasswordModal(true);
                }}
                onFocus={(e) => e.stopPropagation()}
              >
                <p className="font-medium text-gray-900">Change Password</p>
                <p className="text-sm text-gray-600">Update your password regularly</p>
              </button>
              
              <button 
                type="button"
                className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => alert("Privacy Settings feature coming soon!")}
                onFocus={(e) => e.stopPropagation()}
              >
                <p className="font-medium text-gray-900">Privacy Settings</p>
                <p className="text-sm text-gray-600">Manage your privacy preferences</p>
              </button>
              
              <button 
                type="button"
                className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => alert("Connected Accounts feature coming soon!")}
                onFocus={(e) => e.stopPropagation()}
              >
                <p className="font-medium text-gray-900">Connected Accounts</p>
                <p className="text-sm text-gray-600">Manage linked social accounts</p>
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={() => setShowSettingsModal(false)}
            className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            onFocus={(e) => e.stopPropagation()}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={savingSettings || !localName.trim() || !localEmail.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onFocus={(e) => e.stopPropagation()}
          >
            <FaSave className="w-4 h-4" />
            <span>{savingSettings ? "Saving..." : "Save Changes"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

  // ===== CHANGE PASSWORD MODAL COMPONENT (ADDED) =====
  const ChangePasswordModal = () => {
    if (!showChangePasswordModal) return null;

    const handlePasswordChange = (e) => {
      const { name, value } = e.target;
      setPasswordData(prev => ({
        ...prev,
        [name]: value
      }));
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      
      // Validate passwords
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        alert("New passwords don't match!");
        return;
      }
      
      if (passwordData.newPassword.length < 8) {
        alert("Password must be at least 8 characters long!");
        return;
      }
      
      if (passwordData.currentPassword === passwordData.newPassword) {
        alert("New password must be different from current password!");
        return;
      }

      setChangingPassword(true);
      try {
        const response = await api.put("/auth/change-password", {
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        });

        if (response.data.success) {
          alert("✅ Password changed successfully!");
          setShowChangePasswordModal(false);
          setPasswordData({
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
          });
        } else {
          throw new Error(response.data.message || "Failed to change password");
        }
      } catch (error) {
        console.error("Failed to change password:", error);
        alert("❌ Failed to change password: " + (error.response?.data?.message || error.message));
      } finally {
        setChangingPassword(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
        <div 
          className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Change Password</h2>
            <button 
              className="text-gray-400 hover:text-gray-600 transition-colors"
              onClick={() => {
                setShowChangePasswordModal(false);
                setPasswordData({
                  currentPassword: '',
                  newPassword: '',
                  confirmPassword: ''
                });
              }}
            >
              <FaTimes className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter current password"
                  required
                  autoComplete="current-password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter new password"
                  required
                  autoComplete="new-password"
                  minLength="8"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Must be at least 8 characters with uppercase, lowercase, number, and special character
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Confirm new password"
                  required
                  autoComplete="new-password"
                  minLength="8"
                />
                {passwordData.newPassword && passwordData.confirmPassword && 
                 passwordData.newPassword !== passwordData.confirmPassword && (
                  <p className="text-xs text-red-600 mt-1">Passwords don't match!</p>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setPasswordData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                  });
                }}
                className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={changingPassword || 
                         !passwordData.currentPassword || 
                         !passwordData.newPassword || 
                         !passwordData.confirmPassword ||
                         passwordData.newPassword !== passwordData.confirmPassword ||
                         passwordData.newPassword.length < 8}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {changingPassword ? "Changing..." : "Change Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // ===== DELETE CONFIRMATION MODAL =====
  const DeleteConfirmationModal = () => {
    if (!showDeleteConfirm || !quizToDelete) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Quiz</h3>
              <p className="text-sm text-gray-600">This action cannot be undone.</p>
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
            <p className="text-sm text-yellow-800">
              Are you sure you want to delete <strong>"{quizToDelete.title}"</strong>?
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              All student submissions and grades for this quiz will be permanently deleted.
            </p>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={() => {
                setShowDeleteConfirm(false);
                setQuizToDelete(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteQuiz}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
            >
              Delete Quiz
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ===== FIXED ANNOUNCEMENT CARD COMPONENT =====
  const AnnouncementCard = ({ announcement }) => {
    const currentUserId = user._id;
    const isAnnouncementCreator = announcement.createdBy?._id === currentUserId;
    const canEditDelete = isAnnouncementCreator || isTeacher;
    
    console.log(" ANNOUNCEMENT CARD RENDERED:", {
      announcementId: announcement._id,
      currentUserId,
      isAnnouncementCreator,
      isTeacher,
      canEditDelete,
      announcementCreator: announcement.createdBy?._id,
      userRole: selectedClass?.userRole
    });
    
    const [localCommentInput, setLocalCommentInput] = useState("");
    const [localEditContent, setLocalEditContent] = useState(announcement.content);
    const [isEditing, setIsEditing] = useState(false);
    const [isPostingComment, setIsPostingComment] = useState(false);
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const textareaRef = useRef(null);
    const commentMenuRef = useRef(null);

    useEffect(() => {
      if (isEditing && textareaRef.current) {
        textareaRef.current.focus();
        const length = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(length, length);
      }
    }, [isEditing]);

    const startEditAnnouncement = () => {
      console.log("🔄 STARTING EDIT - Announcement ID:", announcement._id);
      console.log("📝 Current content:", announcement.content);
      setIsEditing(true);
      setLocalEditContent(announcement.content);
      setShowCommentMenu(null);
    };

    const saveEditAnnouncement = async () => {
      if (!localEditContent.trim()) {
        console.log("❌ Empty content, not saving");
        return;
      }
      
      console.log("💾 SAVING EDIT - Button clicked!");
      console.log("📦 Save Data:", {
        announcementId: announcement._id,
        newContent: localEditContent,
        currentUserId,
        canEditDelete
      });
      
      setIsSavingEdit(true);
      try {
        const updateData = {
          content: localEditContent.trim()
        };
        
        console.log(" Calling updateAnnouncement API...");
        const response = await updateAnnouncement(announcement._id, updateData);
        console.log("✅ EDIT API RESPONSE RECEIVED:", response);

        if (response.success) {
          console.log("🔄 UPDATING ANNOUNCEMENTS STATE - Before update");
          console.log("Current announcements count:", announcements.length);
          
          setAnnouncements(prev => {
            const updated = prev.map(ann => 
              ann._id === announcement._id 
                ? { 
                    ...ann, 
                    content: localEditContent.trim(),
                    updatedAt: new Date().toISOString()
                  }
                : ann
            );
            console.log("🔄 After update - announcements:", updated);
            return updated;
          });

          setIsEditing(false);
          console.log("🎉 EDIT SUCCESSFUL - Editing mode closed");
          alert("Announcement updated successfully!");
        } else {
          console.error("❌ EDIT FAILED - API returned false");
          alert("Failed to update announcement: " + (response.message || "Unknown error"));
        }
      } catch (error) {
        console.error("❌ EDIT ERROR:", error);
        console.error("Error details:", {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        alert("Failed to edit announcement: " + (error.response?.data?.message || error.message));
      } finally {
        setIsSavingEdit(false);
        console.log("🏁 Save process completed");
      }
    };

    const cancelEditAnnouncement = () => {
      console.log("❌ Canceling edit");
      setIsEditing(false);
      setLocalEditContent(announcement.content);
    };

    const handleEditKeyPress = (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        saveEditAnnouncement();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelEditAnnouncement();
      }
    };

    const handleDeleteAnnouncement = async () => {
      if (!window.confirm("Are you sure you want to delete this announcement?")) return;
      
      try {
        console.log("🗑️ DELETING ANNOUNCEMENT:", announcement._id);
        const response = await deleteAnnouncement(announcement._id);
        console.log("✅ DELETE RESPONSE:", response);

        if (response.success) {
          setAnnouncements(prev => prev.filter(ann => ann._id !== announcement._id));
          setShowCommentMenu(null);
          alert("Announcement deleted successfully!");
        } else {
          throw new Error(response.message || "Failed to delete announcement");
        }
      } catch (error) {
        console.error("❌ DELETE ERROR:", error);
        alert("Failed to delete announcement: " + (error.response?.data?.message || error.message));
      }
    };

    const handleCommentSubmit = async () => {
      if (!localCommentInput.trim()) return;
      
      setIsPostingComment(true);
      
      try {
        const response = await addCommentToAnnouncement(announcement._id, {
          content: localCommentInput.trim()
        });

        if (response.success) {
          setAnnouncements(prev => prev.map(ann => 
            ann._id === announcement._id 
              ? { 
                  ...ann, 
                  comments: [...(ann.comments || []), response.data] 
                }
              : ann
          ));

          setLocalCommentInput("");
        } else {
          throw new Error(response.message || "Failed to add comment");
        }
      } catch (error) {
        console.error("Failed to add comment:", error);
        alert(error.response?.data?.message || "Failed to add comment");
      } finally {
        setIsPostingComment(false);
      }
    };

    const handleKeyPress = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleCommentSubmit();
      }
    };

    const toggleCommentMenu = (e) => {
      e.stopPropagation();
      console.log("📋 TOGGLING MENU for announcement:", announcement._id);
      setShowCommentMenu(showCommentMenu === announcement._id ? null : announcement._id);
    };

    const CommentItem = ({ comment, announcement }) => {
      const currentUserId = user._id;
      const isCommentAuthor = comment.author?._id === currentUserId;
      const isAnnouncementCreator = announcement.createdBy?._id === currentUserId;
      const canDeleteComment = isCommentAuthor || isAnnouncementCreator || isTeacher;
      
      const [showDeleteMenu, setShowDeleteMenu] = useState(false);
      const commentDeleteMenuRef = useRef(null);

      const toggleDeleteMenu = (e) => {
        e.stopPropagation();
        setShowDeleteMenu(!showDeleteMenu);
      };

      useEffect(() => {
        const handleClickOutside = (event) => {
          if (commentDeleteMenuRef.current && !commentDeleteMenuRef.current.contains(event.target)) {
            setShowDeleteMenu(false);
          }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
      }, []);

      return (
        <div className="comment-item">
          <div className="comment-avatar">
            <img 
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author?.name || 'User')}&background=34a853&color=fff`}
              alt={comment.author?.name}
            />
          </div>
          <div className="comment-content">
            <div className="comment-header">
              <div className="comment-author-info">
                <span className="comment-author">{comment.author?.name || 'User'}</span>
                <span className="comment-time">
                  {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              
              {canDeleteComment && (
                <div className="comment-actions" ref={commentDeleteMenuRef}>
                  <button 
                    className="comment-menu-btn"
                    onClick={toggleDeleteMenu}
                  >
                    <FaEllipsisV className="comment-menu-icon" />
                  </button>
                  
                  {showDeleteMenu && (
                    <div className="comment-menu-dropdown">
                      <button 
                        className="comment-menu-item delete"
                        onClick={() => handleDeleteComment(announcement._id, comment._id)}
                      >
                        <FaTrash className="comment-menu-item-icon" />
                        Delete Comment
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="comment-text">{comment.content}</p>
          </div>
        </div>
      );
    };

    return (
      <div key={announcement._id} className="announcement-card">
        <div className="announcement-header">
          <div className="announcement-avatar">
            <img 
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(announcement.createdBy?.name || 'User')}&background=4285f4&color=fff`}
              alt={announcement.createdBy?.name}
            />
          </div>
          <div className="announcement-info">
            <div className="announcement-author">
              {announcement.createdBy?.name || 'Teacher'}
              {isTeacher && <span className="teacher-badge">Teacher</span>}
            </div>
            <div className="announcement-time">
              {new Date(announcement.createdAt).toLocaleString()}
              {announcement.updatedAt && announcement.updatedAt !== announcement.createdAt && (
                <span className="edited-badge">(edited)</span>
              )}
            </div>
          </div>
          
          {canEditDelete && !isEditing && (
            <div className="announcement-menu" ref={commentMenuRef}>
              <button 
                className="menu-btn"
                onClick={toggleCommentMenu}
              >
                <FaEllipsisV className="menu-icon" />
              </button>
              
              {showCommentMenu === announcement._id && (
                <div className="announcement-menu-dropdown">
                  <button 
                    className="menu-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log("✏️ EDIT BUTTON CLICKED");
                      startEditAnnouncement();
                    }}
                  >
                    <FaEdit className="menu-item-icon" />
                    Edit
                  </button>
                  <button 
                    className="menu-item delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log("🗑️ DELETE BUTTON CLICKED");
                      handleDeleteAnnouncement();
                    }}
                  >
                    <FaTrash className="menu-item-icon" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="announcement-content">
          {isEditing ? (
            <div className="edit-announcement">
              <textarea
                ref={textareaRef}
                className="edit-announcement-textarea"
                value={localEditContent}
                onChange={(e) => setLocalEditContent(e.target.value)}
                onKeyDown={handleEditKeyPress}
                rows="3"
                disabled={isSavingEdit}
                placeholder="What would you like to announce?"
              />
              <div className="edit-actions">
                <button 
                  className="cancel-edit-btn"
                  onClick={cancelEditAnnouncement}
                  disabled={isSavingEdit}
                >
                  Cancel
                </button>
                <button 
                  className="save-edit-btn"
                  onClick={(e) => {
                    console.log("🖱️ SAVE BUTTON CLICKED!");
                    e.stopPropagation();
                    saveEditAnnouncement();
                  }}
                  disabled={!localEditContent.trim() || isSavingEdit}
                >
                  {isSavingEdit ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <p className="announcement-text">{announcement.content}</p>
          )}
        </div>

        {!isEditing && (
          <div className="announcement-comments">
            {announcement.comments && announcement.comments.length > 0 && (
              <div className="comments-list">
                {announcement.comments.map((comment) => (
                  <CommentItem 
                    key={comment._id} 
                    comment={comment} 
                    announcement={announcement}
                  />
                ))}
              </div>
            )}

            <div className="add-comment">
              <div className="comment-avatar">
                <img 
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=ea4335&color=fff`}
                  alt={user.name}
                />
              </div>
              <div className="comment-input-container">
                <input
                  type="text"
                  className="comment-input"
                  placeholder="Add class comment..."
                  value={localCommentInput}
                  onChange={(e) => setLocalCommentInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isPostingComment}
                />
                <button 
                  className="comment-submit-btn"
                  onClick={handleCommentSubmit}
                  disabled={!localCommentInput.trim() || isPostingComment}
                >
                  {isPostingComment ? "Posting..." : "Post"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ===== ENHANCED CLASSWORK TAB WITH LIVE CLASSES ONLY =====
  const renderClassworkTab = () => {
    const filteredClasswork = classwork.filter(item => {
      if (selectedClass?.userRole === "student" && item.type === 'quiz') {
        const hasCompleted = item.completedBy?.some(completion => 
          completion.studentId === user._id
        );
        return !hasCompleted;
      }
      return true;
    });

    // ✅ UPDATED: Filter quizzes/exams from classwork - ALL ARE LIVE CLASSES
    const displayExams = classwork
      .filter(item => item.type === 'quiz' || item.isQuiz || item.examType || item._id?.startsWith('quiz'))
      .map(item => {
        // Ensure all exams are marked as live classes
        const examData = {
          _id: item._id,
          title: item.title || 'Untitled Quiz',
          description: item.description || '',
          examType: 'live-class', // ✅ FORCED TO LIVE CLASS
          isLiveClass: true, // ✅ ALWAYS TRUE
          status: item.isPublished || item.isDeployed ? 'posted' : 'draft',
          statusText: item.isPublished || item.isDeployed ? 
            `Posted ${item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}` : 
            'Draft',
          type: 'quiz',
          isActive: item.isActive || false,
          isDeployed: item.isDeployed || false,
          isPublished: item.isPublished || false,
          completedBy: item.completedBy || [],
          scheduledDate: item.scheduledAt ? new Date(item.scheduledAt) : null,
          postedAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          isDemo: item._id?.startsWith('quiz') || item._id?.startsWith('demo-') || false,
          timeLimit: item.timeLimit || 60
        };
        
        console.log('📋 Processed exam data for display:', examData);
        return examData;
      });

    const renderExamCard = (exam) => {
      const examTypeDisplay = getExamTypeDisplay(exam);
      const actionButton = getExamActionButton(exam, selectedClass?.userRole, user._id);
      
      // ✅ ADD THIS: Check if teacher can view summary (exam is completed/has submissions)
      const canViewSummary = selectedClass?.userRole === "teacher" && 
        (exam.completedBy?.length > 0 || exam.isActive === false);
      
      return (
        <div key={exam._id} className="exam-card">
          <div className="exam-card-header">
            <div className="exam-icon-container">
              <span className={`exam-type-badge ${examTypeDisplay.color}`}>
                {examTypeDisplay.icon} {examTypeDisplay.label}
              </span>
            </div>
            
            <div className="exam-title-section">
              <h3 className="exam-title">{exam.title}</h3>
              {exam.description && (
                <p className="exam-description">{exam.description}</p>
              )}
              <div className={`exam-status ${exam.status}`}>
                {exam.statusText}
              </div>
            </div>
            
            {/* ✅ ADD THIS: VIOLATION SUMMARY BUTTON FOR TEACHERS */}
            {selectedClass?.userRole === "teacher" && (
              <div className="exam-actions-dropdown">
                <button 
                  className="exam-menu-btn"
                  onClick={(e) => toggleQuizMenu(exam._id, e)}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    zIndex: 10,
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    cursor: 'pointer'
                  }}
                >
                  <FaEllipsisV />
                </button>
                
                {showQuizMenu === exam._id && (
                  <div 
                    className="exam-menu-dropdown"
                    style={{
                      position: 'absolute',
                      top: '35px',
                      right: '10px',
                      zIndex: 20,
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      minWidth: '180px'
                    }}
                  >
                    {/* Edit Button */}
                    <button 
                      className="exam-menu-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditQuiz(exam);
                      }}
                    >
                      <FaEdit className="menu-item-icon" />
                      Edit
                    </button>
                    
                    {/* VIOLATION SUMMARY BUTTON */}
                    {canViewSummary && (
                      <button 
                        className="exam-menu-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewViolationSummary(exam);
                          setShowQuizMenu(null);
                        }}
                      >
                        <svg className="menu-item-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        View Detection Summary
                      </button>
                    )}
                    
                    {/* Live Class Controls */}
                    {exam.isActive ? (
                      <button 
                        className="exam-menu-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEndExamSession(exam._id);
                          setShowQuizMenu(null);
                        }}
                      >
                        <span className="menu-item-icon">🛑</span>
                        End Live Class
                      </button>
                    ) : (
                      <button 
                        className="exam-menu-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartExamSession(exam);
                          setShowQuizMenu(null);
                        }}
                      >
                        <span className="menu-item-icon">🚀</span>
                        Start Live Class
                      </button>
                    )}
                    
                    {/* Delete Button */}
                    <button 
                      className="exam-menu-item delete"
                      onClick={(e) => handleDeleteQuizClick(exam, e)}
                    >
                      <FaTrash className="menu-item-icon" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="exam-info">
            <div className="exam-meta">
              <span className="exam-type">Live Class</span>
              <span className="exam-duration">
                 {exam.timeLimit || 60} minutes
              </span>
              {exam.scheduledDate && (
                <span className="exam-date">
                  Starts: {exam.scheduledDate.toLocaleDateString()}
                </span>
              )}
              {exam.isDemo && (
                <span className="demo-badge">Demo</span>
              )}
              {exam.isActive && (
                <span className="live-badge">🔴 LIVE</span>
              )}
              <span className={`exam-status ${exam.status}`}>
                {exam.statusText || 
                  (exam.isActive ? 'Session Active' : 
                   exam.isDeployed ? 'Published' : 
                   exam.status === 'draft' ? 'Draft' : 
                   'Not Available')}
              </span>
            </div>
            
            {/* Action Button */}
            <div className="exam-action-button">
              {actionButton ? (
                <button 
                  className={`action-btn ${actionButton.variant} ${actionButton.action === 'none' ? 'disabled' : ''}`}
                  onClick={() => {
                    if (actionButton.action !== 'none') {
                      handleQuizAction(exam);
                    }
                  }}
                  disabled={actionButton.action === 'none'}
                >
                  <span className="action-icon">{actionButton.icon}</span>
                  <span className="action-label">{actionButton.label}</span>
                </button>
              ) : (
                // Teacher async quiz - no button or show "View" button
                <div>
                </div>
              )}

              {selectedClass?.userRole === "student" && actionButton?.action === 'review' && (
                <button 
                  className="review-btn secondary"
                  onClick={() => navigate(`/review-exam/${exam._id}`)}
                >
                  📊 Review Answers
                </button>
              )}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="classwork-tab">
        {/* Header Section */}
        <div className="classwork-header-section">
          <div className="classwork-header">
            <div className="classwork-title">
              <h2>Classwork</h2>
            </div>
            
            {selectedClass?.userRole === "teacher" && (
              <div className="classwork-actions">
                <button 
                  className="create-btn"
                  onClick={() => {
                    if (selectedClass) {
                      navigate(`/class/${selectedClass._id}/quiz/new`);
                    } else {
                      alert('Please select a class first');
                    }
                  }}
                >
                  <FaPlus className="btn-icon" />
                  Create Live Class
                </button>
              </div>
            )}
          </div>

          {/* Role Indicator */}
          <div className="role-indicator">
            {selectedClass?.userRole === "teacher" ? (
              <div className="teacher-indicator">
                👨‍🏫 You are viewing this class as a <strong>teacher</strong>.
                {classwork.some(item => item.type === 'quiz' || item.isQuiz) && (
                  <button 
                    className="delete-all-quizzes-btn"
                    onClick={handleDeleteAllQuizzes}
                    disabled={deletingAll}
                  >
                    {deletingAll ? 'Deleting...' : 'Delete All Live Classes'}
                  </button>
                )}
              </div>
            ) : (
              <div>
              </div>
            )}
          </div>
        </div>

        {/* Exam Cards Grid - With Live Classes Only */}
        <div className="exam-cards-grid">
          {displayExams.length > 0 ? (
            displayExams.map((exam) => renderExamCard(exam))
          ) : (
            <div className="no-exams-message">
             
            </div>
          )}
        </div>

        {/* Existing Classwork Content */}
        <div className="classwork-content">
          {filteredClasswork.length === 0 ? (
            <div className="classwork-empty-state">
              <div className="empty-illustration">

              </div>
            </div>
          ) : (
            <div className="classwork-grid">
              {/* Your existing classwork items */}
              {filteredClasswork.map((item) => (
                <div>
                  {/* Your existing classwork card content */}
                </div>
              ))}
            </div>
          )}

          {renderCompletedExams()}
        </div>
      </div>
    );
  };

  // Home content renderer
  const renderHomeContent = () => {
    if (selectedClass) {
      return (
        <div className="class-details">
          <div className="class-header">
            <h2>{selectedClass.name}</h2>
            <div className="class-info-grid">
              <div className="class-info-item">
                <span className="info-label">Class code:</span>
                <span className="info-value">{selectedClass.code}</span>
              </div>
              <div className="class-info-item">
                <span className="info-label">Your role:</span>
                <span className={`info-value role ${selectedClass.userRole}`}>
                  {selectedClass.userRole === "teacher" ? "Teacher" : "Student"}
                </span>
              </div>
            </div>
          </div>

          <div className="classroom-tabs">
            {selectedClass?.userRole === "teacher" && (
              <>
                <button 
                  className={`classroom-tab ${activeTab === "classwork" ? "active" : ""}`}
                  onClick={() => setActiveTab("classwork")}
                >
                  Classwork
                </button>
                <button 
                  className={`classroom-tab ${activeTab === "people" ? "active" : ""}`}
                  onClick={() => setActiveTab("people")}
                >
                  People
                </button>
                <button 
                  className={`classroom-tab ${activeTab === "grades" ? "active" : ""}`}
                  onClick={() => setActiveTab("grades")}
                >
                  Grades
                </button>
              </>
            )}
            
            {selectedClass?.userRole === "student" && (
              <>
                <button 
                  className={`classroom-tab ${activeTab === "classwork" ? "active" : ""}`}
                  onClick={() => setActiveTab("classwork")}
                >
                  Stream
                </button>
                {/* ✅ ADD TO DO TAB FOR STUDENTS */}
                <button 
                  className={`classroom-tab ${activeTab === "todo" ? "active" : ""}`}
                  onClick={() => setActiveTab("todo")}
                >
                  To do
                </button>
              </>
            )}
          </div>

          {activeTab === "classwork" && renderClassworkTab()}

          {/* ✅ UPDATED: Use PeopleTab component */}
          {activeTab === "people" && (
            <PeopleTab
              classPeople={classPeople}
              loadingPeople={loadingPeople}
              selectedClass={selectedClass}
              isTeacher={selectedClass?.userRole === "teacher"}
              user={user}
              api={api}
              activeActions={activeActions}
              setActiveActions={setActiveActions}
              selectedStudents={selectedStudents}
              setSelectedStudents={setSelectedStudents}
              showEmailModal={showEmailModal}
              setShowEmailModal={setShowEmailModal}
              emailData={emailData}
              setEmailData={setEmailData}
              toggleStudentSelection={toggleStudentSelection}
              selectAllStudents={selectAllStudents}
              handleToggleMute={handleToggleMute}
              handleRemoveStudent={handleRemoveStudent}
              handleEmailStudents={handleEmailStudents}
            />
          )}

          {/* ✅ TO DO TAB RENDERER */}
          {activeTab === "todo" && renderToDoTab()}

          {/* ✅ UPDATED: Use GradesTab component */}
          {activeTab === "grades" && (
            <GradesTab
              selectedClass={selectedClass}
              gradesLoading={gradesLoading}
              gradesData={gradesData}
              gradesView={gradesView}
              setGradesView={setGradesView}
              selectedExamId={selectedExamId}
              setSelectedExamId={setSelectedExamId}
              selectedStudentId={selectedStudentId}
              setSelectedStudentId={setSelectedStudentId}
              gradeSortBy={gradeSortBy}
              setGradeSortBy={setGradeSortBy}
              showSortMenu={showSortMenu}
              setShowSortMenu={setShowSortMenu}
              user={user}
              api={api}
              exportGradesToExcel={exportGradesToExcel}
            />
          )}
        </div>
      );
    }

    return (
      <div className="home-view">
        {allClasses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-actions">
              {userRole === "teacher" ? (
                <button 
                  className="primary-btn"
                  onClick={() => setShowCreateModal(true)}
                >
                  <FaPlus className="btn-icon" />
                  Create Your First Class
                </button>
              ) : (
                <button 
                  className="primary-btn"
                  onClick={() => setShowJoinModal(true)}
                >
                  <FaUserPlus className="btn-icon" />
                  Join a Class
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="class-grid">
            {allClasses.map((classData) => (
              <ClassCard
                key={classData._id}
                classData={classData}
                handleSelectClass={handleSelectClass}
                toggleMenu={toggleMenu}
                showMenuForClass={showMenuForClass}
                setShowMenuForClass={setShowMenuForClass}
                confirmArchive={confirmArchive}
                confirmUnenroll={confirmUnenroll}
                userId={user._id} // ADD THIS LINE
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Calendar content renderer
  const renderCalendarContent = () => (
    <div className="calendar-view">
      <div className="calendar-header">
        <h2>Calendar</h2>
        <p>View your scheduled exams and assignments</p>
      </div>
      <GoogleClassroomCalendar />
    </div>
  );

  // Archived content renderer
  const renderArchivedContent = () => (
    <div className="archived-view">
      <div className="archived-header">
        <h2>Archived Classes</h2>
      </div>

      {archivedClasses.length === 0 ? (
        <div className="archived-empty">
          <h3>No archived classes</h3>
          <p>When you archive classes, they'll appear here.</p>
        </div>
      ) : (
        <div className="archived-classes-grid">
          {archivedClasses.map((classData) => (
            <div key={classData._id} className="archived-class-card">
              <div className="archived-class-content">
                <div className="archived-class-header">
                  <h3 className="archived-class-name">{classData.name}</h3>
                  <span className="archived-badge">Archived</span>
                </div>
                
                <div className="archived-class-info">
                  <p className="text-sm text-gray-600">
                    Class Code: <strong className="font-mono">{classData.code}</strong>
                  </p>
                  <p className="text-sm text-gray-600">
                    Archived: {new Date(classData.archivedAt).toLocaleDateString()}
                  </p>
                  <div className="flex justify-between text-xs text-gray-500 pt-2">
                    <span>{classData.members?.length || 1} members</span>
                    <span>{classData.exams?.length || 0} exams</span>
                  </div>
                </div>

                <div className="archived-class-actions">
                  <button
                    className="restore-btn"
                    onClick={(e) => confirmRestore(classData, e)}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Restore
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ✅ UPDATED: Settings content renderer - SIMPLIFIED
  const renderSettingsContent = () => (
    <div className="settings-view">
      <div className="settings-header">
        <h2>Settings</h2>
        <p>Manage your account preferences</p>
      </div>
      <div className="settings-sections">
        <div className="settings-section">
          <h3>Account Settings</h3>
          <p className="settings-description">Manage your account information</p>
          <div className="settings-item">
            <div className="settings-item-content">
              <h4>Profile Information</h4>
              <p>Update your name, email, and profile picture</p>
            </div>
            <button 
              className="settings-btn"
              onClick={handleManageSettings}
            >
              Manage
            </button>
          </div>
          
          {/* ✅ REMOVED: Privacy & Security from Account Settings */}
        </div>
        
        {/* ✅ REMOVED: Entire Application Settings section */}
      </div>
    </div>
  );

  // ===== MODAL COMPONENTS =====
  const DeployExamModal = () => {
    if (!showDeployModal || !examToDeploy) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Deploy Exam</h3>
              <p className="text-sm text-gray-600">Start exam session for students</p>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <p className="text-sm text-blue-800">
              You are about to deploy: <strong>"{examToDeploy.title}"</strong>
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Students will be able to join the exam session with camera and microphone access required.
            </p>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex items-center text-sm text-gray-600">
              <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Camera access required
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Microphone access required
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Real-time proctoring enabled
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={() => {
                setShowDeployModal(false);
                setExamToDeploy(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeployExam}
              disabled={deployingExam}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
            >
              {deployingExam ? 'Deploying...' : 'Deploy Exam'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ✅ FIXED: JoinModal Component without auto-selection
const JoinModal = () => {
  if (!showJoinModal) return null;

  const inputRef = useRef(null);
  
  useEffect(() => {
    if (showJoinModal && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        const length = inputRef.current.value.length;
        inputRef.current.setSelectionRange(length, length);
      }, 100);
    }
  }, [showJoinModal]);

  const handleInputChange = (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setJoinCode(value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (joinCode.trim().length === 6) {
      joinClass(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center space-x-3 mb-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <FaUserPlus className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Join Class</h3>
            <p className="text-sm text-gray-600">Enter a class code to join</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="joinCode" className="block text-sm font-medium text-gray-700 mb-2">
              Class Code
            </label>
            <input
              ref={inputRef}
              type="text"
              id="joinCode"
              value={joinCode}
              onChange={handleInputChange}
              placeholder="Enter 6-digit class code"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all duration-200"
              required
              maxLength={6}
              pattern="[A-Z0-9]{6}"
              title="Enter a 6-digit class code (letters and numbers only)"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck="false"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the code provided by your teacher. Format: 6 letters/numbers.
            </p>
            <p className="text-xs text-blue-600 mt-1">
              {joinCode.length}/6 characters
            </p>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setShowJoinModal(false);
                setJoinCode("");
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={joinCode.length !== 6}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Join Class
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

  // ✅ ADDED: CreateClassModal Component with useRef
  const CreateClassModal = () => {
    if (!showCreateModal) return null;

    const inputRef = useRef(null);

    useEffect(() => {
      if (showCreateModal && inputRef.current) {
        inputRef.current.focus();
      }
    }, [showCreateModal]);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <FaBook className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Create Class</h3>
              <p className="text-sm text-gray-600">Create a new class for your students</p>
            </div>
          </div>
          
          <form onSubmit={createClass}>
            <div className="mb-4">
              <label htmlFor="className" className="block text-sm font-medium text-gray-700 mb-2">
                Class Name
              </label>
              <input
                ref={inputRef}
                type="text"
                id="className"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="Enter class name (e.g., Math 101)"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                This will be the name students see when joining your class.
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setClassName("");
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Create Class
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // UNENROLL CONFIRMATION MODAL
  const UnenrollModal = () => {
    if (!showUnenrollModal || !classToUnenroll) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Unenroll from Class</h3>
              <p className="text-sm text-gray-600">This action cannot be undone.</p>
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
            <p className="text-sm text-yellow-800">
              Are you sure you want to unenroll from <strong>"{classToUnenroll.name}"</strong>?
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              You will lose access to all class materials, announcements, and exams.
            </p>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={() => {
                setShowUnenrollModal(false);
                setClassToUnenroll(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={unenrollFromClass}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
            >
              Yes, Unenroll
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ARCHIVE CONFIRMATION MODAL
  const ArchiveModal = () => {
    if (!showArchiveModal || !classToArchive) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Archive Class</h3>
              <p className="text-sm text-gray-600">This class will be moved to archived.</p>
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
            <p className="text-sm text-yellow-800">
              Are you sure you want to archive <strong>"{classToArchive.name}"</strong>?
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              Archived classes are hidden from your main view but can be restored later.
            </p>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={() => {
                setShowArchiveModal(false);
                setClassToArchive(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={archiveClass}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
            >
              Archive Class
            </button>
          </div>
        </div>
      </div>
    );
  };

  // RESTORE CONFIRMATION MODAL
  const RestoreModal = () => {
    if (!showRestoreModal || !classToRestore) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Restore Class</h3>
              <p className="text-sm text-gray-600">This class will be moved back to active classes.</p>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <p className="text-sm text-blue-800">
              Restore <strong>"{classToRestore.name}"</strong> to your active classes?
            </p>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={() => {
                setShowRestoreModal(false);
                setClassToRestore(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={restoreClass}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
            >
              Restore Class
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ANNOUNCEMENT MODAL COMPONENT
  const AnnouncementModal = useCallback(() => {
    if (!showAnnouncementModal || !selectedClass) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
          <div className="flex justify-between items-center p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">New announcement</h2>
            <button 
              className="text-gray-400 hover:text-gray-600 transition-colors"
              onClick={() => {
                setShowAnnouncementModal(false);
                setAnnouncementContent("");
              }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6">
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-2">For</p>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center space-x-3">
                  <span className="font-medium text-gray-900">{selectedClass.name}</span>
                  <span className="text-sm text-gray-500">({selectedClass.code})</span>
                </div>
                <span className="text-sm text-gray-600">All students</span>
              </div>
            </div>

            <div className="mb-6">
              <textarea
                className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="Announce something to your class"
                value={announcementContent}
                onChange={handleAnnouncementInputChange}
                rows="6"
                autoFocus
              />
            </div>

            <div className="flex space-x-2 mb-6">
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors" title="Add file">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                </svg>
              </button>
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors" title="Add link">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <button 
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={() => {
                setShowAnnouncementModal(false);
                setAnnouncementContent("");
              }}
            >
              Cancel
            </button>
            <div className="flex space-x-2">
              <button 
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={createAnnouncement}
                disabled={!announcementContent.trim() || postingAnnouncement}
              >
                {postingAnnouncement ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }, [showAnnouncementModal, selectedClass, announcementContent, postingAnnouncement, handleAnnouncementInputChange, createAnnouncement]);

  // ===== CALENDAR COMPONENT =====
  const GoogleClassroomCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDayOfMonth = getFirstDayOfMonth(currentDate);
    const today = new Date();
    
    const calendarDays = [];
    
    for (let i = 0; i < firstDayOfMonth; i++) {
      calendarDays.push(null);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayEvents = getEventsForDate(date);
      calendarDays.push({
        date,
        day,
        events: dayEvents,
        isToday: date.toDateString() === today.toDateString(),
        isCurrentMonth: true
      });
    }

    return (
      <div className="google-classroom-calendar">
        <div className="calendar-header-section">
          <div className="calendar-nav">
            <button 
              className="calendar-nav-btn"
              onClick={() => navigateMonth('prev')}
            >
              <FaChevronLeft className="nav-icon" />
            </button>
            <h2 className="calendar-month-title">
              {formatMonthYear(currentDate)}
            </h2>
            <button 
              className="calendar-nav-btn"
              onClick={() => navigateMonth('next')}
            >
              <FaChevronRight className="nav-icon" />
            </button>
          </div>
          
          <div className="class-filter-section">
            <select 
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="class-filter-select"
            >
              <option value="all">All classes</option>
              {classes.map(classData => (
                <option key={classData._id} value={classData._id}>
                  {classData.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="calendar-grid-container">
          <div className="calendar-weekdays">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="weekday-header">
                {day}
              </div>
            ))}
          </div>

          <div className="calendar-days-grid">
            {calendarDays.map((dayData, index) => (
              <div
                key={index}
                className={`calendar-day ${!dayData ? 'empty-day' : ''} ${
                  dayData?.isToday ? 'today' : ''
                } ${dayData?.events.length > 0 ? 'has-events' : ''}`}
                onClick={() => dayData && setSelectedDate(dayData.date)}
              >
                {dayData && (
                  <>
                    <div className="day-number">{dayData.day}</div>
                    {dayData.events.length > 0 && (
                      <div className="day-events">
                        {dayData.events.slice(0, 2).map((event, eventIndex) => (
                          <div
                            key={eventIndex}
                            className="event-dot"
                            style={{ backgroundColor: event.color }}
                            title={`${event.title} - ${event.class}`}
                          />
                        ))}
                        {dayData.events.length > 2 && (
                          <div className="more-events">+{dayData.events.length - 2}</div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="calendar-sidebar">
          <div className="sidebar-section">
            <h3 className="sidebar-title">Upcoming</h3>
            <div className="upcoming-events-list">
              {getFilteredEvents()
                .filter(event => new Date(event.date) >= new Date())
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .slice(0, 5)
                .map(event => (
                  <div key={event.id} className="upcoming-event-item">
                    <div 
                      className="event-color-indicator"
                      style={{ backgroundColor: event.color }}
                    />
                    <div className="event-details">
                      <div className="event-title">{event.title}</div>
                      <div className="event-class">{event.class}</div>
                      <div className="event-date">
                        {new Date(event.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              
              {getFilteredEvents().filter(event => new Date(event.date) >= new Date()).length === 0 && (
                <div className="no-upcoming-events">
                  <div className="no-events-icon">📅</div>
                  <p>No upcoming events</p>
                  <span>When you have scheduled exams or assignments, they'll appear here.</span>
                </div>
              )}
            </div>
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-title">Today</h3>
            <div className="todays-events-list">
              {getEventsForDate(today).map(event => (
                <div key={event.id} className="today-event-item">
                  <div 
                    className="event-color-indicator"
                    style={{ backgroundColor: event.color }}
                    />
                  <div className="event-details">
                    <div className="event-title">{event.title}</div>
                    <div className="event-class">{event.class}</div>
                  </div>
                </div>
              ))}
              
              {getEventsForDate(today).length === 0 && (
                <div className="no-today-events">
                  <span>No events today</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ===== RENDER FUNCTIONS =====

  // Main content renderer
  const renderMainContent = () => {
    switch (activeSidebar) {
      case "home":
        return renderHomeContent();
      case "calendar":
        return renderCalendarContent();
      case "archived":
        return renderArchivedContent();
      case "settings":
        return renderSettingsContent();
      default:
        return renderHomeContent();
    }
  };

  // ===== MAIN COMPONENT RENDER =====
  return (
    <div className="dashboard-wrapper">
      {/* HEADER SECTION */}
      <header className="dashboard-header">
        <div className="header-left">
          <button 
            className="hamburger-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <FaBars className="hamburger-icon" />
          </button>
          <a>
            <h1><b>ProctorVision</b></h1>
          </a>
        </div>

        <div className="header-right">
          {/* ✅ FIXED: CREATE/JOIN DROPDOWN - ONLY SHOW ON HOMEPAGE */}
          {!selectedClass && (
            <div className="plus-btn-container" ref={createJoinDropdownRef}>
              <button 
                className="plus-btn"
                onClick={() => setShowCreateJoinDropdown(!showCreateJoinDropdown)}
              >
                <FaPlus className="plus-icon" />
              </button>
              {showCreateJoinDropdown && (
                <div className="create-join-dropdown">
                  {userRole === "teacher" && (
                    <button 
                      className="create-join-item"
                      onClick={() => {
                        setShowCreateModal(true);
                        setShowCreateJoinDropdown(false);
                      }}
                    >
                      <FaBook className="create-join-icon" />
                      Create Class
                    </button>
                  )}
                  
                  {userRole === "student" && (
                    <button 
                      className="create-join-item"
                      onClick={() => {
                        setShowJoinModal(true);
                        setShowCreateJoinDropdown(false);
                      }}
                    >
                      <FaUserPlus className="create-join-icon" />
                      Join Class
                    </button>
                  )}
                  
                  {/* ✅ ADD QUIZ CREATION OPTION FOR TEACHERS */}
                  {userRole === "teacher" && selectedClass && (
                    <button 
                      className="create-join-item"
                      onClick={() => {
                        navigate(`/class/${selectedClass._id}/quiz/new`);
                        setShowCreateJoinDropdown(false);
                      }}
                    >
                      <FaPlus className="create-join-icon" />
                      Create Live Class
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* USER PROFILE DROPDOWN */}
          <div className="user-profile" ref={userDropdownRef}>
            <button 
              className="user-profile-btn"
              onClick={() => setShowUserDropdown(!showUserDropdown)}
            >
              <img 
                src={user.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=203a43&color=fff`}
                alt="User Avatar" 
                className="user-avatar"
                onError={(e) => {
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=203a43&color=fff`;
                }}
              />
            </button>
            {showUserDropdown && (
              <div className="user-dropdown">
                <div className="user-dropdown-header">
                  <div className="user-info">
                    <div className="user-name">{user.name}</div>
                    <div className="user-email">{user.email}</div>
                    <div className="user-role">Role: {userRole}</div>
                    {user.profileImage && (
                      <div className="profile-image-preview">
                        <img 
                          src={user.profileImage} 
                          alt="Profile" 
                          className="preview-image"
                        />
                        <span>Google Profile</span>
                      </div>
                    )}
                  </div>
                </div>
                <ul className="user-dropdown-menu">
                  <li className="user-dropdown-item">
                    <button 
                      className="user-dropdown-link"
                      onClick={() => {
                        setShowSettingsModal(true);
                        setShowUserDropdown(false);
                      }}
                    >
                      <FaCog className="user-dropdown-icon" />
                      Settings
                    </button>
                  </li>
                  <li className="user-dropdown-item">
                    <a 
                      href="https://myaccount.google.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="user-dropdown-link"
                      onClick={() => setShowUserDropdown(false)}
                    >
                      <FaCog className="user-dropdown-icon" />
                      Manage your Google account
                    </a>
                  </li>
                  <li className="user-dropdown-item">
                    <hr className="user-dropdown-divider" />
                  </li>
                  <li className="user-dropdown-item">
                    <button 
                      className="user-dropdown-link"
                      onClick={handleLogout}
                      style={{ color: '#d93025' }}
                    >
                      <FaSignOutAlt className="user-dropdown-icon" />
                      Logout
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT SECTION */}
      <main className="dashboard-main">
        {/* SIDEBAR NAVIGATION */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`} ref={sidebarRef}>
  <nav className="sidebar-nav">
    <button 
      className={`sidebar-item ${activeSidebar === 'home' ? 'active' : ''}`}
      onClick={() => {
        setActiveSidebar('home');
        setSelectedClass(null);
      }}
    >
      <FaHome className="sidebar-icon" />
      <span className="sidebar-text">Home</span>
    </button>
    
    <button 
      className={`sidebar-item ${activeSidebar === 'calendar' ? 'active' : ''}`}
      onClick={() => setActiveSidebar('calendar')}
    >
      <FaCalendarAlt className="sidebar-icon" />
      <span className="sidebar-text">Calendar</span>
    </button>
    
    {/* TEACHING CLASSES SECTION */}
    {userRole === "teacher" && (
      <>
        {teachingClasses.length > 0 ? (
          <>
            <div 
              className="section-header dropdown-header"
              onClick={() => setTeachingDropdownOpen(!teachingDropdownOpen)}
            >
              <span>CLASS </span>
              <span className={`dropdown-arrow ${teachingDropdownOpen ? 'open' : ''}`}>
                <FaChevronLeft />
              </span>
            </div>
            
            {teachingDropdownOpen && (
              <div className="teaching-dropdown">
                <div className="teaching-classes-list">
                  {teachingClasses.map((classData) => (
                    <div
                      key={classData._id}
                      className={`class-list-item ${selectedClass?._id === classData._id ? 'selected' : ''}`}
                      onClick={() => handleSelectClass(classData)}
                    >
                      <div className={`class-avatar ${getRandomColor()}`}>
                        {classData.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="class-info">
                        <span className="class-name">{classData.name}</span>
                        <span className="class-details">{classData.section || classData.code}</span>
                      </div>
                      <span className="role-badge teacher">Teacher</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="empty-teaching-section">
            <p className="empty-teaching-text">You're not teaching any classes yet</p>
            <button 
              className="create-class-sidebar-btn"
              onClick={() => setShowCreateModal(true)}
            >
              Create Class
            </button>
          </div>
        )}
      </>
    )}
    
    {/* ENROLLED CLASSES SECTION - FIXED BACKGROUND COLOR */}
    {userRole === "student" && enrolledClasses.length > 0 && (
      <>
        <div 
          className="section-header dropdown-header"
          onClick={() => setEnrolledDropdownOpen(!enrolledDropdownOpen)}
        >
          <span>ENROLLED ({enrolledClasses.length})</span>
          <span className={`dropdown-arrow ${enrolledDropdownOpen ? 'open' : ''}`}>
            <FaChevronLeft />
          </span>
        </div>
        
        {enrolledDropdownOpen && (
          <div className="enrolled-dropdown">
            <div className="enrolled-classes-list">
              {enrolledClasses.slice(0, 8).map((classData) => {
                const userInitial = user.name ? user.name.charAt(0).toUpperCase() : 'S';
                const classColor = getRandomColor();
                
                return (
                  <div
                    key={classData._id}
                    className={`class-list-item ${selectedClass?._id === classData._id ? 'selected' : ''}`}
                    onClick={() => handleSelectClass(classData)}
                  >
                    <div className={`class-avatar ${classColor}`}>
                      {classData.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="class-info">
                      <span className="class-name">{classData.name}</span>
                      <span className="class-details">{classData.ownerId?.name || 'Teacher'}</span>
                    </div>
                    <span className="role-badge student">Student</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </>
    )}
    
    {userRole === "student" && enrolledClasses.length === 0 && (
      <div className="empty-sidebar-section">
        <p className="empty-sidebar-text">You haven't enrolled in any classes yet</p>
        <button 
          className="create-class-sidebar-btn"
          onClick={() => setShowJoinModal(true)}
        >
          Join Class
        </button>
      </div>
    )}
    
    {/* ARCHIVED CLASSES - ONLY FOR TEACHERS */}
    {userRole === "teacher" && (
      <button 
        className={`sidebar-item ${activeSidebar === 'archived' ? 'active' : ''}`}
        onClick={() => setActiveSidebar('archived')}
      >
        <FaArchive className="sidebar-icon" />
        <span className="sidebar-text">Archived Classes</span>
      </button>
    )}
    
    <button 
      className={`sidebar-item ${activeSidebar === 'settings' ? 'active' : ''}`}
      onClick={() => setActiveSidebar('settings')}
    >
      <FaCog className="sidebar-icon" />
      <span className="sidebar-text">Settings</span>
    </button>
  </nav>
</aside>

        {/* MAIN CONTENT AREA */}
        <div className={`main-content ${sidebarOpen ? '' : 'expanded'}`}>
          {renderMainContent()}
        </div>
      </main>

      {/* ✅ ADDED: MODAL COMPONENTS */}
      <CreateClassModal />
      <JoinModal />
      {AnnouncementModal()}
      <DeployExamModal />
      <UnenrollModal />
      <ArchiveModal />
      <RestoreModal />
      <SettingsModal />
      <DeleteConfirmationModal />
      
      {/* ✅ ADDED: Change Password Modal */}
      <ChangePasswordModal />

      {/* ✅ ADDED: Violation Summary Modal */}
      {showViolationSummary && selectedExamForSummary && (
        <ViolationSummaryModal
          isOpen={showViolationSummary}
          onClose={() => {
            setShowViolationSummary(false);
            setSelectedExamForSummary(null);
          }}
          examId={selectedExamForSummary._id}
          examTitle={selectedExamForSummary.title}
          examType={selectedExamForSummary.examType || 'live-class'}
        />
      )}
    </div>
  );
}