// ClassDetails.jsx - UPDATED FOR LIVE CLASSES ONLY
import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { FaPlus, FaEdit, FaEye, FaTrash, FaVideo } from "react-icons/fa";
import { getClassDetails, getClassMembers, getClasswork } from "../lib/api";
import PeopleTab from "../components/PeopleTab";
import "./ClassDetails.css";

export default function ClassDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [classInfo, setClassInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [classwork, setClasswork] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("classwork");
  
  // Classwork Create Modal States - Simplified for Live Classes
  const [showCreateLiveClassModal, setShowCreateLiveClassModal] = useState(false);
  const [liveClassTitle, setLiveClassTitle] = useState("");
  const [liveClassDescription, setLiveClassDescription] = useState("");
  const [liveClassSchedule, setLiveClassSchedule] = useState("");
  const [creatingLiveClass, setCreatingLiveClass] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);

  // ✅ FIXED: Function to fetch classwork
  const fetchClasswork = async () => {
    if (!id) {
      console.error("❌ Class ID is undefined, cannot fetch classwork");
      return;
    }
    
    try {
      console.log("📚 Fetching classwork for class:", id);
      const classworkRes = await getClasswork(id);
      const classworkData = classworkRes.data?.data || classworkRes.data || [];
      console.log("✅ Classwork loaded:", classworkData.length, "items");
      setClasswork(classworkData);
    } catch (error) {
      console.log("Classwork endpoint not available yet, using mock data");
      // Fallback to empty array if endpoint fails
      setClasswork([]);
    }
  };

  // ✅ FIXED: Handle navigation state for active tab
  useEffect(() => {
    const handleNavigationState = () => {
      if (location.state?.activeTab === 'classwork') {
        console.log(" Setting active tab from navigation state:", location.state);
        setActiveTab('classwork');
        
        if (location.state.refresh) {
          console.log("🔄 Refreshing classwork data");
          fetchClasswork(); // This function is now defined
        }
        
        if (location.state.showSuccess && location.state.message) {
          alert(location.state.message);
        }
        
        // Clear the state to prevent repeated alerts
        window.history.replaceState({}, document.title);
      }
    };
    
    handleNavigationState();
  }, [location.state]);

  useEffect(() => {
    const fetchClassDetails = async () => {
      try {
        setLoading(true);
        console.log("📋 Fetching class details for:", id);

        // ✅ FIXED: Check if class ID exists before making API calls
        if (!id) {
          console.error("❌ Class ID is undefined!");
          throw new Error("Class ID is missing");
        }

        // Fetch without announcements
        const [classRes, studentRes, classworkRes] = await Promise.all([
          getClassDetails(id),
          getClassMembers(id).catch(err => {
            console.log("Failed to fetch members:", err);
            return { data: [] };
          }),
          getClasswork(id).catch(err => {
            console.log("Classwork endpoint not available:", err);
            return { data: [] };
          })
        ]);

        console.log("✅ Class Data:", classRes);
        console.log("✅ Students:", studentRes.data);
        console.log("✅ Classwork:", classworkRes.data);

        if (classRes.success) {
          setClassInfo(classRes.data);
        } else {
          throw new Error(classRes.message || 'Failed to fetch class details');
        }

        setStudents(studentRes.data || []);
        setClasswork(classworkRes.data || []);

      } catch (err) {
        console.error("❌ Failed to fetch class details:", err);
        alert("Failed to load class details: " + (err.response?.data?.message || err.message));
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchClassDetails();
    } else {
      console.error("❌ No class ID provided in URL");
      setLoading(false);
    }
  }, [id]);

  // Check if user is teacher
  const isTeacher = () => {
    if (!classInfo) return false;
    
    if (classInfo.userRole === "teacher") return true;
    if (classInfo.role === "teacher") return true;
    
    if (classInfo.ownerId) {
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      if (classInfo.ownerId._id === userData.id || classInfo.ownerId === userData.id) {
        return true;
      }
    }
    
    return false;
  };

  // CREATE LIVE CLASS FUNCTION
  const handleCreateLiveClass = async () => {
    if (!liveClassTitle.trim()) {
      alert("Please enter a title for the live class");
      return;
    }

    setCreatingLiveClass(true);
    try {
      const liveClassData = {
        title: liveClassTitle.trim(),
        description: liveClassDescription.trim(),
        type: "live_class", // Always live class
        classId: id,
        scheduledAt: liveClassSchedule || undefined,
        isActive: false // Default to not started
      };

      const response = await fetch('/api/live-classes/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(liveClassData)
      });

      const result = await response.json();
      
      if (result.success) {
        setClasswork(prev => [result.data, ...prev]);
        
        // Reset form
        setLiveClassTitle("");
        setLiveClassDescription("");
        setLiveClassSchedule("");
        setShowCreateLiveClassModal(false);
        
        alert("Live class created successfully!");
      } else {
        alert("Failed to create live class: " + result.message);
      }
    } catch (error) {
      console.error("Failed to create live class:", error);
      alert("Failed to create live class: " + (error.message));
    } finally {
      setCreatingLiveClass(false);
    }
  };

  // DELETE LIVE CLASS FUNCTION
  const handleDeleteLiveClass = async (itemId, itemTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${itemTitle}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingItem(itemId);
    try {
      const response = await fetch(`/api/live-classes/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const result = await response.json();

      if (result.success) {
        setClasswork(prev => prev.filter(item => item._id !== itemId));
        alert("Live class deleted successfully!");
      } else {
        alert("Failed to delete: " + result.message);
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      alert("Failed to delete: " + (error.response?.data?.message || error.message));
    } finally {
      setDeletingItem(null);
    }
  };

  // START LIVE CLASS FUNCTION
  const handleStartLiveClass = async (liveClassId, liveClassTitle) => {
    if (!window.confirm(`Start "${liveClassTitle}"? This will mark it as active for all students.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/live-classes/start/${liveClassId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        setClasswork(prev => prev.map(item => 
          item._id === liveClassId 
            ? { 
                ...item, 
                isActive: true,
                startedAt: new Date().toISOString()
              }
            : item
        ));
        alert("Live class started! Students can now join.");
      } else {
        alert("Failed to start live class: " + result.message);
      }
    } catch (error) {
      console.error("Failed to start live class:", error);
      alert("Failed to start live class: " + (error.response?.data?.message || error.message));
    }
  };

  // END LIVE CLASS FUNCTION
  const handleEndLiveClass = async (liveClassId, liveClassTitle) => {
    if (!window.confirm(`End "${liveClassTitle}"? This will mark it as ended for all students.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/live-classes/end/${liveClassId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        setClasswork(prev => prev.map(item => 
          item._id === liveClassId 
            ? { 
                ...item, 
                isActive: false,
                endedAt: new Date().toISOString()
              }
            : item
        ));
        alert("Live class ended!");
      } else {
        alert("Failed to end live class: " + result.message);
      }
    } catch (error) {
      console.error("Failed to end live class:", error);
      alert("Failed to end live class: " + (error.response?.data?.message || error.message));
    }
  };

  // JOIN LIVE CLASS FUNCTION (for students)
  const handleJoinLiveClass = async (liveClassId, liveClassTitle) => {
    try {
      console.log(" Student joining live class:", liveClassId, liveClassTitle);
      
      // Check if live class is active
      const liveClass = classwork.find(item => item._id === liveClassId);
      if (!liveClass?.isActive) {
        alert("This live class is not active yet. Please wait for the teacher to start it.");
        return;
      }
      
      // Navigate to live class room
      navigate(`/live-class/${liveClassId}`);
    } catch (error) {
      console.error("Failed to join live class:", error);
      alert("Failed to join live class: " + (error.response?.data?.message || error.message));
    }
  };

  // Reset live class form
  const resetLiveClassForm = () => {
    setLiveClassTitle("");
    setLiveClassDescription("");
    setLiveClassSchedule("");
    setShowCreateLiveClassModal(false);
  };

  // Get formatted time
  const getFormattedTime = (dateString) => {
    if (!dateString) return "Not scheduled";
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  // Format scheduled time
  const formatScheduledTime = (dateString) => {
    if (!dateString) return "No schedule set";
    
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) return (
    <div className="class-details-page">
      <div className="loading">Loading class details...</div>
    </div>
  );

  if (!classInfo) return (
    <div className="class-details-page">
      <div className="error-message">
        <h2>Class Not Found</h2>
        <p>The class you're looking for doesn't exist or you don't have access.</p>
        <button onClick={() => navigate("/dashboard")} className="back-btn">
          Back to Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div className="class-details-page">
      <header className="class-header">
        <button className="back-btn" onClick={() => navigate("/dashboard")}>
          Back to Dashboard
        </button>
        <div className="class-info">
          <h1>{classInfo.name}</h1>
          <p className="class-code">Class Code: <strong>{classInfo.code}</strong></p>
          {classInfo.description && (
            <p className="class-description">{classInfo.description}</p>
          )}
          <p className="class-role">Your role: <strong>{isTeacher() ? 'Teacher' : 'Student'}</strong></p>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="tabs-navigation">
        <button 
          className={`tab-btn ${activeTab === "classwork" ? "active" : ""}`}
          onClick={() => setActiveTab("classwork")}
        >
          Live Classes
        </button>
        <button 
          className={`tab-btn ${activeTab === "students" ? "active" : ""}`}
          onClick={() => setActiveTab("students")}
        >
          People ({students.length})
        </button>
      </div>

      {/* LIVE CLASSES TAB */}
      {activeTab === "classwork" && (
        <section className="section">
          <div className="section-header">
            <h2>Live Classes</h2>
            {isTeacher() && (
              <div className="create-actions">
                <button 
                  className="create-btn"
                  onClick={() => setShowCreateLiveClassModal(true)}
                >
                  <FaPlus className="btn-icon" />
                  Schedule Live Class
                </button>
              </div>
            )}
          </div>

          {/* MAIN LIVE CLASSES AREA */}
          <div className="classwork-content">
            {classwork.length > 0 ? (
              <div className="classwork-grid">
                {classwork.map((item) => {
                  // Show live class status
                  const status = item.isActive ? 'live' : 
                                item.endedAt ? 'ended' : 'scheduled';

                  return (
                    <div className="classwork-card" key={item._id}>
                      <div className="classwork-header">
                        <span className="classwork-icon">
                          🎥 {/* Changed from quiz icon */}
                        </span>
                        <div>
                          <h3>{item.title}</h3>
                          <p className="classwork-type">Live Class</p> {/* Always Live Class */}
                        </div>
                      </div>
                      
                      {item.description && (
                        <p className="classwork-description">{item.description}</p>
                      )}
                      
                      {/* Show live class status */}
                      <div className="classwork-meta">
                        {item.isActive && (
                          <span className="status live">🔴 LIVE NOW</span>
                        )}
                        {item.endedAt && (
                          <span className="status ended">🛑 Ended</span>
                        )}
                        {!item.isActive && !item.endedAt && (
                          <span className="status scheduled">⏸️ Not Started</span>
                        )}
                        
                        {item.scheduledAt && (
                          <span className="schedule-time">
                            📅 {formatScheduledTime(item.scheduledAt)}
                          </span>
                        )}
                        
                        {item.startedAt && (
                          <span>Started: {getFormattedTime(item.startedAt)}</span>
                        )}
                        
                        {item.endedAt && (
                          <span>Ended: {getFormattedTime(item.endedAt)}</span>
                        )}
                      </div>
                      
                      <div className="classwork-actions">
                        {isTeacher() ? (
                          <>
                            <button 
                              className="btn-primary btn-small"
                              onClick={() => {/* Edit live class logic */}}
                            >
                              <FaEdit /> Edit
                            </button>
                            
                            {!item.isActive && !item.endedAt && (
                              <button 
                                className="start-live-btn btn-small"
                                onClick={() => handleStartLiveClass(item._id, item.title)}
                              >
                                <FaVideo /> Start Live
                              </button>
                            )}
                            
                            {item.isActive && (
                              <button 
                                className="end-live-btn btn-small"
                                onClick={() => handleEndLiveClass(item._id, item.title)}
                              >
                                ⏹️ End Live
                              </button>
                            )}
                            
                            <button 
                              className="delete-btn btn-small"
                              onClick={() => handleDeleteLiveClass(item._id, item.title)}
                              disabled={deletingItem === item._id}
                            >
                              <FaTrash /> 
                              {deletingItem === item._id ? 'Deleting...' : 'Delete'}
                            </button>
                          </>
                        ) : (
                          <div className="student-live-class-section">
                            <button 
                              className={`join-live-btn ${item.isActive ? 'active' : 'disabled'}`}
                              onClick={() => handleJoinLiveClass(item._id, item.title)}
                              disabled={!item.isActive}
                            >
                              {item.isActive ? '🔴 Join Live Class' : 'Join Live Class'}
                            </button>
                            {!item.isActive && (
                              <div className="live-class-info">
                                <small>
                                  {item.endedAt 
                                    ? "This live class has ended" 
                                    : "Live class not started yet"}
                                </small>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="classwork-footer">
                        <span>Hosted by {item.createdBy?.name || 'Teacher'}</span>
                        <span>Created {getFormattedTime(item.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="classwork-empty-state">
                <div className="empty-illustration">
                  <svg width="200" height="150" viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="40" y="50" width="120" height="80" rx="8" fill="#F8F9FA" stroke="#DADCE0" strokeWidth="2"/>
                    <circle cx="100" cy="70" r="20" fill="#E8F0FE"/>
                    <path d="M90 70L94 74L110 64" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <rect x="50" y="100" width="100" height="8" rx="4" fill="#F1F3F4"/>
                    <rect x="50" y="115" width="60" height="8" rx="4" fill="#F1F3F4"/>
                  </svg>
                </div>
                <div className="empty-content">
                  
                  {isTeacher() && (
                    <div className="empty-actions">
                      <button 
                        className="btn-primary"
                        onClick={() => setShowCreateLiveClassModal(true)}
                      >
                        <FaVideo style={{marginRight: '8px'}} />
                        Schedule First Live Class
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* PEOPLE TAB */}
      {activeTab === "students" && (
        <section className="section">
          <div className="section-header">
            <h2>People</h2>
          </div>
          <PeopleTab classId={id} />
        </section>
      )}

      {/* CREATE LIVE CLASS MODAL */}
      {showCreateLiveClassModal && (
        <div className="modal-overlay">
          <div className="modal-content large-modal">
            <div className="modal-header">
              <h2>Schedule Live Class</h2>
              <button className="close-btn" onClick={resetLiveClassForm}>×</button>
            </div>
            
            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                placeholder="Enter live class title"
                value={liveClassTitle}
                onChange={(e) => setLiveClassTitle(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Description (optional)</label>
              <textarea
                placeholder="What will this live class cover?"
                value={liveClassDescription}
                onChange={(e) => setLiveClassDescription(e.target.value)}
                rows="3"
              />
            </div>

            <div className="form-group">
              <label>Schedule Time (optional)</label>
              <input
                type="datetime-local"
                value={liveClassSchedule}
                onChange={(e) => setLiveClassSchedule(e.target.value)}
              />
              <small>Leave empty to schedule for later</small>
            </div>

            <div className="modal-actions">
              <button 
                type="button" 
                onClick={resetLiveClassForm}
                disabled={creatingLiveClass}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleCreateLiveClass}
                className="btn-primary"
                disabled={!liveClassTitle.trim() || creatingLiveClass}
              >
                {creatingLiveClass ? "Scheduling..." : "Schedule Live Class"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}