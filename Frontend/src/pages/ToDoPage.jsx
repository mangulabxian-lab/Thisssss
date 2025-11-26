// src/pages/ToDoPage.jsx 
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
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

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

          const classAssignments = classExams.map((exam) => ({
            _id: exam._id,
            title: exam.title || "Untitled Exam",
            classId: classData._id,
            className: classData.name,
            teacherName: classData.ownerId?.name || "Teacher",
            postedDate: exam.createdAt
              ? new Date(exam.createdAt)
              : new Date(),
            dueDate: exam.scheduledAt ? new Date(exam.scheduledAt) : null,
            status: exam.status || "assigned",
            isDeployed: exam.isDeployed,
            type: "exam",
          }));

          allAssignments.push(...classAssignments);
        } catch (error) {
          console.error(
            `Failed to fetch exams for class ${classData.name}:`,
            error
          );
        }
      }

      setAssignments(allAssignments);
    } catch (error) {
      console.error("Failed to fetch student assignments:", error);

      setAssignments([
        {
          _id: "1",
          title: "Untitled Assignment",
          classId: "demo-1",
          className: "SYSARCH",
          teacherName: "PERSON",
          postedDate: new Date("2025-11-17"),
          dueDate: null,
          status: "assigned",
          isDeployed: true,
          type: "assignment",
        },
      ]);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    window.location.href = "/login";
  };

  const assignmentsByTab = assignments.filter((assignment) => {
    if (activeTab === "assigned") return assignment.status === "assigned";
    if (activeTab === "missing") return assignment.status === "missing";
    return assignment.status === "done";
  });

  const filteredAssignments =
    selectedClassFilter === "all"
      ? assignmentsByTab
      : assignmentsByTab.filter(
          (assignment) => assignment.classId === selectedClassFilter
        );

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

  const { noDueDate, thisWeek, nextWeek, later } =
    categorizeAssignments(filteredAssignments);

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

  const AssignmentCard = ({ assignment, index }) => {
    return (
      <div className="assignment-card">
        <div className="assignment-number">{index + 1}</div>
        <div className="assignment-content">
          <div className="assignment-header">
            <h4 className="assignment-title">{assignment.title}</h4>
            <div className="assignment-meta">
              <span className="teacher-name">{assignment.className}</span>
              <span className="posted-date">
                {formatPostedDate(assignment.postedDate)}
              </span>
            </div>
          </div>
          <div className="assignment-class">{assignment.teacherName}</div>
        </div>
        <div className="assignment-actions">
          <button
            className={`action-btn ${
              assignment.status === "done" ? "done" : "start"
            }`}
            onClick={() => {
              if (assignment.isDeployed && assignment.type === "exam") {
                window.open(`/exam/form/${assignment._id}`, "_blank");
              } else {
                alert("This assignment is not yet available.");
              }
            }}
          >
            {assignment.status === "done" ? "Review" : "Start"}
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

            {/* 🔵 NEW: CLASS DROPDOWN ABOVE TABS */}
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
                Assigned
              </button>
              <button
                className={`tab ${activeTab === "missing" ? "active" : ""}`}
                onClick={() => setActiveTab("missing")}
              >
                Missing
              </button>
              <button
                className={`tab ${activeTab === "done" ? "active" : ""}`}
                onClick={() => setActiveTab("done")}
              >
                Done
              </button>
            </div>

            <div className="todo-content">
              <div className="all-classes-section">
                <AssignmentSection title="No due date" assignments={noDueDate} />
                <AssignmentSection title="This week" assignments={thisWeek} />
                <AssignmentSection title="Next week" assignments={nextWeek} />
                <AssignmentSection title="Later" assignments={later} />

                {filteredAssignments.length === 0 && (
                  <div className="empty-todo">
                    <div className="empty-state-icon">
                      {activeTab === "missing"
                        ? "📝"
                        : activeTab === "assigned"
                        ? "📚"
                        : "✅"}
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
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}