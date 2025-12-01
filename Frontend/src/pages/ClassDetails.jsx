// ClassDetails.jsx - COMPLETELY FIXED VERSION
import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { FaPlus, FaEdit, FaEye, FaRocket, FaTrash } from "react-icons/fa";
import { getClassDetails, getClassMembers, getClasswork, getQuizForStudent } from "../lib/api";
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
  
  // Classwork Create Modal States
  const [showCreateClassworkModal, setShowCreateClassworkModal] = useState(false);
  const [classworkType, setClassworkType] = useState("assignment");
  const [classworkTitle, setClassworkTitle] = useState("");
  const [classworkDescription, setClassworkDescription] = useState("");
  const [classworkPoints, setClassworkPoints] = useState("");
  const [classworkDueDate, setClassworkDueDate] = useState("");
  const [creatingClasswork, setCreatingClasswork] = useState(false);
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
        console.log("🎯 Setting active tab from navigation state:", location.state);
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

  // CREATE CLASSWORK FUNCTION
  const handleCreateClasswork = async () => {
    if (!classworkTitle.trim()) {
      alert("Please enter a title");
      return;
    }

    setCreatingClasswork(true);
    try {
      const classworkData = {
        title: classworkTitle.trim(),
        description: classworkDescription.trim(),
        type: classworkType,
        classId: id,
        points: classworkPoints ? parseInt(classworkPoints) : undefined,
        dueDate: classworkDueDate || undefined
      };

      const response = await fetch('/api/classwork/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(classworkData)
      });

      const result = await response.json();
      
      if (result.success) {
        setClasswork(prev => [result.data, ...prev]);
        
        // Reset form
        setClassworkTitle("");
        setClassworkDescription("");
        setClassworkPoints("");
        setClassworkDueDate("");
        setClassworkType("assignment");
        setShowCreateClassworkModal(false);
        
        alert("Classwork created successfully!");
      } else {
        alert("Failed to create classwork: " + result.message);
      }
    } catch (error) {
      console.error("Failed to create classwork:", error);
      alert("Failed to create classwork: " + (error.message));
    } finally {
      setCreatingClasswork(false);
    }
  };

  // DELETE CLASSWORK FUNCTION
  const handleDeleteClasswork = async (itemId, itemTitle, itemType) => {
    if (!window.confirm(`Are you sure you want to delete "${itemTitle}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingItem(itemId);
    try {
      let response;
      
      if (itemType === 'quiz') {
        response = await fetch(`/api/exams/${itemId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        response = await response.json();
      } else {
        response = await fetch(`/api/classwork/${itemId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        response = await response.json();
      }

      if (response.success) {
        setClasswork(prev => prev.filter(item => item._id !== itemId));
        alert(`${itemType === 'quiz' ? 'Quiz' : 'Assignment'} deleted successfully!`);
      } else {
        alert("Failed to delete: " + response.message);
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      alert("Failed to delete: " + (error.response?.data?.message || error.message));
    } finally {
      setDeletingItem(null);
    }
  };

  // DEPLOY EXAM FUNCTION
  const handleDeployExam = async (examId, examTitle) => {
    if (!window.confirm(`Are you sure you want to publish "${examTitle}"? Students will be able to see and take it.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/exams/deploy/${examId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        setClasswork(prev => prev.map(item => 
          item._id === examId 
            ? { 
                ...item, 
                isPublished: true,
                isDeployed: true 
              }
            : item
        ));
        alert("Quiz published successfully! Students can now see it.");
      } else {
        alert("Failed to publish quiz: " + result.message);
      }
    } catch (error) {
      console.error("Failed to publish quiz:", error);
      alert("Failed to publish quiz: " + (error.response?.data?.message || error.message));
    }
  };

  // STUDENT QUIZ ACCESS FUNCTION
  const handleStartQuiz = async (examId, examTitle) => {
    try {
      console.log("🎯 Student starting quiz:", examId, examTitle);
      
      const response = await getQuizForStudent(examId);
      
      if (response.success) {
        navigate(`/student-quiz/${examId}`);
      } else {
        alert('Quiz not available: ' + response.message);
      }
    } catch (error) {
      console.error("Failed to start quiz:", error);
      alert("Failed to start quiz: " + (error.response?.data?.message || error.message));
    }
  };

  // Check if quiz is available for students
  const isQuizAvailableForStudent = (item) => {
    if (item.isPublished) return true;
    if (item.isDeployed) return true;
    if (item.isQuiz) return true;
    if (item.type === 'quiz') return true;
    
    return false;
  };

  // Reset classwork form
  const resetClassworkForm = () => {
    setClassworkTitle("");
    setClassworkDescription("");
    setClassworkPoints("");
    setClassworkDueDate("");
    setClassworkType("assignment");
    setShowCreateClassworkModal(false);
  };

  // Get icon for classwork type
  const getClassworkIcon = (type) => {
    const icons = {
      assignment: "📝",
      quiz: "❓",
      question: "💬",
      material: "📎",
      topic: "📂"
    };
    return icons[type] || "📄";
  };

  // Get formatted time
  const getFormattedTime = (dateString) => {
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
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div className="class-details-page">
      <header className="class-header">
        <button className="back-btn" onClick={() => navigate("/dashboard")}>
          ⬅ Back to Dashboard
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

      {/* Tab Navigation - WITHOUT STREAM TAB */}
      <div className="tabs-navigation">
        <button 
          className={`tab-btn ${activeTab === "classwork" ? "active" : ""}`}
          onClick={() => setActiveTab("classwork")}
        >
          Classwork
        </button>
        <button 
          className={`tab-btn ${activeTab === "students" ? "active" : ""}`}
          onClick={() => setActiveTab("students")}
        >
          People ({students.length})
        </button>
      </div>

      {/* CLASSWORK TAB */}
      {activeTab === "classwork" && (
        <section className="section">
          <div className="section-header">
            <h2>Classwork</h2>
            {isTeacher() && (
              <div className="create-actions">
                <button 
                  className="create-btn"
                  onClick={() => setShowCreateClassworkModal(true)}
                >
                  <FaPlus className="btn-icon" />
                  Create
                </button>
                <button 
                  className="create-btn secondary"
                  onClick={() => navigate(`/class/${id}/quiz/new`)}
                >
                  <FaPlus className="btn-icon" />
                  New Quiz
                </button>
              </div>
            )}
          </div>

          {/* MAIN CLASSWORK AREA */}
          <div className="classwork-content">
            {classwork.length > 0 ? (
              <div className="classwork-grid">
                {classwork.map((item) => {
                  const isQuizAvailable = isQuizAvailableForStudent(item);

                  return (
                    <div className="classwork-card" key={item._id}>
                      <div className="classwork-header">
                        <span className="classwork-icon">
                          {getClassworkIcon(item.type)}
                        </span>
                        <div>
                          <h3>{item.title}</h3>
                          <p className="classwork-type">{item.type}</p>
                        </div>
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
                        {item.questions && (
                          <span>Questions: {item.questions.length || 0}</span>
                        )}
                        {(item.isPublished || item.isDeployed) && (
                          <span className="status published">Published</span>
                        )}
                        {!item.isPublished && !item.isDeployed && item.type === 'quiz' && (
                          <span className="status draft">Draft</span>
                        )}
                      </div>
                      <div className="classwork-actions">
                        {isTeacher() ? (
                          <>
                            {item.type === 'quiz' ? (
                              <>
                                <button 
                                  className="btn-primary btn-small"
                                  onClick={() => navigate(`/class/${id}/quiz/${item._id}/edit`)}
                                >
                                  <FaEdit /> Edit
                                </button>
                                <button 
                                  className="btn-secondary btn-small"
                                  onClick={() => navigate(`/exam/form/${item._id}`)}
                                >
                                  <FaEye /> Preview
                                </button>
                                {!item.isPublished && !item.isDeployed && (
                                  <button 
                                    className="deploy-btn btn-small"
                                    onClick={() => handleDeployExam(item._id, item.title)}
                                  >
                                    <FaRocket /> Publish
                                  </button>
                                )}
                                <button 
                                  className="delete-btn btn-small"
                                  onClick={() => handleDeleteClasswork(item._id, item.title, 'quiz')}
                                  disabled={deletingItem === item._id}
                                >
                                  <FaTrash /> 
                                  {deletingItem === item._id ? 'Deleting...' : 'Delete'}
                                </button>
                              </>
                            ) : (
                              <>
                                <button 
                                  className="btn-primary btn-small"
                                  onClick={() => {/* Edit assignment logic */}}
                                >
                                  <FaEdit /> Edit
                                </button>
                                <button 
                                  className="delete-btn btn-small"
                                  onClick={() => handleDeleteClasswork(item._id, item.title, 'assignment')}
                                  disabled={deletingItem === item._id}
                                >
                                  <FaTrash /> 
                                  {deletingItem === item._id ? 'Deleting...' : 'Delete'}
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          item.type === 'quiz' && (
                            <div className="student-quiz-section">
                              <button 
                                className="start-quiz-btn"
                                onClick={() => handleStartQuiz(item._id, item.title)}
                                title={isQuizAvailable ? "Start this quiz" : "Quiz not available yet"}
                              >
                                🚀 Start Quiz
                              </button>
                              {!isQuizAvailable && (
                                <div className="quiz-info">
                                  <small>This quiz is not available yet</small>
                                </div>
                              )}
                            </div>
                          )
                        )}
                      </div>
                      <div className="classwork-footer">
                        <span>Created by {item.createdBy?.name || 'Teacher'}</span>
                        <span>{getFormattedTime(item.createdAt)}</span>
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
                    <rect x="50" y="60" width="100" height="12" rx="6" fill="#E8F0FE"/>
                    <rect x="50" y="80" width="80" height="8" rx="4" fill="#F1F3F4"/>
                    <rect x="50" y="95" width="60" height="8" rx="4" fill="#F1F3F4"/>
                    <circle cx="160" cy="110" r="15" fill="#1A73E8" fillOpacity="0.1" stroke="#1A73E8" strokeWidth="2"/>
                    <path d="M155 110L158 113L165 106" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="empty-content">
                  <h3 className="empty-title">No classwork yet</h3>
                  <p className="empty-description">
                    {isTeacher() 
                      ? "Create assignments, quizzes, or materials to get started."
                      : "Your teacher hasn't created any classwork yet."
                    }
                  </p>
                  {isTeacher() && (
                    <div className="empty-actions">
                      <button 
                        className="btn-primary"
                        onClick={() => setShowCreateClassworkModal(true)}
                      >
                        Create Your First Assignment
                      </button>
                      <button 
                        className="btn-secondary"
                        onClick={() => navigate(`/class/${id}/quiz/new`)}
                      >
                        Create a Quiz
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

      {/* CREATE CLASSWORK MODAL */}
      {showCreateClassworkModal && (
        <div className="modal-overlay">
          <div className="modal-content large-modal">
            <div className="modal-header">
              <h2>Create Classwork</h2>
              <button className="close-btn" onClick={resetClassworkForm}>×</button>
            </div>
            
            {/* Type Selection */}
            <div className="type-selection">
              <label>Type</label>
              <div className="type-grid">
                <button 
                  type="button"
                  className={`type-btn ${classworkType === 'assignment' ? 'active' : ''}`}
                  onClick={() => setClassworkType('assignment')}
                >
                  <span>📝</span>
                  Assignment
                </button>
                <button 
                  type="button"
                  className={`type-btn ${classworkType === 'quiz' ? 'active' : ''}`}
                  onClick={() => setClassworkType('quiz')}
                >
                  <span>❓</span>
                  Quiz
                </button>
                <button 
                  type="button"
                  className={`type-btn ${classworkType === 'material' ? 'active' : ''}`}
                  onClick={() => setClassworkType('material')}
                >
                  <span>📎</span>
                  Material
                </button>
                <button 
                  type="button"
                  className={`type-btn ${classworkType === 'question' ? 'active' : ''}`}
                  onClick={() => setClassworkType('question')}
                >
                  <span>💬</span>
                  Question
                </button>
              </div>
            </div>

            {/* Form Fields */}
            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                placeholder="Enter title"
                value={classworkTitle}
                onChange={(e) => setClassworkTitle(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Description (optional)</label>
              <textarea
                placeholder="Enter description"
                value={classworkDescription}
                onChange={(e) => setClassworkDescription(e.target.value)}
                rows="3"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Points (optional)</label>
                <input
                  type="number"
                  placeholder="Points"
                  value={classworkPoints}
                  onChange={(e) => setClassworkPoints(e.target.value)}
                />
              </div>
              
              <div className="form-group">
                <label>Due Date (optional)</label>
                <input
                  type="datetime-local"
                  value={classworkDueDate}
                  onChange={(e) => setClassworkDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button 
                type="button" 
                onClick={resetClassworkForm}
                disabled={creatingClasswork}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleCreateClasswork}
                className="btn-primary"
                disabled={!classworkTitle.trim() || creatingClasswork}
              >
                {creatingClasswork ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}