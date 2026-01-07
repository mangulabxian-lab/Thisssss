// StudentExamSession.jsx - COMPLETE FILE WITH CAMERA
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getQuizForStudent, submitQuizAnswers } from '../lib/api';
import StudentExamCamera from '../components/StudentExamCamera';
import './StudentQuizPage.css';

// I-separate ang TextArea component sa labas
const TextAreaAnswer = React.memo(({ questionIndex, value, onChange, disabled, rows }) => {
  return (
    <textarea
      className="answer-textarea"
      value={value || ''}
      onChange={(e) => onChange(questionIndex, e.target.value)}
      placeholder="Type your answer here..."
      rows={rows}
      disabled={disabled}
    />
  );
});

// I-separate ang QuestionCard component sa labas
const QuestionCard = React.memo(({ 
  question, 
  index, 
  answer, 
  onAnswerChange, 
  showResults,
  isReviewMode 
}) => {
  console.log(`Rendering question ${index}`);
  
  const handleCheckboxChange = useCallback((option, isChecked) => {
    const currentAnswers = Array.isArray(answer) ? answer : [];
    const newAnswers = isChecked
      ? [...currentAnswers, option]
      : currentAnswers.filter(opt => opt !== option);
    onAnswerChange(index, newAnswers);
  }, [answer, index, onAnswerChange]);

  const handleRadioChange = useCallback((option) => {
    onAnswerChange(index, option);
  }, [index, onAnswerChange]);

  return (
    <div className="question-card">
      <div className="question-header">
        <h3>Question {index + 1}</h3>
        {question.points > 0 && (
          <span className="points-badge">{question.points} points</span>
        )}
      </div>
      
      <div className="question-content">
        <p className="question-text">{question.title}</p>
        
        {question.type === 'multiple-choice' && question.options && (
          <div className="options-list">
            {question.options.map((option, optIndex) => (
              <OptionLabel
                key={optIndex}
                type="radio"
                option={option}
                checked={answer === option}
                onChange={() => handleRadioChange(option)}
                disabled={showResults || isReviewMode}
                isReviewMode={isReviewMode}
              />
            ))}
          </div>
        )}
        
        {question.type === 'checkboxes' && question.options && (
          <div className="options-list">
            {question.options.map((option, optIndex) => (
              <OptionLabel
                key={optIndex}
                type="checkbox"
                option={option}
                checked={Array.isArray(answer) ? answer.includes(option) : false}
                onChange={(e) => handleCheckboxChange(option, e.target.checked)}
                disabled={showResults || isReviewMode}
                isReviewMode={isReviewMode}
              />
            ))}
          </div>
        )}
        
        {(question.type === 'short-answer' || question.type === 'paragraph') && (
          <TextAreaAnswer
            questionIndex={index}
            value={answer}
            onChange={onAnswerChange}
            disabled={showResults || isReviewMode}
            rows={question.type === 'paragraph' ? 4 : 2}
          />
        )}
      </div>
    </div>
  );
});

// Separate component para sa options
const OptionLabel = React.memo(({ type, option, checked, onChange, disabled, isReviewMode }) => (
  <label className={`option-label ${isReviewMode ? 'review-mode' : ''}`}>
    <input
      type={type}
      value={option}
      checked={checked}
      onChange={onChange}
      disabled={disabled}
    />
    <span className="option-text">{option}</span>
  </label>
));

export default function StudentQuizPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { examTitle, classId } = location.state || {};
  
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);

  const loadQuiz = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getQuizForStudent(examId);
      
      if (response.success) {
        setQuiz(response.data);
        const initialAnswers = {};
        response.data.questions.forEach((question, index) => {
          // Initialize based on question type
          if (question.type === 'checkboxes') {
            initialAnswers[index] = [];
          } else {
            initialAnswers[index] = '';
          }
        });
        setAnswers(initialAnswers);
      } else {
        setError(response.message || 'Failed to load quiz');
      }
    } catch (error) {
      console.error('Failed to load quiz:', error);
      setError('Failed to load quiz: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    if (examId) {
      loadQuiz();
    }
  }, [examId, loadQuiz]);

  // Stable callback para sa answer changes
  const handleAnswerChange = useCallback((questionIndex, value) => {
    if (isReviewMode) return; // Prevent changes in review mode
    
    setAnswers(prev => {
      // I-check kung nagbago ba talaga ang value bago mag-update
      if (prev[questionIndex] === value) {
        return prev;
      }
      return {
        ...prev,
        [questionIndex]: value
      };
    });
  }, [isReviewMode]);

  // Stable answered count calculation
  const { answeredCount, progressPercentage } = useMemo(() => {
    const count = Object.values(answers).filter(answer => 
      answer && (typeof answer === 'string' ? answer.trim() !== '' : Array.isArray(answer) ? answer.length > 0 : true)
    ).length;
    
    const percentage = (count / (quiz?.questions?.length || 1)) * 100;
    
    return { answeredCount: count, progressPercentage: percentage };
  }, [answers, quiz?.questions?.length]);

  const handleSubmit = async () => {
    if (!window.confirm('Are you sure you want to submit your answers? You cannot change them after submission.')) {
      return;
    }

    try {
      setSubmitting(true);
      const response = await submitQuizAnswers(examId, answers);
      
      if (response.success) {
        setResults(response.data);
        setShowResults(true);
        setIsReviewMode(true); // Enable review mode after submission
      } else {
        alert('Failed to submit quiz: ' + response.message);
      }
    } catch (error) {
      console.error('Submission error:', error);
      alert('Failed to submit quiz: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  const handleReviewAnswers = () => {
    setIsReviewMode(true);
    setShowResults(false);
  };

  const handleBackToResults = () => {
    setIsReviewMode(false);
    setShowResults(true);
  };

  // Results View Component
  const ResultsView = useMemo(() => {
    if (!results) return null;

    return (
      <div className="results-container">
        <div className="results-header">
          <div className="results-success">
            <div className="success-icon">✅</div>
            <h1>Quiz Submitted Successfully!</h1>
          </div>
          
          <div className="score-card">
            <div className="score-circle">
              <span className="score-percentage">
                {results.score !== undefined ? `${Math.round(results.score)}%` : 'N/A'}
              </span>
              <span className="score-label">Overall Score</span>
            </div>
            <div className="score-details">
              <div className="score-item">
                <span className="score-item-label">Correct Answers:</span>
                <span className="score-item-value">
                  {results.correctAnswers !== undefined ? results.correctAnswers : 'N/A'} / {quiz?.questions?.length || 0}
                </span>
              </div>
              <div className="score-item">
                <span className="score-item-label">Total Points:</span>
                <span className="score-item-value">
                  {results.totalPoints !== undefined ? results.totalPoints : 'N/A'} / {quiz?.totalPoints || 'N/A'}
                </span>
              </div>
              <div className="score-item">
                <span className="score-item-label">Submitted At:</span>
                <span className="score-item-value">{new Date().toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="performance-message">
          <div className="message">
            <h3>
              {results.score >= 90 ? 'Excellent Work! 🎉' : 
               results.score >= 75 ? 'Good Job! 👍' : 
               results.score >= 60 ? 'Not Bad! 💪' : 
               'Keep Practicing! 📚'}
            </h3>
            <p>
              {results.score >= 90 ? 'You have mastered this material!' : 
               results.score >= 75 ? 'You have a good understanding of the topic.' : 
               results.score >= 60 ? 'You passed, but there is room for improvement.' : 
               'Review the material and try again.'}
            </p>
          </div>
        </div>

        <div className="results-actions">
          <button 
            className="action-btn back-to-class-btn"
            onClick={handleBackToDashboard}
          >
            Back to Dashboard
          </button>
          <button 
            className="action-btn view-answers-btn"
            onClick={handleReviewAnswers}
          >
            📝 Review Your Answers
          </button>
        </div>
      </div>
    );
  }, [results, quiz, handleBackToDashboard, handleReviewAnswers]);

  // Quiz View Component (Review Mode or Normal Mode)
  const QuizView = useMemo(() => {
    const isDisabled = showResults || isReviewMode || submitting;

    return (
      <div className="student-quiz-container">
        {/* Add Camera Preview using StudentExamCamera component */}
        <StudentExamCamera examId={examId} isRequired={true} />
        
        <div className="quiz-header">
          {isReviewMode ? (
            <button 
              className="back-btn"
              onClick={handleBackToResults}
            >
              ← Back to Results
            </button>
          ) : (
            <button 
              className="back-btn"
              onClick={handleBackToDashboard}
            >
              Back to Dashboard
            </button>
          )}
          
          <div className="quiz-info">
            <h1>{quiz?.title || examTitle}</h1>
            <p className="quiz-description">{quiz?.description}</p>
            <div className="quiz-meta">
              <span>{quiz?.questions?.length || 0} questions</span>
              {quiz?.totalPoints > 0 && (
                <span>Total points: {quiz.totalPoints}</span>
              )}
              {isReviewMode && (
                <span className="review-badge">Review Mode</span>
              )}
            </div>
          </div>
        </div>

        <div className="quiz-questions">
          {quiz?.questions?.map((question, index) => (
            <QuestionCard
              key={index}
              question={question}
              index={index}
              answer={answers[index]}
              onAnswerChange={handleAnswerChange}
              showResults={showResults}
              isReviewMode={isReviewMode}
            />
          ))}
        </div>

        {!isReviewMode && (
          <div className="quiz-footer">
            <div className="quiz-progress">
              <span className="progress-text">
                Answered: {answeredCount} / {quiz?.questions?.length || 0}
              </span>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
            
            <button 
              className="submit-quiz-btn"
              onClick={handleSubmit}
              disabled={isDisabled || !quiz?.questions?.length}
            >
              {submitting ? (
                <>
                  <div className="loading-spinner-small"></div>
                  Submitting...
                </>
              ) : (
                'Submit Quiz'
              )}
            </button>
          </div>
        )}

        {isReviewMode && (
          <div className="quiz-footer">
            <div className="quiz-progress">
              <span className="progress-text">
                Reviewing your submitted answers
              </span>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: '100%', backgroundColor: '#48bb78' }}
                ></div>
              </div>
            </div>
            
            <button 
              className="action-btn back-to-class-btn"
              onClick={handleBackToDashboard}
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    );
  }, [
    quiz, 
    examTitle, 
    answers, 
    answeredCount, 
    progressPercentage, 
    showResults, 
    isReviewMode, 
    submitting, 
    handleAnswerChange, 
    handleSubmit, 
    handleBackToDashboard,
    handleBackToResults,
    examId
  ]);

  if (loading) {
    return (
      <div className="quiz-loading">
        <StudentExamCamera examId={examId} isRequired={true} />
        <div className="loading-spinner"></div>
        <p>Loading quiz...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quiz-error">
        <StudentExamCamera examId={examId} isRequired={true} />
        <h2>Error Loading Quiz</h2>
        <p>{error}</p>
        <button 
          onClick={handleBackToDashboard}
          className="back-btn"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="quiz-error">
        <StudentExamCamera examId={examId} isRequired={true} />
        <h2>Quiz Not Found</h2>
        <p>The requested quiz could not be found.</p>
        <button 
          onClick={handleBackToDashboard}
          className="back-btn"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return showResults ? ResultsView : QuizView;
}