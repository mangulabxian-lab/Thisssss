// src/components/GradesTab.jsx - UPDATED FIXED VERSION
import React, { useState, useEffect, useRef } from 'react';
import './GradesTab.css';

const GradesTab = ({
  selectedClass,
  gradesLoading,
  gradesData,
  gradesView,
  setGradesView,
  selectedExamId,
  setSelectedExamId,
  selectedStudentId,
  setSelectedStudentId,
  gradeSortBy,
  setGradeSortBy,
  showSortMenu,
  setShowSortMenu,
  user,
  api,
  exportGradesToExcel
}) => {
  const { exams, students } = gradesData;
  const [gridView, setGridView] = useState(false);
  const sortMenuRef = useRef(null);

  // Close sort menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target)) {
        setShowSortMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Sort students based on selected criteria
  const sortStudents = (studentList) => {
    if (!studentList) return [];
    
    return [...studentList].sort((a, b) => {
      const nameA = a.name || a.email || '';
      const nameB = b.name || b.email || '';
      
      if (gradeSortBy === "lastName") {
        const lastNameA = nameA.split(' ').pop().toLowerCase();
        const lastNameB = nameB.split(' ').pop().toLowerCase();
        return lastNameA.localeCompare(lastNameB);
      } else {
        // Sort by first name (default)
        const firstNameA = nameA.split(' ')[0].toLowerCase();
        const firstNameB = nameB.split(' ')[0].toLowerCase();
        return firstNameA.localeCompare(firstNameB);
      }
    });
  };

  const sortedStudents = sortStudents(students);

  // Helper function to determine if exam is past due
  const isExamPastDue = (exam) => {
    if (!exam.dueDate) return false;
    const now = new Date();
    const dueDate = new Date(exam.dueDate);
    return now > dueDate;
  };

  // Helper function to determine student submission status
  const getStudentSubmissionStatus = (exam, studentId) => {
    const submissions = exam.completedBy || [];
    const submission = submissions.find(s => {
      const id = (s.studentId && s.studentId._id) || s.studentId;
      return id && id.toString() === studentId;
    });

    if (submission) {
      return {
        status: 'submitted',
        score: submission.score,
        maxScore: submission.maxScore || exam.totalPoints,
        submittedAt: submission.submittedAt || submission.completedAt
      };
    }

    const isPastDue = isExamPastDue(exam);
    
    return {
      status: isPastDue ? 'missing' : 'not_submitted',
      score: null,
      maxScore: exam.totalPoints,
      submittedAt: null
    };
  };

  // Level 2: Exam Details
  const renderExamDetails = () => {
    const exam = exams.find(e => e._id === selectedExamId);
    if (!exam) {
      return (
        <div className="grades-tab">
          <div className="grades-navigation">
            <button
              className="grades-back-btn"
              onClick={() => {
                setGradesView("overview");
                setSelectedExamId(null);
              }}
            >
              ← Back to grades overview
            </button>
          </div>
          <div className="grades-empty">
            <h3>Exam not found</h3>
            <p>The selected quiz or exam could not be loaded.</p>
          </div>
        </div>
      );
    }

    const rows = (sortedStudents || []).map(student => {
      const submission = getStudentSubmissionStatus(exam, student._id);

      let scoreDisplay = "-";
      let status = "Not submitted";
      let statusClass = "pending";
      let completedAtDisplay = "-";

      if (submission.status === 'submitted') {
        const maxScore = submission.maxScore || exam.totalPoints || 0;
        const score = submission.score ?? null;

        scoreDisplay =
          score != null && maxScore
            ? `${score}/${maxScore}`
            : score != null
            ? score
            : "-";
        status = "Submitted";
        statusClass = "completed";
        completedAtDisplay = submission.submittedAt
          ? new Date(submission.submittedAt).toLocaleString()
          : "-";
      } else if (submission.status === 'missing') {
        scoreDisplay = "Missing";
        status = "Missing";
        statusClass = "missing";
      } else {
        scoreDisplay = "-";
        status = "Not submitted";
        statusClass = "pending";
      }

      return {
        studentId: student._id,
        name: student.name || student.email,
        email: student.email,
        scoreDisplay,
        status,
        statusClass,
        completedAtDisplay
      };
    });

    return (
      <div className="grades-tab">
        <div className="grades-navigation">
          <button
            className="grades-back-btn"
            onClick={() => {
              setGradesView("overview");
              setSelectedExamId(null);
            }}
          >
            ← Back to grades overview
          </button>
          <div className="grades-view-title">Exam Details</div>
        </div>

        <div className="exam-header-card">
          <div className="exam-title-section">
            <h2 className="exam-title">{exam.title}</h2>
            <div className="exam-meta">
              <span className="exam-meta-item">Total Points: {exam.totalPoints}</span>
              <span className="exam-meta-item">Due: {new Date(exam.dueDate).toLocaleDateString()}</span>
              <span className="exam-meta-item">
                Status: {isExamPastDue(exam) ? 'Past Due' : 'Active'}
              </span>
            </div>
          </div>
        </div>

        <div className="grades-section">
          <table className="grades-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Score</th>
                <th>Status</th>
                <th>Submitted at</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={row.studentId}
                  className="grades-row-clickable"
                  onClick={() => {
                    setSelectedStudentId(row.studentId);
                    setGradesView("student");
                  }}
                >
                  <td className="student-cell">
                    <div className="student-info-compact">
                      <img 
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(row.name)}&background=4285f4&color=fff`}
                        className="student-avatar-sm"
                        alt={row.name}
                      />
                      <span className="student-name-text">{row.name}</span>
                    </div>
                  </td>
                  <td className="email-cell">{row.email}</td>
                  <td className="score-cell">
                    <span className={`grade-${row.status.toLowerCase().replace(' ', '-')}`}>
                      {row.scoreDisplay}
                    </span>
                  </td>
                  <td className="status-cell">
                    <span className={`status-badge ${row.statusClass}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="date-cell">{row.completedAtDisplay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Level 3: Student Details
  const renderStudentDetails = () => {
    const { studentStats } = gradesData;
    const stat = studentStats.find(s => s.studentId === selectedStudentId);
    const student = (sortedStudents || []).find(s => s._id === selectedStudentId);

    return (
      <div className="grades-tab">
        <div className="grades-navigation">
          <button
            className="grades-back-btn"
            onClick={() => {
              if (selectedExamId) {
                setGradesView("exam");
                setSelectedStudentId(null);
              } else {
                setGradesView("overview");
                setSelectedStudentId(null);
              }
            }}
          >
            ← Back {selectedExamId ? 'to exam' : 'to grades overview'}
          </button>
          <div className="grades-view-title">Student Performance</div>
        </div>

        {!stat || !stat.details || stat.details.length === 0 ? (
          <div className="grades-empty">
            <h3>No grade history</h3>
            <p>This student has not completed any quizzes or exams yet.</p>
            <div className="grades-empty-actions">
              <button
                className="empty-state-btn"
                onClick={() => {
                  setGradesView("overview");
                  setSelectedStudentId(null);
                }}
              >
                Return to Overview
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="student-header-card">
              <div className="student-profile">
                <img 
                  src={student?.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(student?.name || student?.email || 'Student')}&background=4285f4&color=fff&size=120`}
                  className="student-avatar-lg"
                  alt={student?.name || student?.email || 'Student'}
                />
                <div className="student-info">
                  <h2 className="student-name-large">{student?.name || student?.email || 'Student'}</h2>
                  <p className="student-email-large">{student?.email}</p>
                </div>
              </div>
            </div>

            <div className="grades-summary-cards">
              <div className="grade-card">
                <h4>Exams taken</h4>
                <p className="stat-large">{stat.examsTaken || 0}</p>
              </div>
              <div className="grade-card">
                <h4>Total points</h4>
                <p className="stat-large">
                  {stat.totalPoints || 0}
                </p>
              </div>
              <div className="grade-card">
                <h4>Average score</h4>
                <p className="stat-large">
                  {stat.averageScore ? `${stat.averageScore.toFixed(1)}%` : '0%'}
                </p>
              </div>
            </div>

            <div className="grades-section">
              <div className="section-header">
                <h4 className="section-title">Performance by Exam</h4>
                <button 
                  className="toggle-view-btn"
                  onClick={() => setGridView(!gridView)}
                >
                  {gridView ? 'Switch to Table View' : 'Switch to Grid View'}
                </button>
              </div>
              
              {gridView ? (
                <div className="grades-grid">
                  {stat.details.map(detail => {
                    const exam = exams.find(e => e._id === detail.examId);
                    const isPastDue = exam ? isExamPastDue(exam) : false;
                    const hasSubmitted = detail.score != null;
                    
                    let scoreText = "—";
                    let statusClass = "pending";
                    
                    if (hasSubmitted) {
                      scoreText = detail.maxScore
                        ? `${detail.score}/${detail.maxScore}`
                        : detail.score;
                      statusClass = "completed";
                    } else if (isPastDue) {
                      scoreText = "Missing";
                      statusClass = "missing";
                    }

                    return (
                      <div key={detail.examId} className="grade-card-exam">
                        <h5 className="exam-grid-title">{detail.examTitle}</h5>
                        <div className="exam-grid-stats">
                          <div className="grid-stat">
                            <span className="grid-stat-label">Score:</span>
                            <span className={`grid-stat-value ${statusClass}`}>
                              {scoreText}
                            </span>
                          </div>
                          <div className="grid-stat">
                            <span className="grid-stat-label">Status:</span>
                            <span className={`grid-stat-value ${detail.percentage >= 70 ? 'text-green-600' : 'text-red-600'}`}>
                              {hasSubmitted ? (detail.percentage >= 70 ? 'Pass' : 'Fail') : 'Not submitted'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <table className="grades-table">
                  <thead>
                    <tr>
                      <th>Quiz / Exam</th>
                      <th>Score</th>
                      <th>Status</th>
                      <th>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stat.details.map(detail => {
                      const exam = exams.find(e => e._id === detail.examId);
                      const isPastDue = exam ? isExamPastDue(exam) : false;
                      const hasSubmitted = detail.score != null;
                      
                      let scoreText = "—";
                      let statusText = "Not submitted";
                      let statusClass = "pending";
                      
                      if (hasSubmitted) {
                        scoreText = detail.maxScore
                          ? `${detail.score}/${detail.maxScore}`
                          : detail.score;
                        statusText = detail.percentage >= 70 ? 'Pass' : 'Fail';
                        statusClass = "completed";
                      } else if (isPastDue) {
                        scoreText = "Missing";
                        statusText = "Missing";
                        statusClass = "missing";
                      }

                      return (
                        <tr key={detail.examId}>
                          <td>{detail.examTitle}</td>
                          <td>
                            <span className={`grade-${statusClass}`}>
                              {scoreText}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge ${statusClass}`}>
                              {statusText}
                            </span>
                          </td>
                          <td>
                            {hasSubmitted ? (
                              <span className={`percentage-badge ${detail.percentage >= 70 ? 'completed' : 'pending'}`}>
                                {detail.percentage != null ? `${detail.percentage.toFixed(1)}%` : '-'}
                              </span>
                            ) : (
                              <span className="percentage-badge pending">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  // Main Grades View with Grid Option
  const renderMainGradesView = () => {
    if (gradesLoading) {
      return (
        <div className="grades-tab">
          <div className="loading">Loading grades...</div>
        </div>
      );
    }

    if (!exams || exams.length === 0 || !sortedStudents || sortedStudents.length === 0) {
      return (
        <div className="grades-tab">
          <div className="grades-empty">
            <h3>Grades</h3>
            <p>
              No grades yet. When students start submitting quizzes/exams, this
              gradebook will show their scores.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="grades-tab">
        <div className="gradebook-toolbar">
          <div className="toolbar-left">
            <div className="gradebook-sort" ref={sortMenuRef}>
              <button
                type="button"
                className="sort-by-btn"
                onClick={() => setShowSortMenu(!showSortMenu)}
                aria-expanded={showSortMenu}
              >
                <svg className="sort-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                </svg>
                Sort by: {gradeSortBy === "lastName" ? "Last Name" : "First Name"}
              </button>

              {showSortMenu && (
                <div className="sort-menu">
                  <button
                    type="button"
                    className={`sort-menu-item ${gradeSortBy === "firstName" ? "active" : ""}`}
                    onClick={() => {
                      setGradeSortBy("firstName");
                      setShowSortMenu(false);
                    }}
                  >
                    Sort by First Name
                  </button>
                  <button
                    type="button"
                    className={`sort-menu-item ${gradeSortBy === "lastName" ? "active" : ""}`}
                    onClick={() => {
                      setGradeSortBy("lastName");
                      setShowSortMenu(false);
                    }}
                  >
                    Sort by Last Name
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="toolbar-right">
            <div className="view-toggle">
              <button
                className={`view-toggle-btn ${!gridView ? 'active' : ''}`}
                onClick={() => setGridView(false)}
                title="Table View"
              >
                <svg className="view-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
              <button
                className={`view-toggle-btn ${gridView ? 'active' : ''}`}
                onClick={() => setGridView(true)}
                title="Grid View"
              >
                <svg className="view-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
            </div>

            <button
              className="export-grades-btn"
              onClick={exportGradesToExcel}
              title="Export grades to Excel"
            >
              <svg className="export-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export to Excel
            </button>
          </div>
        </div>

        {gridView ? (
          <div className="grades-grid-container">
            <div className="grades-grid-header">
              <h3 className="grid-title">Student Grades Overview</h3>
              <p className="grid-subtitle">Click on any card to view details</p>
            </div>
            
            <div className="grades-grid">
              {sortedStudents.map(student => {
                const studentExams = exams.map(exam => {
                  const submissionStatus = getStudentSubmissionStatus(exam, student._id);
                  
                  return {
                    examId: exam._id,
                    title: exam.title,
                    score: submissionStatus.score,
                    totalPoints: submissionStatus.maxScore,
                    status: submissionStatus.status
                  };
                });

                const submittedExams = studentExams.filter(e => e.status === 'submitted').length;
                const missingExams = studentExams.filter(e => e.status === 'missing').length;
                const totalExams = exams.length;

                return (
                  <div 
                    key={student._id} 
                    className="student-grade-card"
                    onClick={() => {
                      setSelectedStudentId(student._id);
                      setGradesView("student");
                    }}
                  >
                    <div className="student-card-header">
                      <img 
                        src={student.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name || student.email)}&background=4285f4&color=fff`}
                        className="student-card-avatar"
                        alt={student.name || student.email}
                      />
                      <div className="student-card-info">
                        <h4 className="student-card-name">{student.name || student.email}</h4>
                        <p className="student-card-email">{student.email}</p>
                      </div>
                    </div>
                    
                    <div className="student-card-stats">
                      <div className="card-stat">
                        <span className="card-stat-label">Submitted</span>
                        <span className="card-stat-value">{submittedExams}/{totalExams}</span>
                      </div>
                      <div className="card-stat">
                        <span className="card-stat-label">Missing</span>
                        <span className="card-stat-value missing-stat">{missingExams}</span>
                      </div>
                      <div className="card-stat">
                        <span className="card-stat-label">Total Points</span>
                        <span className="card-stat-value">
                          {studentExams.reduce((sum, exam) => sum + (exam.score || 0), 0)}
                        </span>
                      </div>
                    </div>

                    <div className="student-exams-preview">
                      {studentExams.slice(0, 3).map((exam, idx) => {
                        let scoreDisplay = "—";
                        let scoreClass = "no-score";
                        
                        if (exam.status === 'submitted') {
                          scoreDisplay = exam.score != null && exam.totalPoints
                            ? `${exam.score}/${exam.totalPoints}`
                            : exam.score != null
                            ? exam.score
                            : "—";
                          scoreClass = "has-score";
                        } else if (exam.status === 'missing') {
                          scoreDisplay = "Missing";
                          scoreClass = "missing-score";
                        }

                        return (
                          <div key={idx} className="exam-preview-item">
                            <span className="exam-preview-title">{exam.title}</span>
                            <span className={`exam-preview-score ${scoreClass}`}>
                              {scoreDisplay}
                            </span>
                          </div>
                        );
                      })}
                      {studentExams.length > 3 && (
                        <div className="more-exams">+{studentExams.length - 3} more</div>
                      )}
                    </div>

                    <div className="student-card-footer">
                      <span className="view-details-link">View Details →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grades-table-container">
            <table className="grades-table-fixed">
              <thead>
                <tr>
                  <th className="grades-th students-th">Students</th>
                  {exams.map((exam) => (
                    <th key={exam._id} className="grades-th exam-th">
                      <div className="exam-title-header">{exam.title}</div>
                      <div className="exam-points">out of {exam.totalPoints}</div>
                      <div className="exam-due">
                        Due: {new Date(exam.dueDate).toLocaleDateString()}
                        {isExamPastDue(exam) && <span className="past-due-badge">Past Due</span>}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((student) => {
                  const examScores = {};
                  exams.forEach(exam => {
                    const submissionStatus = getStudentSubmissionStatus(exam, student._id);
                    examScores[exam._id] = {
                      status: submissionStatus.status,
                      score: submissionStatus.score,
                      maxScore: submissionStatus.maxScore
                    };
                  });

                  return (
                    <tr key={student._id} className="student-row">
                      <td className="grades-td student-info-cell">
                        <div className="student-info-wrapper">
                          <img 
                            src={student.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name || student.email)}&background=4285f4&color=fff`}
                            className="student-avatar"
                            alt={student.name || student.email}
                          />
                          <div className="student-name-email">
                            <div className="student-name">{student.name || student.email}</div>
                            <div className="student-email">{student.email}</div>
                          </div>
                        </div>
                      </td>
                      {exams.map((exam) => {
                        const scoreData = examScores[exam._id];
                        
                        return (
                          <td key={exam._id} className="grades-td score-cell">
                            {scoreData.status === 'submitted' ? (
                              <div className="score-display">
                                <span className="grade-score">
                                  {scoreData.score != null && scoreData.maxScore
                                    ? `${scoreData.score}/${scoreData.maxScore}`
                                    : scoreData.score != null
                                    ? scoreData.score
                                    : "—"}
                                </span>
                              </div>
                            ) : scoreData.status === 'missing' ? (
                              <span className="grade-missing">Missing</span>
                            ) : (
                              <span className="grade-not-submitted">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  if (gradesView === "exam" && selectedExamId) {
    return renderExamDetails();
  }

  if (gradesView === "student" && selectedStudentId) {
    return renderStudentDetails();
  }

  return renderMainGradesView();
};

export default GradesTab;