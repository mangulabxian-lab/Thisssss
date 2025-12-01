// frontend/src/pages/QuizFormPage.jsx - UPDATED WITH OPTIONS & EXAM TYPE FEATURES
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { createQuiz, updateQuiz, getQuizForEdit, deployExam, uploadFileAndParse } from '../lib/api';
import './QuizFormPage.css';

// ✅ ADD COMMENT API FUNCTIONS
const getQuizComments = async (classId, examId) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`/api/exams/${examId}/comments`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
};

const addQuizComment = async (classId, examId, content) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`/api/exams/${examId}/comments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content })
  });
  return response.json();
};

const deleteQuizComment = async (classId, examId, commentId) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`/api/exams/${examId}/comments/${commentId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
};

// ✅ TEACHER QUIZ COMMENT COMPONENT
const TeacherQuizComments = ({ classId, quizId, user }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadComments = async () => {
    if (!classId || !quizId) return;
    
    setLoading(true);
    try {
      const response = await getQuizComments(classId, quizId);
      if (response.success) {
        setComments(response.data || []);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      alert('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !classId || !quizId) return;

    setSubmitting(true);
    try {
      const response = await addQuizComment(classId, quizId, newComment.trim());
      
      if (response.success) {
        const comment = response.data;
        setComments(prev => [comment, ...prev]);
        setNewComment('');
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      alert('Failed to post comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    
    try {
      const response = await deleteQuizComment(classId, quizId, commentId);
      
      if (response.success) {
        setComments(prev => prev.filter(comment => comment._id !== commentId));
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment.');
    }
  };

  useEffect(() => {
    loadComments();
  }, [classId, quizId]);

  // Add real-time updates with polling
  useEffect(() => {
    const interval = setInterval(loadComments, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [classId, quizId]);

  return (
    <div className="quiz-comments-section">
      <div className="comments-header">
        <h3>💬 Exam Discussion</h3>
        <span className="comments-count">{comments.length} comments</span>
      </div>

      <form className="comment-form" onSubmit={handleSubmitComment}>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment or instruction..."
          rows="3"
          maxLength="500"
          className="comment-textarea"
          disabled={submitting}
        />
        <div className="comment-actions">
          <span className="char-count">{newComment.length}/500</span>
          <button 
            type="submit" 
            className="submit-comment-btn"
            disabled={!newComment.trim() || submitting}
          >
            {submitting ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </form>

      <div className="comments-list">
        {loading ? (
          <div className="comments-loading">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="no-comments">
            <p>No comments yet</p>
            <small>Start the discussion</small>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment._id} className={`comment-item ${comment.role}`}>
              <div className="comment-header">
                <div className="comment-author">
                  <span className="author-name">{comment.author?.name}</span>
                  <span className={`author-role ${comment.role}`}>
                    {comment.role === 'teacher' ? '👨‍🏫 Teacher' : '👨‍🎓 Student'}
                  </span>
                </div>
                <div className="comment-meta">
                  <span className="comment-time">
                    {new Date(comment.createdAt).toLocaleTimeString()}
                  </span>
                  {(user.role === 'teacher' || comment.author?._id === user._id) && (
                    <button 
                      className="delete-comment-btn"
                      onClick={() => handleDeleteComment(comment._id)}
                      title="Delete comment"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
              <div className="comment-content">
                {comment.content}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const QuizFormPage = () => {
  const { classId, examId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const existingExamFromState = location.state?.exam;
  
  // ===== NEW OPTIONS & EXAM TYPE STATES =====
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [examType, setExamType] = useState('asynchronous'); // 'asynchronous' or 'live-class'
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [examTimer, setExamTimer] = useState({
    hours: 1,
    minutes: 0,
    seconds: 0
  });

  // ===== ASSIGN / SCHEDULE STATES =====
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("23:59");

  const [quiz, setQuiz] = useState({
    title: 'Untitled form',
    description: 'Form description',
    questions: [],
    isQuiz: true,
    totalPoints: 0
  });
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [user, setUser] = useState({ role: 'teacher' }); // Default to teacher for this context

  // Debug effect to check classId
  useEffect(() => {
    console.log("🔍 QuizFormPage Debug Info:");
    console.log("📍 classId from URL:", classId);
    console.log("📍 examId from URL:", examId);
    console.log("📍 location.state:", location.state);
    console.log("📍 existingExamFromState:", existingExamFromState);
  }, [classId, examId, location.state]);

  useEffect(() => {
    if (examId || existingExamFromState) {
      loadExistingQuiz();
    }
  }, [examId, existingExamFromState]);

  useEffect(() => {
    const total = quiz.questions.reduce((sum, question) => sum + (question.points || 1), 0);
    setQuiz(prev => ({ ...prev, totalPoints: total }));
  }, [quiz.questions]);

  const loadExistingQuiz = async () => {
    try {
      setLoading(true);
      if (existingExamFromState) {
        setQuiz(existingExamFromState);
        setEditing(true);
      } else if (examId) {
        const response = await getQuizForEdit(examId);
        if (response.success) {
          setQuiz(response.data);
          setEditing(true);
        }
      }
    } catch (error) {
      console.error('Failed to load quiz:', error);
      alert('Failed to load quiz: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // ===== OPTIONS & EXAM TYPE HANDLERS =====
  const handleOptionSelect = (option) => {
    setShowOptionsMenu(false);
    
    if (option === 'asynchronous') {
      setExamType('asynchronous');
      setShowTimerModal(true);
    } else if (option === 'live-class') {
      setExamType('live-class');
      setExamTimer({ hours: 0, minutes: 0, seconds: 0 }); // No timer for live class
      alert('🎥 Live Class selected! Students will join in real-time without time limits.');
    }
  };

  const handleTimerChange = (field, value) => {
    const numValue = parseInt(value) || 0;
    
    let limitedValue = numValue;
    if (field === 'hours') limitedValue = Math.min(23, Math.max(0, numValue));
    if (field === 'minutes') limitedValue = Math.min(59, Math.max(0, numValue));
    if (field === 'seconds') limitedValue = Math.min(59, Math.max(0, numValue));
    
    setExamTimer(prev => ({
      ...prev,
      [field]: limitedValue
    }));
  };

  const applyTimerSettings = () => {
    const totalSeconds = (examTimer.hours * 3600) + (examTimer.minutes * 60) + examTimer.seconds;
    
    if (totalSeconds <= 0 && examType === 'asynchronous') {
      alert("Please set a valid timer for asynchronous exams.");
      return;
    }

    console.log("⏰ Timer set for exam:", {
      type: examType,
      hours: examTimer.hours,
      minutes: examTimer.minutes,
      seconds: examTimer.seconds,
      totalSeconds: totalSeconds
    });

    setShowTimerModal(false);
    
    if (examType === 'asynchronous') {
      alert(`✅ Asynchronous exam configured with timer: ${formatTime(totalSeconds)}`);
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // ✅ UPDATE saveQuizToBackend function to include exam type and timer
  const saveQuizToBackend = async (extraFields = {}) => {
    // Validate classId exists
    if (!classId) {
      console.error("❌ Class ID is missing:", classId);
      throw new Error("Error: Class information is missing. Please go back and try again.");
    }

    const questionsForBackend = quiz.questions.map(({ id, ...question }) => question);
    
    // Calculate total seconds for timer
    const timeLimitSeconds = examType === 'asynchronous' 
      ? (examTimer.hours * 3600) + (examTimer.minutes * 60) + examTimer.seconds
      : 0; // No timer for live class

    let response;
    let savedExamId;

    if (editing) {
      const examIdToUpdate = examId || quiz._id;
      console.log("📝 Updating existing quiz:", examIdToUpdate);

      response = await updateQuiz(examIdToUpdate, {
        title: quiz.title,
        description: quiz.description,
        questions: questionsForBackend,
        totalPoints: quiz.totalPoints,
        examType: examType,
        timeLimit: Math.ceil(timeLimitSeconds / 60), // Convert to minutes for backend
        isLiveClass: examType === 'live-class',
        ...extraFields
      });
      savedExamId = examIdToUpdate;
    } else {
      console.log("📝 Creating new quiz for class:", classId);

      response = await createQuiz(classId, {
        title: quiz.title,
        description: quiz.description,
        questions: questionsForBackend,
        isQuiz: true,
        totalPoints: quiz.totalPoints,
        examType: examType,
        timeLimit: Math.ceil(timeLimitSeconds / 60), // Convert to minutes for backend
        isLiveClass: examType === 'live-class',
        ...extraFields
      });
      savedExamId = response.data._id;
    }

    if (!response.success) {
      throw new Error(response.message || "Failed to save quiz");
    }

    return { savedExamId, response };
  };

  // ✅ Schedule assignment (real backend integration)
  const handleScheduleAssignment = async () => {
    if (!scheduledDate || !scheduledTime) {
      alert("Please select a complete date and time.");
      return;
    }

    try {
      setLoading(true);

      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      console.log("📅 Scheduling quiz on:", scheduledAt);

      await saveQuizToBackend({
        status: "scheduled",
        scheduledAt,
        isDeployed: false
      });

      alert(`✅ Quiz scheduled on ${new Date(scheduledAt).toLocaleString()}`);

      setShowScheduleModal(false);

      // Go back to dashboard classwork and refresh
      navigate('/dashboard', {
        state: {
          selectedClassId: classId,
          activeTab: 'classwork',
          refresh: true
        },
        replace: true
      });
    } catch (error) {
      console.error("❌ Failed to schedule quiz:", error);
      alert('Failed to schedule quiz: ' + (error.response?.data?.message || error.message || error.toString()));
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    
    if (!validTypes.includes(file.type)) {
      alert('Please upload a PDF or Word document (.pdf, .doc, .docx)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    try {
      setUploadLoading(true);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('classId', classId);

      const response = await uploadFileAndParse(formData);
      
      if (response.success) {
        const { questions, title, description } = response.data;
        
        const newQuestions = questions.map((q, index) => ({
          ...q,
          id: Date.now() + Math.random() + index,
          order: quiz.questions.length + index,
          points: q.points || 1,
          correctAnswer: q.correctAnswer || null,
          correctAnswers: q.correctAnswers || [],
          answerKey: q.answerKey || ''
        }));

        setQuiz(prev => ({
          ...prev,
          title: title || prev.title,
          description: description || prev.description,
          questions: [...prev.questions, ...newQuestions]
        }));

        alert(`Successfully imported ${questions.length} questions from ${file.name}`);
      }
    } catch (error) {
      console.error('File upload failed:', error);
      alert('Failed to process file: ' + (error.response?.data?.message || error.message));
    } finally {
      setUploadLoading(false);
      event.target.value = '';
    }
  };

  const addQuestion = () => {
    const newQuestion = {
      id: Date.now() + Math.random(),
      type: 'multiple-choice',
      title: 'Untitled Question',
      required: false,
      points: 1,
      order: quiz.questions.length,
      options: ['Option 1'],
      correctAnswer: null,
      correctAnswers: [],
      answerKey: ''
    };

    setQuiz(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }));
  };

  const updateQuestion = (questionId, updates) => {
    setQuiz(prev => ({
      ...prev,
      questions: prev.questions.map(q =>
        q.id === questionId ? { ...q, ...updates } : q
      )
    }));
  };

  const deleteQuestion = (questionId) => {
    setQuiz(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== questionId)
    }));
  };

  const duplicateQuestion = (questionId) => {
    const questionToDuplicate = quiz.questions.find(q => q.id === questionId);
    if (questionToDuplicate) {
      const duplicatedQuestion = {
        ...questionToDuplicate,
        id: Date.now() + Math.random(),
        title: `${questionToDuplicate.title} (Copy)`
      };
      setQuiz(prev => ({
        ...prev,
        questions: [...prev.questions, duplicatedQuestion]
      }));
    }
  };

  // ✅ Save as draft (status: draft)
  const handleSaveQuiz = async () => {
    try {
      setLoading(true);

      await saveQuizToBackend({
        status: 'draft',
        isDeployed: false
      });

      alert(editing ? 'Draft updated successfully!' : 'Draft saved successfully!');

      navigate('/dashboard', {
        state: { 
          selectedClassId: classId,
          activeTab: 'classwork',
          refresh: true 
        },
        replace: true
      });
    } catch (error) {
      console.error('Failed to save form:', error);
      alert('Failed to save form: ' + (error.response?.data?.message || error.message || error.toString()));
    } finally {
      setLoading(false);
    }
  };

  // ✅ Assign now (status: published + deploy)
  const handleDeployQuiz = async () => {
    try {
      setLoading(true);

      const { savedExamId } = await saveQuizToBackend({
        status: 'published',
        isDeployed: true,
        scheduledAt: null
      });

      console.log("✅ Quiz saved successfully, now deploying:", savedExamId);

      // Deploy the exam (live/proctoring/etc)
      const deployResponse = await deployExam(savedExamId);
      
      if (deployResponse.success) {
        console.log("🚀 Quiz deployed successfully! Navigating to dashboard...");
        
        navigate('/dashboard', {
          state: { 
            selectedClassId: classId,
            activeTab: 'classwork',
            refresh: true,
            showSuccess: true,
            message: 'Quiz deployed successfully! Students can now see it in classwork.'
          },
          replace: true
        });
      } else {
        throw new Error(deployResponse.message || 'Deployment failed');
      }
    } catch (error) {
      console.error("❌ Failed to deploy quiz:", error);
      
      if (error.response?.status === 404) {
        alert("Class not found. Please check if the class still exists.");
      } else if (error.response?.status === 403) {
        alert("You don't have permission to deploy quizzes in this class.");
      } else {
        alert('Failed to deploy quiz: ' + (error.response?.data?.message || error.message || error.toString()));
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading && (examId || existingExamFromState)) {
    return (
      <div className="quiz-form-container">
        <div className="loading">Loading form...</div>
      </div>
    );
  }

  return (
    <div className="quiz-form-container">
      <div className="quiz-form-header">
        <button 
          className="back-btn"
          onClick={() => navigate('/dashboard', { 
            state: { activeTab: 'classwork' },
            replace: true
          })}
        >
          ← Back to Dashboard
        </button>
        <div className="header-actions">
          {/* ===== REPLACED PREVIEW BUTTON WITH OPTIONS DROPDOWN ===== */}
          <div className="options-wrapper">
            <button 
              className="options-btn" 
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
            >
              Options ▾
            </button>

            {showOptionsMenu && (
              <div className="options-dropdown">
                <button onClick={() => handleOptionSelect('asynchronous')}>
                  ⏱️ Asynchronous
                </button>
                <button onClick={() => handleOptionSelect('live-class')}>
                  🎥 Live Class
                </button>
              </div>
            )}
          </div>

          {/* Dropdown toggle button */}
          <div className="assign-wrapper">
            <button 
              className="assign-btn" 
              onClick={() => setShowAssignMenu(!showAssignMenu)}
            >
              Assign ▾
            </button>

            {showAssignMenu && (
              <div className="assign-dropdown">
                <button onClick={() => { handleDeployQuiz(); setShowAssignMenu(false); }}>
                  Assign
                </button>

                <button 
                  onClick={() => { 
                    setShowScheduleModal(true);
                    setShowAssignMenu(false);
                  }}
                >
                  Schedule
                </button>

                <button 
                  onClick={() => { handleSaveQuiz(); setShowAssignMenu(false); }}
                >
                  Save draft
                </button>

                <button 
                  onClick={() => { 
                    navigate('/dashboard', { state: { activeTab: 'classwork' }}); 
                  }}
                >
                  Discard draft
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="quiz-form-content">
        <div className="form-header-section">
          <div className="form-header-content">
            <input
              type="text"
              className="form-title"
              value={quiz.title}
              onChange={(e) => setQuiz(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Untitled form"
            />
            <input
              type="text"
              className="form-description"
              value={quiz.description}
              onChange={(e) => setQuiz(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Form description"
            />
            <div className="total-points-display">
              Total Points: <strong>{quiz.totalPoints}</strong>
            </div>
            {/* Display current exam type */}
            <div className="exam-type-display">
              Exam Type: <strong>{examType === 'asynchronous' ? '⏱️ Asynchronous' : '🎥 Live Class'}</strong>
            </div>
          </div>
        </div>

        {/* File Upload Section */}
        <div className="file-upload-section">
          <div className="upload-card">
            <div className="upload-icon">📄</div>
            <h3>Import Questions from File</h3>
            <p>Upload a PDF or Word document to automatically generate questions</p>
            
            <label className="file-upload-btn">
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                onChange={handleFileUpload}
                disabled={uploadLoading}
                style={{ display: 'none' }}
              />
              {uploadLoading ? 'Processing...' : 'Choose File (PDF/Word)'}
            </label>
            
            <div className="upload-info">
              <small>Supported formats: PDF, DOC, DOCX (Max 10MB)</small>
            </div>
          </div>
        </div>

        {/* ✅ ADDED TEACHER QUIZ COMMENTS SECTION */}
        {(examId || quiz._id) && (
          <div className="teacher-comments-section">
            <TeacherQuizComments 
              classId={classId} 
              quizId={examId || quiz._id} 
              user={user} 
            />
          </div>
        )}

        <div className="questions-list">
          {quiz.questions.map((question, index) => (
            <QuestionEditor
              key={question.id}
              question={question}
              index={index}
              onUpdate={(updates) => updateQuestion(question.id, updates)}
              onDelete={() => deleteQuestion(question.id)}
              onDuplicate={() => duplicateQuestion(question.id)}
            />
          ))}
        </div>

        <div className="add-question-section">
          <button className="add-question-btn" onClick={addQuestion}>
            <span className="add-icon">+</span>
            Add question manually
          </button>
        </div>

        <div className="form-actions">
          <button 
            className="save-btn" 
            onClick={handleSaveQuiz}
            disabled={loading}
          >
            {loading ? 'Saving...' : (editing ? 'Update Draft' : 'Save Draft')}
          </button>
          <button 
            className="deploy-btn large"
            onClick={handleDeployQuiz}
            disabled={loading || quiz.questions.length === 0}
          >
            {loading ? 'Deploying...' : '🚀 Deploy Quiz'}
          </button>
          <button 
            className="cancel-btn"
            onClick={() => navigate('/dashboard', { 
              state: { activeTab: 'classwork' },
              replace: true
            })}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="schedule-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Schedule assignment</h2>
              <button 
                className="close-modal"
                onClick={() => setShowScheduleModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <div className="schedule-field">
                <label>Date</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              
              <div className="schedule-field">
                <label>Time</label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
              
              <div className="schedule-info">
                <p>Students will see this assignment on the scheduled date and time.</p>
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={() => setShowScheduleModal(false)}
              >
                Cancel
              </button>
              <button 
                className="schedule-btn"
                onClick={handleScheduleAssignment}
                disabled={!scheduledDate || !scheduledTime}
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== TIMER SETTINGS MODAL ===== */}
      {showTimerModal && (
        <div className="modal-overlay" onClick={() => setShowTimerModal(false)}>
          <div className="timer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⏱️ Set Exam Timer</h2>
              <button 
                className="close-modal"
                onClick={() => setShowTimerModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <div className="exam-type-info">
                <p><strong>Exam Type:</strong> {examType === 'asynchronous' ? '⏱️ Asynchronous' : '🎥 Live Class'}</p>
                {examType === 'live-class' && (
                  <div className="live-class-note">
                    <small>💡 Live Class: No timer needed. Students join in real-time session.</small>
                  </div>
                )}
              </div>
              
              {examType === 'asynchronous' && (
                <>
                  <div className="timer-inputs">
                    <div className="timer-input-group">
                      <label>Hours</label>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={examTimer.hours}
                        onChange={(e) => handleTimerChange('hours', e.target.value)}
                        className="timer-input"
                      />
                    </div>
                    
                    <div className="timer-input-group">
                      <label>Minutes</label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={examTimer.minutes}
                        onChange={(e) => handleTimerChange('minutes', e.target.value)}
                        className="timer-input"
                      />
                    </div>
                    
                    <div className="timer-input-group">
                      <label>Seconds</label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={examTimer.seconds}
                        onChange={(e) => handleTimerChange('seconds', e.target.value)}
                        className="timer-input"
                      />
                    </div>
                  </div>
                  
                  <div className="timer-preview">
                    <strong>Total Time:</strong> 
                    <span className="preview-time">
                      {formatTime((examTimer.hours * 3600) + (examTimer.minutes * 60) + examTimer.seconds)}
                    </span>
                  </div>
                  
                  <div className="timer-info">
                    <small>⏰ Students will see this countdown timer during the exam</small>
                  </div>
                </>
              )}
            </div>
            
            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={() => setShowTimerModal(false)}
              >
                Cancel
              </button>
              <button 
                className="apply-timer-btn"
                onClick={applyTimerSettings}
                disabled={examType === 'asynchronous' && (examTimer.hours === 0 && examTimer.minutes === 0 && examTimer.seconds === 0)}
              >
                {examType === 'asynchronous' ? '✅ Apply Timer' : '✅ Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// QuestionEditor Component
const QuestionEditor = ({ question, index, onUpdate, onDelete, onDuplicate }) => {
  const handleTitleChange = (e) => {
    onUpdate({ title: e.target.value });
  };

  const handlePointsChange = (e) => {
    const points = Math.max(1, parseInt(e.target.value) || 1);
    onUpdate({ points });
  };

  const addOption = () => {
    const newOptions = [...question.options, `Option ${question.options.length + 1}`];
    onUpdate({ options: newOptions });
  };

  const updateOption = (optionIndex, value) => {
    const newOptions = [...question.options];
    newOptions[optionIndex] = value;
    onUpdate({ options: newOptions });
  };

  const deleteOption = (optionIndex) => {
    if (question.options.length > 1) {
      const newOptions = question.options.filter((_, idx) => idx !== optionIndex);
      onUpdate({ options: newOptions });
    }
  };

  const handleCorrectAnswerChange = (optionIndex) => {
    if (question.type === 'multiple-choice') {
      onUpdate({ correctAnswer: optionIndex });
    } else if (question.type === 'checkboxes') {
      const currentAnswers = question.correctAnswers || [];
      const newAnswers = currentAnswers.includes(optionIndex)
        ? currentAnswers.filter(idx => idx !== optionIndex)
        : [...currentAnswers, optionIndex];
      onUpdate({ correctAnswers: newAnswers });
    }
  };

  const handleAnswerKeyChange = (e) => {
    onUpdate({ answerKey: e.target.value });
  };

  const handleQuestionTypeChange = (newType) => {
    const updates = { type: newType };
    
    // Reset answer keys when type changes
    updates.correctAnswer = null;
    updates.correctAnswers = [];
    updates.answerKey = '';
    
    switch (newType) {
      case 'multiple-choice':
      case 'checkboxes':
        updates.options = ['Option 1'];
        break;
      case 'short-answer':
      case 'paragraph':
        updates.options = [];
        break;
      default:
        updates.options = question.options || ['Option 1'];
    }
    
    onUpdate(updates);
  };

  return (
    <div className="question-editor">
      <div className="question-header">
        <input
          type="text"
          value={question.title}
          onChange={handleTitleChange}
          className="question-title"
          placeholder="Question"
        />
        <div className="question-type-dropdown">
          <select
            value={question.type}
            onChange={(e) => handleQuestionTypeChange(e.target.value)}
            className="question-type-select"
          >
            <option value="multiple-choice">Multiple choice</option>
            <option value="checkboxes">Checkboxes</option>
            <option value="short-answer">Short answer</option>
            <option value="paragraph">Paragraph</option>
          </select>
        </div>
      </div>
      
      {/* Points input */}
      <div className="question-points">
        <label>Points:</label>
        <input
          type="number"
          min="1"
          value={question.points || 1}
          onChange={handlePointsChange}
          className="points-input"
        />
      </div>
      
      <div className="question-content">
        {(question.type === 'multiple-choice' || question.type === 'checkboxes') && (
          <div className="options-container">
            {question.options.map((option, idx) => (
              <div key={idx} className="option-item">
                <span className="option-icon">
                  {question.type === 'multiple-choice' ? '○' : '☐'}
                </span>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(idx, e.target.value)}
                  className="option-input"
                  placeholder={`Option ${idx + 1}`}
                />
                
                {/* Answer key selector */}
                <label className="correct-answer-checkbox">
                  <input
                    type={question.type === 'multiple-choice' ? 'radio' : 'checkbox'}
                    name={`correct-answer-${question.id}`}
                    checked={
                      question.type === 'multiple-choice' 
                        ? question.correctAnswer === idx
                        : (question.correctAnswers || []).includes(idx)
                    }
                    onChange={() => handleCorrectAnswerChange(idx)}
                  />
                  Correct
                </label>

                {question.options.length > 1 && (
                  <button
                    onClick={() => deleteOption(idx)}
                    className="delete-option-btn"
                    type="button"
                    title="Remove option"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button onClick={addOption} className="add-option-btn" type="button">
              Add option
            </button>
          </div>
        )}

        {question.type === 'short-answer' && (
          <div className="short-answer-container">
            <input
              type="text"
              className="short-answer-input"
              placeholder="Short answer text"
              disabled
            />
            {/* Answer key for short answer */}
            <div className="answer-key-section">
              <label>Correct Answer:</label>
              <input
                type="text"
                value={question.answerKey || ''}
                onChange={handleAnswerKeyChange}
                className="answer-key-input"
                placeholder="Enter the correct answer"
              />
            </div>
          </div>
        )}

        {question.type === 'paragraph' && (
          <div className="paragraph-container">
            <textarea
              className="paragraph-input"
              placeholder="Long answer text"
              disabled
              rows={3}
            />
            {/* Answer key for paragraph */}
            <div className="answer-key-section">
              <label>Expected Answer Key:</label>
              <textarea
                value={question.answerKey || ''}
                onChange={handleAnswerKeyChange}
                className="answer-key-textarea"
                placeholder="Enter the expected answer or key points"
                rows={3}
              />
            </div>
          </div>
        )}
      </div>

      <div className="question-footer">
        <div className="question-actions">
          <button 
            className="duplicate-btn"
            onClick={onDuplicate}
            title="Duplicate question"
            type="button"
          >
            📄 Duplicate
          </button>
          <button 
            className="delete-question-btn"
            onClick={onDelete}
            title="Delete question"
            type="button"
          >
            🗑️ Delete
          </button>
        </div>
        <label className="required-toggle">
          <input
            type="checkbox"
            checked={question.required}
            onChange={(e) => onUpdate({ required: e.target.checked })}
          />
          Required
        </label>
      </div>
    </div>
  );
};

export default QuizFormPage;