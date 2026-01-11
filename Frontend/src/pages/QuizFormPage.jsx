// frontend/src/pages/QuizFormPage.jsx - UPDATED WITH IMPROVED DUPLICATE PREVENTION
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { createQuiz, updateQuiz, getQuizForEdit, deployExam, uploadFileAndParse } from '../lib/api';
import './QuizFormPage.css';

const QuizFormPage = () => {
  const { classId, examId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const existingExamFromState = location.state?.exam;
  
  // ===== EXISTING STATES =====
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [examType, setExamType] = useState('live-class'); // Default to live-class

  // ===== EXPIRATION DATE STATES =====
  const [showExpirationModal, setShowExpirationModal] = useState(false);
  const [expirationDate, setExpirationDate] = useState('');
  const [expirationTime, setExpirationTime] = useState('23:59');
  const [hasExpiration, setHasExpiration] = useState(false);

  // ===== ASSIGN / SCHEDULE STATES =====
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("23:59");

  // ===== TIMER STATES =====
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [timerSettings, setTimerSettings] = useState({
    hasTimer: false,
    hours: 0,
    minutes: 30,
    seconds: 0,
    autoDisconnect: true
  });

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
  const [user, setUser] = useState({ role: 'teacher' });

  // Debug effect
  useEffect(() => {
    console.log("🔍 QuizFormPage Debug Info:");
    console.log("📍 classId from URL:", classId);
    console.log("📍 examId from URL:", examId);
  }, [classId, examId]);

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
        
        // Load expiration settings if they exist
        if (existingExamFromState.expiration) {
          const expDate = new Date(existingExamFromState.expiration);
          setExpirationDate(expDate.toISOString().split('T')[0]);
          setExpirationTime(expDate.toTimeString().slice(0, 5));
          setHasExpiration(true);
        }
        
        // Load timer settings if they exist
        if (existingExamFromState.liveClassSettings) {
          const timerSettings = existingExamFromState.liveClassSettings;
          if (timerSettings.hasTimer && timerSettings.timerDuration) {
            const totalSeconds = timerSettings.timerDuration * 60; // Convert minutes to seconds
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            
            setTimerSettings({
              hasTimer: true,
              hours: hours,
              minutes: minutes,
              seconds: seconds,
              autoDisconnect: timerSettings.autoDisconnect !== false
            });
          }
        }
        
      } else if (examId) {
        const response = await getQuizForEdit(examId);
        if (response.success) {
          setQuiz(response.data);
          setEditing(true);
          
          // Load expiration settings if they exist
          if (response.data.expiration) {
            const expDate = new Date(response.data.expiration);
            setExpirationDate(expDate.toISOString().split('T')[0]);
            setExpirationTime(expDate.toTimeString().slice(0, 5));
            setHasExpiration(true);
          }
          
          // Load timer settings if they exist
          if (response.data.liveClassSettings) {
            const timerSettings = response.data.liveClassSettings;
            if (timerSettings.hasTimer && timerSettings.timerDuration) {
              const totalSeconds = timerSettings.timerDuration * 60; // Convert minutes to seconds
              const hours = Math.floor(totalSeconds / 3600);
              const minutes = Math.floor((totalSeconds % 3600) / 60);
              const seconds = totalSeconds % 60;
              
              setTimerSettings({
                hasTimer: true,
                hours: hours,
                minutes: minutes,
                seconds: seconds,
                autoDisconnect: timerSettings.autoDisconnect !== false
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load quiz:', error);
      alert('Failed to load quiz: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      localStorage.removeItem('quizCreationInProgress');
    };
  }, []);

  // ===== TIMER HELPER FUNCTION =====
  const calculateTotalSeconds = () => {
    return (timerSettings.hours * 3600) + 
           (timerSettings.minutes * 60) + 
           timerSettings.seconds;
  };

  // ===== EXPIRATION DATE HANDLERS =====
  const handleExpirationToggle = () => {
    if (!hasExpiration) {
      // Set default expiration to 7 days from now
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 7);
      setExpirationDate(defaultDate.toISOString().split('T')[0]);
      setExpirationTime('23:59');
    }
    setShowExpirationModal(true);
  };

  const handleExpirationSave = () => {
    if (!expirationDate || !expirationTime) {
      alert('Please select both date and time for expiration');
      return;
    }

    const expirationDateTime = new Date(`${expirationDate}T${expirationTime}:00`);
    const now = new Date();

    if (expirationDateTime <= now) {
      alert('Expiration date must be in the future');
      return;
    }

    setHasExpiration(true);
    setShowExpirationModal(false);
    
    console.log("📅 Expiration set for:", expirationDateTime.toLocaleString());
    alert(`✅ Expiration date set: ${expirationDateTime.toLocaleString()}`);
  };

  const handleRemoveExpiration = () => {
    setHasExpiration(false);
    setExpirationDate('');
    setExpirationTime('23:59');
    alert('Expiration date removed');
  };

  const formatExpirationDate = () => {
    if (!hasExpiration || !expirationDate) return 'No expiration';
    const date = new Date(`${expirationDate}T${expirationTime}:00`);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ===== UPDATED: OPTIONS & EXAM TYPE HANDLERS WITH TIMER PROMPT =====
  const handleOptionSelect = (option) => {
    setShowOptionsMenu(false);
    
    if (option === 'live-class') {
      setExamType('live-class');
      alert('🎥 Live Class selected! Students can join anytime.');
    }
  };

  // ===== UPDATED: IMPROVED saveQuizToBackend WITH ROBUST DUPLICATE PREVENTION =====
  const saveQuizToBackend = async (extraFields = {}) => {
    // Prevent multiple simultaneous calls
    if (loading) {
      console.log("⏸️ Duplicate call prevented - already saving");
      throw new Error("Already saving, please wait");
    }

    setLoading(true);

    if (!classId) {
      console.error("❌ Class ID is missing:", classId);
      setLoading(false);
      throw new Error("Error: Class information is missing. Please go back and try again.");
    }

    // Generate a unique request ID for this specific save attempt
    const requestId = `${classId}-${quiz.title}-${Date.now()}`;
    const storageKey = 'quizCreationInProgress';
    
    // Check if another quiz creation is in progress for this class
    const existingRequest = localStorage.getItem(storageKey);
    if (existingRequest) {
      try {
        const { classId: existingClassId, timestamp } = JSON.parse(existingRequest);
        const timeDiff = Date.now() - timestamp;
        
        // If the same class is trying to create a quiz within 3 seconds, prevent it
        if (existingClassId === classId && timeDiff < 3000) {
          console.log("⚠️ Rapid duplicate quiz creation prevented for class:", classId);
          setLoading(false);
          throw new Error("Please wait a moment before creating another quiz.");
        }
      } catch (parseError) {
        console.warn("Could not parse existing request data:", parseError);
        localStorage.removeItem(storageKey);
      }
    }

    // Store current request in localStorage to prevent duplicates
    localStorage.setItem(storageKey, JSON.stringify({
      classId,
      title: quiz.title,
      requestId,
      timestamp: Date.now()
    }));

    const questionsForBackend = quiz.questions.map(({ id, ...question }) => question);

    // Prepare expiration date
    let expirationDateTime = null;
    if (hasExpiration && expirationDate && expirationTime) {
      expirationDateTime = new Date(`${expirationDate}T${expirationTime}:00`);
    }

    try {
      const quizData = {
        title: quiz.title,
        description: quiz.description,
        questions: questionsForBackend,
        totalPoints: quiz.totalPoints,
        examType: 'live-class', // ✅ FORCE LIVE-CLASS
        isLiveClass: true, // ✅ ALWAYS TRUE
        // ✅ ADD TIMER SETTINGS
        liveClassSettings: {
          hasTimer: timerSettings.hasTimer,
          timerDuration: timerSettings.hasTimer ? 
            Math.floor(calculateTotalSeconds() / 60) : 0,
          autoDisconnect: timerSettings.autoDisconnect
        },
        ...extraFields
      };

      // Add expiration if set
      if (expirationDateTime) {
        quizData.expiration = expirationDateTime;
        quizData.hasExpiration = true;
      }

      let response;
      let savedExamId;

      if (editing) {
        const examIdToUpdate = examId || quiz._id;
        console.log("📝 Updating existing quiz:", examIdToUpdate);

        response = await updateQuiz(examIdToUpdate, quizData);
        savedExamId = examIdToUpdate;
      } else {
        console.log("📝 Creating new quiz for class:", classId);
        
        // Optional: Add backend-side duplicate check here
        // const duplicateCheck = await checkForDuplicateQuiz(classId, quiz.title);
        // if (duplicateCheck.exists) {
        //   throw new Error(`A quiz titled "${quiz.title}" already exists in this class.`);
        // }

        response = await createQuiz(classId, quizData);
        savedExamId = response.data._id;
      }

      if (!response.success) {
        throw new Error(response.message || "Failed to save quiz");
      }

      console.log("✅ Quiz saved successfully:", savedExamId);
      return { savedExamId, response };
      
    } catch (error) {
      console.error("❌ Error in saveQuizToBackend:", error);
      
      // Clean up localStorage on error
      localStorage.removeItem(storageKey);
      
      // Re-throw the error for the caller to handle
      throw error;
    } finally {
      // Always clean up and reset loading state
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

  const handleScheduleAssignment = async () => {
    if (!scheduledDate || !scheduledTime) {
      alert('Please select both date and time');
      return;
    }

    try {
      setLoading(true);
      
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`);
      
      const { savedExamId } = await saveQuizToBackend({
        status: 'scheduled',
        isDeployed: false,
        scheduledAt: scheduledDateTime
      });
      
      alert(`✅ Quiz scheduled for ${scheduledDateTime.toLocaleString()}`);
      
      setShowScheduleModal(false);
      setScheduledDate("");
      setScheduledTime("23:59");
      
      navigate('/dashboard', {
        state: { 
          selectedClassId: classId,
          activeTab: 'classwork',
          refresh: true,
          showSuccess: true
        },
        replace: true
      });
      
    } catch (error) {
      console.error('Failed to schedule quiz:', error);
      alert('Failed to schedule quiz: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

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

  const handleDeployQuiz = async () => {
    try {
      setLoading(true);

      const { savedExamId } = await saveQuizToBackend({
        status: 'published',
        isDeployed: true,
        scheduledAt: null
      });

      console.log("✅ Quiz saved successfully, now deploying:", savedExamId);

      const deployResponse = await deployExam(savedExamId);
      
      if (deployResponse.success) {
        console.log("🎥 Live Class deployed successfully! Navigating to dashboard...");
        
        navigate('/dashboard', {
          state: { 
            selectedClassId: classId,
            activeTab: 'classwork',
            refresh: true,
            showSuccess: true,
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
          Back to Dashboard
        </button>
        <div className="header-actions">
          {/* Options Dropdown */}
          <div className="options-wrapper">
            <button 
              className="options-btn" 
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
            >
              Options ▾
            </button>

            {showOptionsMenu && (
              <div className="options-dropdown">
                {/* ✅ LIVE CLASS */}
                <button onClick={() => handleOptionSelect('live-class')}>
                  🎥 Live Class
                </button>
                
                {/* ✅ ADD TIMER OPTION */}
                <button onClick={() => {
                  setShowTimerModal(true);
                  setShowOptionsMenu(false);
                }}>
                  ⏱️ Set Exam Timer
                </button>
                
                {/* Keep expiration button */}
                <button onClick={handleExpirationToggle}>
                  📅 {hasExpiration ? 'Edit Expiration' : 'Set Expiration'}
                </button>
              </div>
            )}
          </div>

          {/* Assign Dropdown */}
          <div className="assign-wrapper">
            <button 
              className="assign-btn" 
              onClick={() => setShowAssignMenu(!showAssignMenu)}
            >
              Assign ▾
            </button>

            {showAssignMenu && (
              <div className="assign-dropdown">
                <button 
                  onClick={() => { 
                    if (!loading) handleDeployQuiz(); 
                    setShowAssignMenu(false); 
                  }}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Assign'}
                </button>

                <button 
                  onClick={() => { 
                    setShowScheduleModal(true);
                    setShowAssignMenu(false);
                  }}
                  disabled={loading}
                >
                  Schedule
                </button>

                <button 
                  onClick={() => { 
                    if (!loading) handleSaveQuiz(); 
                    setShowAssignMenu(false); 
                  }}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save draft'}
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
            
            {/* ✅ UPDATED METADATA SECTION WITH TIMER DISPLAY */}
            <div className="quiz-metadata">
              <div className="total-points-display">
                Total Points: <strong>{quiz.totalPoints}</strong>
              </div>
              
              <div className="exam-type-display">
                Exam Type: <strong>🎥 Live Class</strong>
              </div>
              
              {/* ✅ ADD TIMER DISPLAY */}
              <div className="timer-display">
                ⏱️ Timer: <strong className="timer-value">
                  {timerSettings.hasTimer ? 
                    `${timerSettings.hours.toString().padStart(2, '0')}:${timerSettings.minutes.toString().padStart(2, '0')}:${timerSettings.seconds.toString().padStart(2, '0')}` : 
                    'No timer set'}
                </strong>
                {timerSettings.hasTimer ? (
                  <div className="timer-actions">
                    <button 
                      className="edit-timer-btn"
                      onClick={() => setShowTimerModal(true)}
                      title="Edit timer"
                    >
                      ✏️
                    </button>
                    <button 
                      className="remove-timer-btn"
                      onClick={() => setTimerSettings({...timerSettings, hasTimer: false})}
                      title="Remove timer"
                    >
                      🗑️
                    </button>
                  </div>
                ) : (
                  <button 
                    className="set-timer-btn"
                    onClick={() => setShowTimerModal(true)}
                    title="Set timer"
                  >
                    ➕ Set
                  </button>
                )}
              </div>
              
              {/* KEEP EXPIRATION DISPLAY */}
              <div className="expiration-display">
                📅 Expires: <strong className="expiration-value">
                  {formatExpirationDate()}
                </strong>
                {hasExpiration ? (
                  <div className="expiration-actions">
                    <button 
                      className="edit-expiration-btn"
                      onClick={handleExpirationToggle}
                      title="Edit expiration"
                    >
                      ✏️
                    </button>
                    <button 
                      className="remove-expiration-btn"
                      onClick={handleRemoveExpiration}
                      title="Remove expiration"
                    >
                      🗑️
                    </button>
                  </div>
                ) : (
                  <button 
                    className="set-expiration-btn"
                    onClick={handleExpirationToggle}
                    title="Set expiration"
                  >
                    ➕ Set
                  </button>
                )}
              </div>
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

        {/* Questions List */}
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
            {loading ? 'Deploying...' : '🎥 Deploy Live Class'}
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

      {/* EXPIRATION MODAL */}
      {showExpirationModal && (
        <div className="modal-overlay" onClick={() => setShowExpirationModal(false)}>
          <div className="expiration-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📅 Set Exam Expiration</h2>
              <button 
                className="close-modal"
                onClick={() => setShowExpirationModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <div className="expiration-info">
                <p>Students won't be able to access or submit the exam after this date/time.</p>
              </div>
              
              <div className="expiration-field">
                <label>Expiration Date</label>
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              
              <div className="expiration-field">
                <label>Expiration Time</label>
                <input
                  type="time"
                  value={expirationTime}
                  onChange={(e) => setExpirationTime(e.target.value)}
                />
              </div>
              
              <div className="expiration-preview">
                <strong>Exam will expire on:</strong>
                <div className="preview-date">
                  {expirationDate && expirationTime 
                    ? new Date(`${expirationDate}T${expirationTime}:00`).toLocaleString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'Please select date and time'}
                </div>
              </div>
              
              <div className="expiration-actions">
                {hasExpiration && (
                  <button 
                    className="remove-btn"
                    onClick={handleRemoveExpiration}
                  >
                    🗑️ Remove Expiration
                  </button>
                )}
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={() => setShowExpirationModal(false)}
              >
                Cancel
              </button>
              <button 
                className="save-expiration-btn"
                onClick={handleExpirationSave}
                disabled={!expirationDate || !expirationTime}
              >
                ✅ Save Expiration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ TIMER MODAL */}
      {showTimerModal && (
        <div className="modal-overlay" onClick={() => setShowTimerModal(false)}>
          <div className="timer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⏱️ Set Exam Timer</h2>
              <button className="close-modal" onClick={() => setShowTimerModal(false)}>×</button>
            </div>
            
            <div className="modal-content">
              <div className="timer-info">
                <p>Set a time limit for this live class exam.</p>
              </div>
              
              <div className="timer-toggle">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={timerSettings.hasTimer}
                    onChange={(e) => setTimerSettings({...timerSettings, hasTimer: e.target.checked})}
                  />
                  <span className="toggle-slider"></span>
                  <span className="toggle-text">Enable Timer</span>
                </label>
              </div>
              
              {timerSettings.hasTimer && (
                <>
                  <div className="timer-inputs">
                    <div className="time-input-group">
                      <label>Hours</label>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={timerSettings.hours}
                        onChange={(e) => setTimerSettings({...timerSettings, hours: parseInt(e.target.value) || 0})}
                        className="time-input"
                      />
                    </div>
                    
                    <div className="time-input-group">
                      <label>Minutes</label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={timerSettings.minutes}
                        onChange={(e) => setTimerSettings({...timerSettings, minutes: parseInt(e.target.value) || 0})}
                        className="time-input"
                      />
                    </div>
                    
                    <div className="time-input-group">
                      <label>Seconds</label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={timerSettings.seconds}
                        onChange={(e) => setTimerSettings({...timerSettings, seconds: parseInt(e.target.value) || 0})}
                        className="time-input"
                      />
                    </div>
                  </div>
                  
                  <div className="timer-preview">
                    <strong>Total Duration:</strong>
                    <div className="preview-duration">
                      {`${timerSettings.hours.toString().padStart(2, '0')}:${timerSettings.minutes.toString().padStart(2, '0')}:${timerSettings.seconds.toString().padStart(2, '0')}`}
                      <span className="total-seconds">({calculateTotalSeconds()} seconds)</span>
                    </div>
                  </div>
                  
                  <div className="auto-disconnect-toggle">
                    <label className="toggle-label">
                      <input
                        type="checkbox"
                        checked={timerSettings.autoDisconnect}
                        onChange={(e) => setTimerSettings({...timerSettings, autoDisconnect: e.target.checked})}
                      />
                      <span className="toggle-slider"></span>
                      <span className="toggle-text">Auto-disconnect students when timer ends</span>
                    </label>
                  </div>
                </>
              )}
            </div>
            
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowTimerModal(false)}>
                Cancel
              </button>
              <button className="save-timer-btn" onClick={() => {
                if (timerSettings.hasTimer && calculateTotalSeconds() <= 0) {
                  alert('Please set a valid timer duration');
                  return;
                }
                setShowTimerModal(false);
              }}>
                ✅ Save Timer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// QuestionEditor Component (unchanged)
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