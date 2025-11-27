// src/components/Dashboard.jsx - NOTIFICATION BELL AND DASHBOARD PAGE REMOVED
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaPlus, FaHome, FaCalendarAlt, FaArchive, FaCog, FaSignOutAlt, FaBook, FaUserPlus, FaBars, FaChevronLeft, FaChevronRight, FaEdit, FaTrash, FaEllipsisV, FaChevronDown, FaEnvelope, FaUserMinus, FaVolumeMute, FaVolumeUp, FaSave, FaTimes } from "react-icons/fa";
import api, { 
  deleteAllQuizzes, 
  deleteQuiz, 
  getQuizForStudent, 
   joinExamSession
} from "../lib/api";
import "./Dashboard.css";

// ✅ NOTIFICATION BELL IMPORT REMOVED
import ChatForum from '../components/ChatForum';

export default function Dashboard() {
  // ===== ROUTING HOOKS =====
  const navigate = useNavigate();
  const location = useLocation();

  // ===== USER AT CLASS STATES =====
  const [user, setUser] = useState({ name: "Loading...", email: "", _id: "" });
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [activeSidebar, setActiveSidebar] = useState("home");
  const [activeTab, setActiveTab] = useState("stream");

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
    // ✅ NOTIFICATION SETTINGS REMOVED
  });
  const [savingSettings, setSavingSettings] = useState(false);

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

  // ===== CREATE DROPDOWN STATE =====
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);

  // ===== PEOPLE TAB STATES =====
  const [classPeople, setClassPeople] = useState({ teachers: [], students: [] });
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [activeActions, setActiveActions] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [emailData, setEmailData] = useState({ subject: '', message: '' });

  // ===== REFS FOR CLICK OUTSIDE DETECTION =====
  const userDropdownRef = useRef(null);
  const createJoinDropdownRef = useRef(null);
  const sidebarRef = useRef(null);
  const menuRef = useRef(null);
  const commentMenuRef = useRef(null);
  const commentDeleteMenuRef = useRef(null);
  const createDropdownRef = useRef(null);
  const actionsDropdownRef = useRef(null);
  const settingsModalRef = useRef(null);

  // ===== SEPARATE CLASSES BY ROLE =====
  const teachingClasses = classes.filter(classData => classData.userRole === "teacher" || classData.isTeacher);
  const enrolledClasses = classes.filter(classData => classData.userRole === "student" || !classData.isTeacher);
  const allClasses = [...classes];

  // ===== SETTINGS FUNCTIONS =====
  const handleManageSettings = () => {
    setSettingsData({
      name: user.name,
      email: user.email,
      profilePicture: user.profilePicture || '',
      // ✅ NOTIFICATION SETTINGS REMOVED
    });
    setShowSettingsModal(true);
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      // Update user profile
      const response = await api.put("/auth/profile", {
        name: settingsData.name,
        email: settingsData.email,
        profilePicture: settingsData.profilePicture
      });
      
      if (response.data.success) {
        setUser(prev => ({ ...prev, ...settingsData }));
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
      // Create a temporary URL for the uploaded image
      const imageUrl = URL.createObjectURL(file);
      setSettingsData(prev => ({
        ...prev,
        profilePicture: imageUrl
      }));
    }
  };

  // ===== PEOPLE TAB FUNCTIONS =====
  const fetchClassPeople = async () => {
    if (!selectedClass) return;
    
    setLoadingPeople(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/student-management/${selectedClass._id}/students`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        setClassPeople(result.data);
      } else {
        console.error('Failed to fetch people data:', result.message);
      }
    } catch (err) {
      console.error('Error fetching people data:', err);
    } finally {
      setLoadingPeople(false);
    }
  };

  const handleRemoveStudent = async (studentId, studentName) => {
    if (!window.confirm(`Are you sure you want to remove ${studentName} from this class?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/student-management/${selectedClass._id}/students/${studentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        alert('Student removed successfully');
        fetchClassPeople(); // Refresh data
      } else {
        alert('Failed to remove student: ' + result.message);
      }
    } catch (err) {
      alert('Failed to remove student');
      console.error('Error removing student:', err);
    }
  };

  const handleToggleMute = async (studentId, studentName, isCurrentlyMuted) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/student-management/${selectedClass._id}/students/${studentId}/mute`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        alert(`Student ${isCurrentlyMuted ? 'unmuted' : 'muted'} successfully`);
        fetchClassPeople(); // Refresh data
      } else {
        alert('Failed to update student: ' + result.message);
      }
    } catch (err) {
      alert('Failed to update student');
      console.error('Error toggling mute:', err);
    }
  };

  // FIXED: Toggle actions with proper event handling
  const toggleActions = useCallback((personId, event) => {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    setActiveActions(activeActions === personId ? null : personId);
  }, [activeActions]);

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
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/student-management/${selectedClass._id}/email-students`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentIds: selectedStudents,
          subject: emailData.subject,
          message: emailData.message
        })
      });

      const result = await response.json();

      if (result.success) {
        alert(`Email prepared for ${result.data.recipients} students`);
        setShowEmailModal(false);
        setSelectedStudents([]);
        setEmailData({ subject: '', message: '' });
      } else {
        alert('Failed to send emails: ' + result.message);
      }
    } catch (err) {
      alert('Failed to send emails');
      console.error('Error sending emails:', err);
    }
  };

  // ===== QUIZ FUNCTIONS =====
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
      console.log("🚀 Starting exam session for:", exam._id);
      
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

  const isQuizAvailableForStudent = (item) => {
    if (!item) return false;
    
    console.log("📊 Checking quiz availability:", {
      title: item.title,
      isPublished: item.isPublished,
      isDeployed: item.isDeployed,
      isActive: item.isActive,
      isQuiz: item.isQuiz,
      type: item.type,
      hasQuestions: item.questions?.length > 0
    });
    
    const isAvailable = 
      item.isPublished || 
      item.isDeployed ||
      item.isActive ||
      item.isQuiz ||
      item.type === 'quiz' ||
      (item.questions && item.questions.length > 0);
    
    return isAvailable;
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

  const handleDeleteAllQuizzes = async () => {
    if (!selectedClass) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ALL quizzes and forms from "${selectedClass.name}"? This action cannot be undone.`
    );
    
    if (!confirmDelete) return;
    
    setDeletingAll(true);
    try {
      const response = await deleteAllQuizzes(selectedClass._id);
      
      if (response.success) {
        alert(`✅ ${response.message}`);
        fetchClasswork();
      }
    } catch (error) {
      console.error("Failed to delete all quizzes:", error);
      alert("Failed to delete quizzes: " + (error.response?.data?.message || error.message));
    } finally {
      setDeletingAll(false);
    }
  };

  // ===== EFFECT FOR HANDLING REDIRECT STATE =====
  useEffect(() => {
    if (location.state) {
      const { selectedClassId, activeTab, showClasswork, refreshClasswork } = location.state;
      
      console.log("🔄 Handling redirect state:", location.state);
      
      if (selectedClassId && classes.length > 0) {
        const targetClass = classes.find(c => c._id === selectedClassId);
        if (targetClass) {
          console.log("🎯 Selecting class from redirect:", targetClass.name);
          setSelectedClass(targetClass);
          
          if (activeTab) {
            setActiveTab(activeTab);
            console.log("📁 Setting active tab:", activeTab);
          }
          
          if (showClasswork) {
            setActiveTab('classwork');
            console.log("🎯 Forcing classwork tab");
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

      if (createDropdownRef.current && !createDropdownRef.current.contains(event.target)) {
        setShowCreateDropdown(false);
      }

      // FIXED: Add click outside handler for actions dropdown
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(event.target)) {
        setActiveActions(null);
      }

      // Settings modal click outside handler
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
        console.log("✅ User data:", userData);

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

  // Effect para i-fetch ang review count kapag nagbago ang userRole
  useEffect(() => {
    if (userRole) {
      fetchReviewCount();
    }
  }, [userRole]);

  // Effect para i-fetch ang announcements kapag nagbago ang selected class o active tab
  useEffect(() => {
    if (selectedClass && activeTab === 'stream') {
      fetchAnnouncements();
    }
  }, [selectedClass, activeTab]);

  // Effect para i-fetch ang classwork kapag nagbago ang selected class o active tab
  useEffect(() => {
    if (selectedClass && activeTab === 'classwork') {
      fetchClasswork();
    }
  }, [selectedClass, activeTab]);

  // Effect para i-fetch ang people data kapag nagbago ang selected class o active tab
  useEffect(() => {
    if (selectedClass && activeTab === 'people') {
      fetchClassPeople();
    }
  }, [selectedClass, activeTab]);

  // Effect para i-generate ang calendar events kapag nagbago ang classes
  useEffect(() => {
    generateCalendarEvents();
  }, [classes]);

  // Function para kunin ang classwork
  const fetchClasswork = async () => {
    if (!selectedClass) return;
    
    try {
      const classworkRes = await api.get(`/classwork/${selectedClass._id}`);
      setClasswork(classworkRes.data?.data || classworkRes.data || []);
    } catch (error) {
      console.log("Classwork endpoint not available yet, using mock data");
      setClasswork([
        {
          _id: '1',
          title: 'Welcome Assignment',
          description: 'Complete this introductory assignment to get started',
          type: 'assignment',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          points: 100,
          topic: 'Introduction',
          createdBy: { name: user.name },
          createdAt: new Date().toISOString()
        }
      ]);
    }
  };

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

  // ===== CREATE DROPDOWN HANDLER =====
  const handleCreateOption = (option) => {
    console.log("Selected:", option);
    setShowCreateDropdown(false);
    
    switch(option) {
      case 'assignment':
        alert('Create Assignment clicked');
        break;
      case 'quiz':
        if (selectedClass) {
          navigate(`/class/${selectedClass._id}/quiz/new`);
        } else {
          alert('Please select a class first');
        }
        break;
      case 'question':
        alert('Create Question clicked');
        break;
      case 'material':
        alert('Create Material clicked');
        break;
      case 'reuse':
        alert('Reuse Post clicked');
        break;
      case 'topic':
        alert('Create Topic clicked');
        break;
      case 'delete-all':
        handleDeleteAllQuizzes();
        break;
      default:
        break;
    }
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

  // ===== CLASS CREATION AND JOINING =====
  const createClass = async (e) => {
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
  };

  const joinClass = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/class/join", { code: joinCode });
      const joinedClass = res.data.data || res.data;
      setClasses([...classes, { ...joinedClass, userRole: "student" }]);
      setJoinCode("");
      setShowJoinModal(false);
      alert("Successfully joined class!");
    } catch (error) {
      alert(error.response?.data?.message || "Failed to join class");
    }
  };

  const handleSelectClass = async (classData) => {
    console.log("🎯 Selecting class:", classData.name);
    setSelectedClass(classData);
    setActiveTab("stream");
    
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
    const colors = ['blue', 'red', 'green'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // ===== CHAT TAB RENDERER =====
  const renderChatTab = () => {
    if (!selectedClass) return null;
    
    return (
      <div className="chat-tab">
        <ChatForum 
          classId={selectedClass._id} 
          currentUser={{
            id: user._id,
            role: selectedClass.userRole,
            name: user.name
          }}
        />
      </div>
    );
  };

  // ===== SETTINGS MODAL COMPONENT =====
  const SettingsModal = () => {
    if (!showSettingsModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" ref={settingsModalRef}>
          <div className="flex justify-between items-center p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
            <button 
              className="text-gray-400 hover:text-gray-600 transition-colors"
              onClick={() => setShowSettingsModal(false)}
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
                    src={settingsData.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(settingsData.name)}&background=203a43&color=fff`}
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

              {/* Name and Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={settingsData.name}
                    onChange={(e) => handleSettingsInputChange('name', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={settingsData.email}
                    onChange={(e) => handleSettingsInputChange('email', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your email"
                  />
                </div>
              </div>
            </div>

            {/* ✅ NOTIFICATION SETTINGS SECTION REMOVED */}

            {/* Account Settings */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Settings</h3>
              
              <div className="space-y-3">
                <button className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <p className="font-medium text-gray-900">Change Password</p>
                  <p className="text-sm text-gray-600">Update your password regularly</p>
                </button>
                
                <button className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <p className="font-medium text-gray-900">Privacy Settings</p>
                  <p className="text-sm text-gray-600">Manage your privacy preferences</p>
                </button>
                
                <button className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <p className="font-medium text-gray-900">Connected Accounts</p>
                  <p className="text-sm text-gray-600">Manage linked social accounts</p>
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => setShowSettingsModal(false)}
              className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings || !settingsData.name.trim() || !settingsData.email.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <FaSave className="w-4 h-4" />
              <span>{savingSettings ? "Saving..." : "Save Changes"}</span>
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
    
    console.log("🎯 ANNOUNCEMENT CARD RENDERED:", {
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
      
      console.log("🚀 Calling updateAnnouncement API...");
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

  // ===== CLASS CARD COMPONENT =====
  const ClassCard = ({ classData }) => {
    const isTeacher = classData.userRole === "teacher";
    
    return (
      <div 
        key={classData._id} 
        className="class-card bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 border border-gray-200 cursor-pointer relative overflow-visible"
        onClick={() => handleSelectClass(classData)}
      >
        {/* CHAT BUTTON */}
        <div className="absolute top-3 left-3 z-40">
          <button 
            className="p-2 rounded-full hover:bg-blue-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50 shadow-md border border-blue-200 text-blue-600"
            onClick={(e) => {
              e.stopPropagation();
              handleSelectClass(classData);
              setActiveTab("chat");
            }}
            title="Open Class Chat"
          >
            💬
          </button>
        </div>

        <div className="absolute top-3 right-3 z-50">
          <button 
            className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-md border border-gray-200"
            onClick={(e) => toggleMenu(classData._id, e)}
          >
            <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          
          {showMenuForClass === classData._id && (
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
              {isTeacher ? (
                <>
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenuForClass(null);
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Edit class</span>
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 flex items-center space-x-2 transition-colors"
                    onClick={(e) => confirmArchive(classData, e)}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    <span>Archive class</span>
                  </button>
                  <hr className="my-1" />
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenuForClass(null);
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Delete class</span>
                  </button>
                </>
              ) : (
                <button
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2 transition-colors"
                  onClick={(e) => confirmUnenroll(classData, e)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Unenroll from class</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-semibold text-lg text-gray-800 truncate flex-1 pr-12">{classData.name}</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              isTeacher 
                ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                : 'bg-green-100 text-green-800 border border-green-200'
            }`}>
              {isTeacher ? "Teacher" : "Student"}
            </span>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Class Code: <strong className="font-mono bg-gray-100 px-2 py-1 rounded border">{classData.code}</strong>
            </p>
            <p className="text-sm text-gray-600">
              Owner: <span className="font-medium">{classData.ownerId?.name || "You"}</span>
            </p>
            <div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
              <span className="flex items-center bg-gray-50 px-2 py-1 rounded">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
                </svg>
                {classData.members?.length || 1} members
              </span>
              <span className="flex items-center bg-gray-50 px-2 py-1 rounded">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
                </svg>
                {classData.exams?.length || 0} exams
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ===== PEOPLE TAB RENDERER =====
const renderPeopleTab = () => {
  if (loadingPeople) {
    return <div className="loading">Loading people...</div>;
  }

  return (
    <div className="people-tab">
      <div className="people-header">
        <h3>People</h3>
        {isTeacher && classPeople.students.length > 0 && (
          <button 
            className="email-students-btn"
            onClick={() => setShowEmailModal(true)}
          >
            <FaEnvelope className="btn-icon" />
            Email Students
          </button>
        )}
      </div>

      {/* Teachers Section */}
      <div className="people-section">
        <h4 className="section-title">Teachers</h4>
        <div className="people-list">
          {classPeople.teachers.map(teacher => (
            <div key={teacher._id} className="person-card teacher-card">
              <div className="person-avatar">
                {teacher.name.charAt(0).toUpperCase()}
              </div>
              <div className="person-info">
                <div className="person-name">{teacher.name}</div>
                <div className="person-email">{teacher.email}</div>
                <div className="person-role teacher-role">Teacher</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Students Section */}
      <div className="people-section">
        <div className="section-header">
          <h4 className="section-title">Students ({classPeople.students.length})</h4>
        </div>

        {classPeople.students.length > 0 ? (
          <div className="students-container">
            {/* Bulk Selection Header */}
            {isTeacher && (
              <div className="bulk-selection-header">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedStudents.length === classPeople.students.length}
                    onChange={selectAllStudents}
                  />
                  Select All
                </label>
                <span className="selected-count">
                  {selectedStudents.length} selected
                </span>
              </div>
            )}

            {/* Students List */}
            <div className="people-list">
              {classPeople.students.map(student => (
                <div key={student._id} className="person-card student-card">
                  {isTeacher && (
                    <div className="student-select">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student._id)}
                        onChange={() => toggleStudentSelection(student._id)}
                      />
                    </div>
                  )}
                  <div className="person-avatar">
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="person-info">
                    <div className="person-name">
                      {student.name}
                      {student.isMuted && <span className="muted-badge">Muted</span>}
                    </div>
                    <div className="person-email">{student.email}</div>
                    <div className="person-meta">
                      Joined {new Date(student.joinedAt).toLocaleDateString()}
                    </div>
                  </div>
                  {isTeacher && (
                    <div className="person-actions-container" ref={actionsDropdownRef}>
                      <button 
                        className="actions-toggle"
                        onClick={(e) => toggleActions(student._id, e)}
                      >
                        <FaEllipsisV />
                      </button>
                      
                      {activeActions === student._id && (
                        <div className="actions-dropdown">
                          <button 
                            className="action-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleMute(student._id, student.name, student.isMuted);
                              setActiveActions(null);
                            }}
                          >
                            {student.isMuted ? <FaVolumeUp /> : <FaVolumeMute />}
                            {student.isMuted ? 'Unmute' : 'Mute'} Student
                          </button>
                          <button 
                            className="action-item remove"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveStudent(student._id, student.name);
                              setActiveActions(null);
                            }}
                          >
                            <FaUserMinus />
                            Remove from Class
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h4>No Students Yet</h4>
            <p>Students will appear here once they join your class using the class code.</p>
          </div>
        )}
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content">
            <div className="modal-header">
              <h3>Email Students</h3>
              <button 
                className="close-btn"
                onClick={() => setShowEmailModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>Sending to {selectedStudents.length} selected students</p>
              <div className="form-group">
                <label>Subject</label>
                <input
                  type="text"
                  placeholder="Enter email subject"
                  value={emailData.subject}
                  onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Message</label>
                <textarea
                  placeholder="Enter your message"
                  rows="6"
                  value={emailData.message}
                  onChange={(e) => setEmailData(prev => ({ ...prev, message: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="btn-secondary"
                onClick={() => setShowEmailModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary"
                onClick={handleEmailStudents}
                disabled={!emailData.subject.trim() || !emailData.message.trim()}
              >
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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

  // Stream content na may working announcements
  const renderStreamContent = () => {
    return (
      <div className="stream-content">
        {isTeacher && (
          <div className="stream-actions">
            <button 
              className="new-announcement-btn"
              onClick={() => setShowAnnouncementModal(true)}
            >
              <span className="btn-icon">
                <i className="material-icons">campaign</i>
              </span>
              New announcement
            </button>
            <button className="repost-btn">
              <span className="btn-icon">
                <i className="material-icons">repeat</i>
              </span>
              Repost
            </button>
          </div>
        )}

        {loadingAnnouncements && (
          <div className="announcements-loading">
            <div className="loading-spinner"></div>
            <p>Loading announcements...</p>
          </div>
        )}

        {!loadingAnnouncements && announcements.length > 0 ? (
          <div className="announcements-list">
            {announcements.map((announcement) => (
              <AnnouncementCard 
                key={announcement._id} 
                announcement={announcement} 
              />
            ))}
          </div>
        ) : !loadingAnnouncements && (
          <div className="stream-empty-state">
            <div className="empty-illustration">
              <svg viewBox="0 0 241 149" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M138.19 145.143L136.835 145.664C134.646 146.498 132.249 145.352 131.519 143.164L82.4271 8.37444C81.5933 6.18697 82.7398 3.79117 84.9286 3.06201L86.2836 2.54118C88.4724 1.70786 90.8697 2.85368 91.5993 5.04115L140.691 139.831C141.421 142.018 140.379 144.414 138.19 145.143Z" stroke="#5F6368" strokeWidth="2"></path>
                <path d="M76.6602 10.5686C78.2029 12.2516 83.3923 14.7762 88.4414 13.0932C98.5395 9.72709 96.8565 2.57422 96.8565 2.57422" stroke="#5F6368" strokeWidth="2" strokeLinecap="round"></path>
              </svg>
            </div>
            <div className="empty-content">
              <p className="empty-title">Class announcements</p>
              <p className="empty-description">
                {isTeacher 
                  ? "Use announcements to post updates, reminders, and more to your class." 
                  : "Announcements from your teacher will appear here."}
              </p>
              <div className="empty-actions">
                {isTeacher && (
                  <button 
                    className="stream-settings-btn"
                    onClick={() => setShowAnnouncementModal(true)}
                  >
                    
                    Create announcement
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Classwork Tab na may START QUIZ BUTTON FOR STUDENTS
  const renderClassworkTab = () => {
    return (
      <div className="classwork-tab">
        <div className="classwork-header-section">
          <div className="classwork-header">
            {selectedClass?.userRole === "teacher" && (
              <div className="create-dropdown-container" ref={createDropdownRef}>
                <button 
                  className="create-btn dropdown-trigger"
                  onClick={() => setShowCreateDropdown(!showCreateDropdown)}
                >
                  <FaPlus className="btn-icon" />
                  Create
                  <span className={`dropdown-arrow ${showCreateDropdown ? 'open' : ''}`}>
                    <FaChevronDown />
                  </span>
                </button>
                
                {showCreateDropdown && (
                  <div className="create-dropdown-menu">
                    <div className="dropdown-item" onClick={() => handleCreateOption('assignment')}>
                      <span className="dropdown-icon">📝</span>
                      <div className="dropdown-content">
                        <div className="dropdown-title">Assignment</div>
                        <div className="dropdown-description">Create a new assignment for students</div>
                      </div>
                    </div>
                    
                    <div className="dropdown-item" onClick={() => handleCreateOption('quiz')}>
                      <span className="dropdown-icon">❓</span>
                      <div className="dropdown-content">
                        <div className="dropdown-title">Quiz/Exam</div>
                        <div className="dropdown-description">Create a quiz or test</div>
                      </div>
                    </div>
                    
                    <div className="dropdown-item" onClick={() => handleCreateOption('question')}>
                      <span className="dropdown-icon">💬</span>
                      <div className="dropdown-content">
                        <div className="dropdown-title">Question</div>
                        <div className="dropdown-description">Post a question for students</div>
                      </div>
                    </div>
                    
                    <div className="dropdown-item" onClick={() => handleCreateOption('material')}>
                      <span className="dropdown-icon">📎</span>
                      <div className="dropdown-content">
                        <div className="dropdown-title">Material</div>
                        <div className="dropdown-description">Share learning materials</div>
                      </div>
                    </div>
                    
                    <div className="dropdown-item" onClick={() => handleCreateOption('reuse')}>
                      <span className="dropdown-icon">🔄</span>
                      <div className="dropdown-content">
                        <div className="dropdown-title">Reuse post</div>
                        <div className="dropdown-description">Reuse a post from another class</div>
                      </div>
                    </div>
                    
                    <div className="dropdown-item" onClick={() => handleCreateOption('topic')}>
                      <span className="dropdown-icon">📂</span>
                      <div className="dropdown-content">
                        <div className="dropdown-title">Topic</div>
                        <div className="dropdown-description">Create a new topic</div>
                      </div>
                    </div>

                    {classwork.some(item => item.type === 'quiz') && (
                      <>
                        <div className="dropdown-divider"></div>
                        <div 
                          className="dropdown-item delete-all" 
                          onClick={() => handleCreateOption('delete-all')}
                        >
                          <span className="dropdown-icon">🗑️</span>
                          <div className="dropdown-content">
                            <div className="dropdown-title">Delete All Quizzes</div>
                            <div className="dropdown-description">Remove all quizzes and forms from this class</div>
                          </div>
                          {deletingAll && (
                            <div className="loading-spinner-small"></div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="role-indicator">
            {selectedClass?.userRole === "teacher" ? (
              <div className="teacher-indicator">
                👨‍🏫 You are viewing this class as a <strong>teacher</strong>.
                {classwork.some(item => item.type === 'quiz') && (
                  <button 
                    className="delete-all-quizzes-btn"
                    onClick={handleDeleteAllQuizzes}
                    disabled={deletingAll}
                  >
                    {deletingAll ? 'Deleting...' : 'Delete All Quizzes'}
                  </button>
                )}
              </div>
            ) : (
              <div className="student-indicator">
                👨‍🎓 You are viewing this class as a <strong>student</strong>.
              </div>
            )}
          </div>
        </div>

        <div className="classwork-content">
          {classwork.length === 0 ? (
            <div className="classwork-empty-state">
              <div className="empty-illustration">
                
              </div>
              <div className="empty-content">
                <h3>No classwork yet</h3>
                <p>
                  {selectedClass?.userRole === "teacher" 
                    ? "Create assignments, quizzes, or materials to get started."
                    : "Your teacher hasn't posted any classwork yet."}
                </p>
              </div>
            </div>
          ) : (
            <div className="classwork-grid">
              {classwork.map((item) => (
                <div className="classwork-card" key={item._id}>
                  <div className="classwork-header">
                    <span className="classwork-icon">
                      {getClassworkIcon(item.type)}
                    </span>
                    <div className="classwork-title-section">
                      <h3>{item.title}</h3>
                      <p className="classwork-type">{item.type}</p>
                    </div>
                    
                    {/* TEACHER ACTIONS */}
{selectedClass?.userRole === "teacher" && item.type === 'quiz' && (
  <div className="teacher-exam-actions">
    {!item.isActive ? (
      <div className="session-controls">
        <button 
          className="start-session-btn"
          onClick={() => handleStartExamSession(item)}
          title="Start live exam session"
        >
          START
        </button>
        
        {!item.isDeployed ? (
          <button 
            className="deploy-exam-btn"
            onClick={() => handleDeployExam(item)}
            title="Deploy exam for students"
          >
            🚀 Deploy Exam
          </button>
        ) : (
          <button 
            className="undeploy-exam-btn"
            onClick={() => handleUndeployExam(item._id)}
            title="Undeploy exam"
          >
            END
          </button>
        )}
      </div>
    ) : (
      <div className="active-session-controls">
        <button 
          className="view-session-btn"
          onClick={() => navigate(`/teacher-exam/${item._id}`)}
          title="Manage active session"
        >
          START
        </button>
        <button 
          className="end-session-btn"
          onClick={() => handleEndExamSession(item._id)}
          title="End exam session"
        >
          END
        </button>
      </div>
    )}
    
    <button 
      className="delete-quiz-btn"
      onClick={() => handleDeleteQuiz(item._id, item.title)}
      disabled={deletingQuiz === item._id}
      title="Delete this quiz"
    >
      {deletingQuiz === item._id ? ' Deleting...' : ''} DELETE
    </button>
  </div>
)}
                  </div>
                  
                  {item.description && (
                    <p className="classwork-description">{item.description}</p>
                  )}
                  <div className="classwork-meta">
                    {item.dueDate && (
                      <span>Due: {new Date(item.dueDate).toLocaleDateString()}</span>
                    )}
                    {item.points && (
                      <span>{item.points} points</span>
                    )}
                    {item.topic && (
                      <span>Topic: {item.topic}</span>
                    )}
                    {item.questions && (
                      <span>Questions: {item.questions.length || 0}</span>
                    )}
                  </div>

                  {/* START QUIZ BUTTON FOR STUDENTS */}
{selectedClass?.userRole === "student" && item.type === 'quiz' && (
  <div className="classwork-actions">
    {item.isActive ? (
      <div className="quiz-availability">
        <button 
          className="start-quiz-btn camera-required"
          onClick={async () => {
            try {
              setQuizLoading(true);
              
              const joinResponse = await joinExamSession(item._id);
              if (joinResponse.success) {
                navigate(`/student-quiz/${item._id}`, {
                  state: {
                    examTitle: item.title,
                    classId: selectedClass?._id,
                    className: selectedClass?.name,
                    requiresCamera: true,
                    isExamSession: true
                  }
                });
              }
            } catch (error) {
              console.error("Failed to join exam session:", error);
              alert("❌ Failed to join exam session. Please try again.");
            } finally {
              setQuizLoading(false);
            }
          }}
          disabled={quizLoading}
          title="Join live exam session (Camera & Microphone required)"
        >
          {quizLoading ? 'Joining...' : (
            <>
              📹 Join Live Exam
              <span className="camera-badge">📷🎤</span>
            </>
          )}
        </button>
        
        <div className="session-info">
          <small>✅ Live session active • 📷🎤 Camera & Mic required</small>
        </div>
      </div>
    ) : item.isPublished || item.isDeployed ? (
      <div className="quiz-info waiting">
        <button className="start-quiz-btn" disabled>
          ⏳ Waiting for Teacher
        </button>
        <small>Teacher needs to start the live session</small>
      </div>
    ) : (
      <div className="quiz-info unavailable">
        <small>This exam is not available yet</small>
      </div>
    )}

    <div className="quiz-details">
      {item.questions && (
        <span>{item.questions.length} questions</span>
      )}
      {item.totalPoints > 0 && (
        <span>{item.totalPoints} points</span>
      )}
      {item.dueDate && (
        <span>Due: {new Date(item.dueDate).toLocaleDateString()}</span>
      )}
      {item.isActive && (
        <span className="live-badge">🔴 LIVE</span>
      )}
    </div>
  </div>
)}

                  <div className="classwork-footer">
                    <span>Created by {item.createdBy?.name || 'Teacher'}</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
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

          {/* UPDATED TAB NAVIGATION - REMOVED STREAM, PEOPLE, GRADE TABS FOR STUDENT */}
          <div className="classroom-tabs">
            {/* Teacher View - Removed Stream tab */}
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
                  className={`classroom-tab ${activeTab === "chat" ? "active" : ""}`}
                  onClick={() => setActiveTab("chat")}
                >
                  Chat 
                </button>
                <button 
                  className={`classroom-tab ${activeTab === "grades" ? "active" : ""}`}
                  onClick={() => setActiveTab("grades")}
                >
                  Grades
                </button>
              </>
            )}
            
            {/* Student View - Removed Stream, People, Grade tabs */}
            {selectedClass?.userRole === "student" && (
              <>
                <button 
                  className={`classroom-tab ${activeTab === "classwork" ? "active" : ""}`}
                  onClick={() => setActiveTab("classwork")}
                >
                  Classwork
                </button>
                <button 
                  className={`classroom-tab ${activeTab === "chat" ? "active" : ""}`}
                  onClick={() => setActiveTab("chat")}
                >
                  Chat 
                </button>
              </>
            )}
          </div>

          {activeTab === "stream" && (
            <div className="stream-tab">
              <div >
                <div >
                </div>
                <div className="class-title-section">
                  <h1 className="class-main-title">{selectedClass.name}</h1>
                  <div className="class-subtitle">{selectedClass.description || "Class"}</div>
                </div>
                <div className="class-actions">
                
                </div>
              </div>

              <div className="stream-layout">
                <aside className="stream-sidebar">
                  <div className="sidebar-section">
                    <div className="sidebar-header">
                      <h3>Class code</h3>
                      <div className="sidebar-actions">
                        <button className="more-options-btn" aria-label="More options for class code">
                          <svg className="more-icon" focusable="false" width="24" height="24" viewBox="0 0 24 24">
                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="class-code-display">
                      <div className="class-code-text">{selectedClass.code}</div>
                      <button className="display-btn" aria-label="Display class code">
                        <svg className="display-icon" focusable="false" width="24" height="24" viewBox="0 0 24 24">
                          <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"></path>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="sidebar-section">
                    <div className="sidebar-header">
                      <h3>Upcoming</h3>
                    </div>
                    <div className="upcoming-content">
                      <span className="upcoming-text">No work due soon</span>
                      <span className="upcoming-subtext">Woohoo, no work due soon!</span>
                      <div className="upcoming-actions">
                        <button className="view-all-btn">
                          View all
                        </button>
                      </div>
                    </div>
                  </div>
                </aside>

                <main className="stream-main">
                  {renderStreamContent()}
                </main>
              </div>
            </div>
          )}

          {activeTab === "classwork" && renderClassworkTab()}

          {activeTab === "people" && renderPeopleTab()}

          {activeTab === "chat" && renderChatTab()}

          {activeTab === "grades" && (
            <div className="grades-tab">
            </div>
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
              <ClassCard key={classData._id} classData={classData} />
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

  // Settings content renderer - UPDATED WITH WORKING MANAGE BUTTON
  const renderSettingsContent = () => (
    <div className="settings-view">
      <div className="settings-header">
        <h2>Settings</h2>
        <p>Manage your account and notification preferences</p>
      </div>
      <div className="settings-sections">
        <div className="settings-section">
          <h3>Account Settings</h3>
          <p className="settings-description">Manage your account information and preferences</p>
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
          
          {/* ✅ NOTIFICATION PREFERENCES ITEM REMOVED */}
          
          <div className="settings-item">
            <div className="settings-item-content">
              <h4>Privacy & Security</h4>
              <p>Manage your privacy settings and security options</p>
            </div>
            <button 
              className="settings-btn"
              onClick={handleManageSettings}
            >
              Manage
            </button>
          </div>
        </div>
        
        <div className="settings-section">
          <h3>Application Settings</h3>
          <p className="settings-description">Customize your application experience</p>
          <div className="settings-item">
            <div className="settings-item-content">
              <h4>Theme & Appearance</h4>
              <p>Change the look and feel of the application</p>
            </div>
            <button 
              className="settings-btn"
              onClick={handleManageSettings}
            >
              Manage
            </button>
          </div>
          
          <div className="settings-item">
            <div className="settings-item-content">
              <h4>Language & Region</h4>
              <p>Set your preferred language and regional settings</p>
            </div>
            <button 
              className="settings-btn"
              onClick={handleManageSettings}
            >
              Manage
            </button>
          </div>
        </div>
      </div>
    </div>
  );

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
          <a href="/" className="logo">
            <span>CAPSTONE</span>
          </a>
        </div>

        <div className="header-right">
          {/* ✅ NOTIFICATION BELL COMPONENT REMOVED */}
          
          {/* CREATE/JOIN DROPDOWN */}
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
              </div>
            )}
          </div>

          {/* USER PROFILE DROPDOWN */}
          <div className="user-profile" ref={userDropdownRef}>
            <button 
              className="user-profile-btn"
              onClick={() => setShowUserDropdown(!showUserDropdown)}
            >
              <img 
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=203a43&color=fff`} 
                alt="User Avatar" 
                className="user-avatar" 
              />
            </button>
            {showUserDropdown && (
              <div className="user-dropdown">
                <div className="user-dropdown-header">
                  <div className="user-info">
                    <div className="user-name">{user.name}</div>
                    <div className="user-email">{user.email}</div>
                    <div className="user-role">Role: {userRole}</div>
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
            
            <hr className="sidebar-separator" />
            
            {/* TEACHING CLASSES SECTION */}
            {userRole === "teacher" && (
              <>
                {teachingClasses.length > 0 ? (
                  <>
                    <div 
                      className="section-header dropdown-header"
                      onClick={() => setTeachingDropdownOpen(!teachingDropdownOpen)}
                    >
                      <span>Teaching ({teachingClasses.length})</span>
                      <span className={`dropdown-arrow ${teachingDropdownOpen ? 'open' : ''}`}>
                        <FaChevronLeft />
                      </span>
                    </div>
                    
                    {teachingDropdownOpen && (
                      <div className="teaching-dropdown">
                        <button 
                          className="review-button"
                          onClick={() => navigate('/review')}
                        >
                          <span className="review-icon">📝</span>
                          <span className="review-text">To review</span>
                          <span className="review-badge">{itemsToReview}</span>
                        </button>
                        
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
            
            {/* ENROLLED CLASSES SECTION */}
            {userRole === "student" && enrolledClasses.length > 0 && (
              <>
                <div 
                  className="section-header dropdown-header"
                  onClick={() => setEnrolledDropdownOpen(!enrolledDropdownOpen)}
                >
                  <span>Enrolled ({enrolledClasses.length})</span>
                  <span className={`dropdown-arrow ${enrolledDropdownOpen ? 'open' : ''}`}>
                    <FaChevronLeft />
                  </span>
                </div>
                
                {enrolledDropdownOpen && (
                  <div className="enrolled-dropdown">
                    <button 
                      className="todo-button"
                      onClick={() => navigate('/todo')}
                    >
                      <span className="todo-icon">📝</span>
                      <span className="todo-text">To do</span>
                    </button>
                    
                    <div className="enrolled-classes-list">
                      {enrolledClasses.slice(0, 8).map((classData) => (
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
                            <span className="class-details">{classData.ownerId?.name || 'Teacher'}</span>
                          </div>
                          <span className="role-badge student">Student</span>
                        </div>
                      ))}
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
            
            <hr className="sidebar-separator" />
            
            {userRole === "student" && (
              <button 
                className="sidebar-item"
                onClick={() => navigate('/todo')}
              >
                <span className="sidebar-text">To do</span>
              </button>
            )}
            
            <button 
              className={`sidebar-item ${activeSidebar === 'archived' ? 'active' : ''}`}
              onClick={() => setActiveSidebar('archived')}
            >
              <FaArchive className="sidebar-icon" />
              <span className="sidebar-text">Archived Classes</span>
            </button>
            
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

      {/* MODALS SECTION */}
      {showCreateModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Create New Class</h3>
            <form onSubmit={createClass}>
              <input
                type="text"
                placeholder="Class Name"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                required
              />
              <div className="modal-actions">
                <button type="submit" className="primary-btn">
                  <FaPlus className="btn-icon" />
                  Create
                </button>
                <button type="button" onClick={() => setShowCreateModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showJoinModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Join Class</h3>
            <form onSubmit={joinClass}>
              <input
                type="text"
                placeholder="Enter Class Code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                required
              />
              <div className="modal-actions">
                <button type="submit" className="primary-btn">
                  <FaUserPlus className="btn-icon" />
                  Join
                </button>
                <button type="button" onClick={() => setShowJoinModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENDER MODALS */}
      {AnnouncementModal()}
      <DeployExamModal />
      <UnenrollModal />
      <ArchiveModal />
      <RestoreModal />
      <SettingsModal />
    </div>
  );
}