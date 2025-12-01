// src/pages/ToDoPage.jsx - COMPLETE UPDATED VERSION
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaHome,
  FaCalendarAlt,
  FaArchive,
  FaCog,
  FaSignOutAlt,
  FaBars,
  FaChevronLeft,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle
} from "react-icons/fa";
import api from "../lib/api";
import "./Dashboard.css";

export default function ToDoPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState({ name: "Loading...", email: "" });
  const [userRole, setUserRole] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [loading, setLoading] = useState(true);

  const [assignments, setAssignments] = useState([]);
  const [completedAssignments, setCompletedAssignments] = useState([]); // ✅ NEW: For Done tab
  const [classes, setClasses] = useState([]); 
  const [selectedClassFilter, setSelectedClassFilter] = useState("all");

  const [activeTab, setActiveTab] = useState("assigned");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userRes = await api.get("/auth/me");
        setUser(userRes.data);
        setUserRole(userRes.data.role);

        if (userRes.data.role !== "student") {
          alert("This page is for students only.");
          navigate("/dashboard");
          return;
        }

        await fetchStudentAssignments();
        await fetchCompletedExams(); // ✅ NEW: Fetch completed exams
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  // ✅ NEW: Fetch completed exams from backend
  const fetchCompletedExams = async () => {
    try {
      console.log("📋 Fetching completed exams...");
      const response = await api.get("/exams/student/completed");
      
      if (response.success) {
        const completedExams = response.data.map(exam => ({
          ...exam,
          status: "done",
          type: "exam",
          isCompleted: true,
          completedAt: exam.completedAt || exam.submittedAt
        }));
        
        setCompletedAssignments(completedExams);
        console.log("✅ Completed exams loaded:", completedExams.length);
      }
    } catch (error) {
      console.error("❌ Failed to fetch completed exams:", error);
      // Fallback to empty array
      setCompletedAssignments([]);
    }
  };

  const fetchStudentAssignments = async () => {
    try {
      const classesRes = await api.get("/class/my-classes");
      const enrolledClasses = classesRes.data.data || classesRes.data || [];
      setClasses(enrolledClasses);

      const allAssignments = [];

      for (const classData of enrolledClasses) {
        try {
          const examsRes = await api.get(`/exams/${classData._id}`);
          const classExams = examsRes.data.data || examsRes.data || [];

          // ✅ CHECK COMPLETION STATUS FOR EACH EXAM
          const classAssignments = await Promise.all(
            classExams.map(async (exam) => {
              try {
                // Check if student has completed this exam
                const completionRes = await api.get(`/exams/${exam._id}/completion-status`);
                const hasCompleted = completionRes.data?.data?.hasCompleted || false;

                return {
                  _id: exam._id,
                  title: exam.title || "Untitled Exam",
                  classId: classData._id,
                  className: classData.name,
                  teacherName: classData.ownerId?.name || "Teacher",
                  postedDate: exam.createdAt ? new Date(exam.createdAt) : new Date(),
                  dueDate: exam.scheduledAt ? new Date(exam.scheduledAt) : null,
                  status: hasCompleted ? "done" : "assigned", // ✅ SET STATUS BASED ON COMPLETION
                  isDeployed: exam.isDeployed,
                  isCompleted: hasCompleted, // ✅ NEW FIELD
                  type: "exam",
                  // ✅ ADD COMPLETION DATA IF AVAILABLE
                  ...(hasCompleted && {
                    completedAt: completionRes.data?.data?.completion?.completedAt,
                    score: completionRes.data?.data?.completion?.score,
                    percentage: completionRes.data?.data?.completion?.percentage
                  })
                };
              } catch (error) {
                console.error(`Error checking completion for exam ${exam._id}:`, error);
                // Return as not completed if check fails
                return {
                  _id: exam._id,
                  title: exam.title || "Untitled Exam",
                  classId: classData._id,
                  className: classData.name,
                  teacherName: classData.ownerId?.name || "Teacher",
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

          allAssignments.push(...classAssignments);
        } catch (error) {
          console.error(`Failed to fetch exams for class ${classData.name}:`, error);
        }
      }

      setAssignments(allAssignments);
    } catch (error) {
      console.error("Failed to fetch student assignments:", error);
      // Fallback demo data
      setAssignments([
        {
          _id: "1",
          title: "Sample Quiz",
          classId: "demo-1",
          className: "SYSARCH",
          teacherName: "Teacher",
          postedDate: new Date("2025-11-17"),
          dueDate: null,
          status: "assigned",
          isDeployed: true,
          isCompleted: false,
          type: "exam",
        },
      ]);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    window.location.href = "/login";
  };

  // ✅ UPDATED: Filter assignments based on active tab
  const assignmentsByTab = assignments.filter((assignment) => {
    if (activeTab === "assigned") return assignment.status === "assigned" && !assignment.isCompleted;
    if (activeTab === "missing") return assignment.status === "missing";
    if (activeTab === "done") {
      // For "Done" tab, show both completed assignments from classwork AND completed exams
      return assignment.isCompleted || assignment.status === "done";
    }
    return false;
  });

  // ✅ COMBINE REGULAR ASSIGNMENTS AND COMPLETED EXAMS FOR "DONE" TAB
  const getFilteredAssignments = () => {
    if (activeTab === "done") {
      // Combine completed classwork assignments and completed exams
      const completedClasswork = assignments.filter(a => a.isCompleted || a.status === "done");
      const allCompleted = [...completedClasswork, ...completedAssignments];
      
      // Remove duplicates based on _id
      const uniqueCompleted = allCompleted.filter((assignment, index, self) =>
        index === self.findIndex(a => a._id === assignment._id)
      );

      return selectedClassFilter === "all"
        ? uniqueCompleted
        : uniqueCompleted.filter(assignment => assignment.classId === selectedClassFilter);
    }

    // For other tabs, use the original logic
    const filtered = selectedClassFilter === "all"
      ? assignmentsByTab
      : assignmentsByTab.filter(assignment => assignment.classId === selectedClassFilter);

    return filtered;
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

  // ✅ UPDATED: Format completion date for "Done" items
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
    const isCompleted = assignment.isCompleted || assignment.status === "done";
    
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
          
          {/* ✅ SHOW SCORE FOR COMPLETED EXAMS */}
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
                // For completed exams, show results or review
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

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (userRole !== "student") {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>This page is for students only.</p>
        <button onClick={() => navigate("/dashboard")}>Go to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper">
      <header className="dashboard-header">
        <div className="header-left">
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <FaBars className="hamburger-icon" />
          </button>
          <button className="back-btn" onClick={() => navigate("/dashboard")}>
            <FaChevronLeft className="back-icon" />
            Back
          </button>
          <a href="/" className="logo">
            <span>VisionProctor</span>
          </a>
        </div>

        <div className="header-right">
          <div className="user-profile">
            <button
              className="user-profile-btn"
              onClick={() => setShowUserDropdown(!showUserDropdown)}
            >
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                  user.name
                )}&background=203a43&color=fff`}
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
                  </div>
                </div>
                <ul className="user-dropdown-menu">
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
                      style={{ color: "#d93025" }}
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

      <main className="dashboard-main">
        <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
          <nav className="sidebar-nav">
            <button
              className="sidebar-item"
              onClick={() => navigate("/dashboard")}
            >
              <FaHome className="sidebar-icon" />
              <span className="sidebar-text">Home</span>
            </button>

            <button
              className="sidebar-item"
              onClick={() => navigate("/dashboard?view=calendar")}
            >
              <FaCalendarAlt className="sidebar-icon" />
              <span className="sidebar-text">Calendar</span>
            </button>

            <hr className="sidebar-separator" />

            <button className="sidebar-item active">
              <span className="sidebar-text">To do</span>
            </button>

            <hr className="sidebar-separator" />

            <button
              className="sidebar-item"
              onClick={() => navigate("/dashboard?view=archived")}
            >
              <FaArchive className="sidebar-icon" />
              <span className="sidebar-text">Archived Classes</span>
            </button>

            <button
              className="sidebar-item"
              onClick={() => navigate("/dashboard?view=settings")}
            >
              <FaCog className="sidebar-icon" />
              <span className="sidebar-text">Settings</span>
            </button>
          </nav>
        </aside>

        <div className={`main-content ${sidebarOpen ? "" : "expanded"}`}>
          <div className="todo-view">
            <div className="todo-header">
              <h1 className="todo-title">To do</h1>
              <p className="todo-subtitle">
                All your assignments and exams in one place
              </p>
            </div>

            {/* Class Dropdown */}
            <div className="todo-class-dropdown">
              <select
                className="class-filter-select"
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
              >
                <option value="all">All classes</option>
                {classes.map((cls) => (
                  <option key={cls._id} value={cls._id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tabs */}
            <div className="google-classroom-tabs">
              <button
                className={`tab ${activeTab === "assigned" ? "active" : ""}`}
                onClick={() => setActiveTab("assigned")}
              >
                <FaClock className="tab-icon" />
                Assigned
                <span className="tab-count">
                  {assignments.filter(a => !a.isCompleted && a.status !== "done").length}
                </span>
              </button>
              <button
                className={`tab ${activeTab === "missing" ? "active" : ""}`}
                onClick={() => setActiveTab("missing")}
              >
                <FaExclamationTriangle className="tab-icon" />
                Missing
                <span className="tab-count">
                  {assignments.filter(a => a.status === "missing").length}
                </span>
              </button>
              <button
                className={`tab ${activeTab === "done" ? "active" : ""}`}
                onClick={() => setActiveTab("done")}
              >
                <FaCheckCircle className="tab-icon" />
                Done
                <span className="tab-count">
                  {filteredAssignments.length}
                </span>
              </button>
            </div>

            <div className="todo-content">
              {activeTab === "done" ? (
                // ✅ SPECIAL LAYOUT FOR "DONE" TAB - No sections, just list
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
                        <h3>Completed Work ({filteredAssignments.length})</h3>
                        <p>All your finished exams and assignments</p>
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
                // ORIGINAL LAYOUT FOR OTHER TABS
                <div className="all-classes-section">
                  <AssignmentSection title="No due date" assignments={noDueDate} />
                  <AssignmentSection title="This week" assignments={thisWeek} />
                  <AssignmentSection title="Next week" assignments={nextWeek} />
                  <AssignmentSection title="Later" assignments={later} />

                  {filteredAssignments.length === 0 && (
                    <div className="empty-todo">
                      <div className="empty-state-icon">
                        {activeTab === "missing"
                          ? ""
                          : activeTab === "assigned"
                          ? ""
                          : ""}
                      </div>
                      <h3>
                        {activeTab === "missing"
                          ? "No missing work"
                          : activeTab === "assigned"
                          ? "No work assigned"
                          : "No completed work"}
                      </h3>
                      <p>
                        {activeTab === "missing"
                          ? "You're all caught up! No assignments are missing."
                          : activeTab === "assigned"
                          ? "You have no upcoming work right now."
                          : "You haven't completed any work yet."}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}