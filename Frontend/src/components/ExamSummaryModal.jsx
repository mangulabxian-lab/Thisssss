import React, { useState } from 'react';
import './ExamSummaryModal.css';

const ExamSummaryModal = ({ exam, summaryData, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');
  
  if (!exam || !summaryData) return null;
  
  return (
    <div className="summary-modal-overlay">
      <div className="summary-modal-content">
        <div className="summary-modal-header">
          <h2>📊 Exam Summary: {exam.title}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="summary-tabs">
          <button 
            className={`summary-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📈 Overview
          </button>
          <button 
            className={`summary-tab ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => setActiveTab('students')}
          >
            👥 Students
          </button>
          <button 
            className={`summary-tab ${activeTab === 'detections' ? 'active' : ''}`}
            onClick={() => setActiveTab('detections')}
          >
            🚨 Violations
          </button>
        </div>
        
        <div className="summary-modal-body">
          {activeTab === 'overview' && (
            <div className="overview-tab">
              <div className="overview-stats">
                <div className="stat-card">
                  <h3>Total Students</h3>
                  <p className="stat-value">{summaryData.totalStudents}</p>
                </div>
                <div className="stat-card">
                  <h3>Completed</h3>
                  <p className="stat-value">{summaryData.completedCount}</p>
                </div>
                <div className="stat-card">
                  <h3>Average Score</h3>
                  <p className="stat-value">{summaryData.averageScore}%</p>
                </div>
                <div className="stat-card">
                  <h3>Total Violations</h3>
                  <p className="stat-value">{summaryData.totalViolations}</p>
                </div>
              </div>
              
              <div className="score-distribution">
                <h3>📊 Score Distribution</h3>
                <div className="distribution-chart">
                  {summaryData.scoreDistribution?.map((range, index) => (
                    <div key={index} className="distribution-bar">
                      <div className="bar-label">{range.range}</div>
                      <div className="bar-container">
                        <div 
                          className="bar-fill"
                          style={{ width: `${(range.count / summaryData.completedCount) * 100}%` }}
                        ></div>
                      </div>
                      <div className="bar-count">{range.count} students</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'students' && (
            <div className="students-tab">
              <table className="students-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Score</th>
                    <th>Percentage</th>
                    <th>Violations</th>
                    <th>Time Taken</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.studentSummaries?.map((student, index) => (
                    <tr key={index}>
                      <td>
                        <div className="student-info">
                          <div className="student-avatar">
                            {student.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div>
                            <div className="student-name">{student.name}</div>
                            <div className="student-email">{student.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{student.score}/{student.maxScore}</td>
                      <td>
                        <span className={`percentage-badge ${getScoreClass(student.percentage)}`}>
                          {student.percentage}%
                        </span>
                      </td>
                      <td>
                        <span className={`violations-badge ${student.violations > 0 ? 'has-violations' : 'no-violations'}`}>
                          {student.violations}
                        </span>
                      </td>
                      <td>{formatTimeTaken(student.timeTaken)}</td>
                      <td>
                        <span className={`status-badge ${student.status}`}>
                          {student.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {activeTab === 'detections' && (
            <div className="detections-tab">
              <h3>🚨 Proctoring Violations Summary</h3>
              
              <div className="violation-types">
                {summaryData.violationTypes?.map((type, index) => (
                  <div key={index} className="violation-type-card">
                    <div className="violation-type-header">
                      <span className="violation-icon">{getViolationIcon(type.type)}</span>
                      <span className="violation-type-name">{type.type}</span>
                      <span className="violation-count">{type.count}</span>
                    </div>
                    <div className="violation-students">
                      {type.students?.slice(0, 3).map((student, idx) => (
                        <span key={idx} className="student-tag">
                          {student.name}
                        </span>
                      ))}
                      {type.students?.length > 3 && (
                        <span className="more-tag">+{type.students.length - 3} more</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="high-risk-students">
                <h4>⚠️ High Risk Students (3+ violations)</h4>
                <div className="high-risk-list">
                  {summaryData.highRiskStudents?.map((student, index) => (
                    <div key={index} className="high-risk-card">
                      <div className="student-info">
                        <div className="student-avatar warning">
                          {student.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <div className="student-name">{student.name}</div>
                          <div className="violation-details">
                            <span className="violation-count">{student.violationCount} violations</span>
                            <span className="violation-types-list">
                              {student.violationTypes?.join(', ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="summary-modal-footer">
          <button className="export-btn" onClick={() => exportSummaryToPDF(exam, summaryData)}>
            📥 Export PDF Report
          </button>
          <button className="close-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper functions
const getScoreClass = (percentage) => {
  if (percentage >= 90) return 'excellent';
  if (percentage >= 70) return 'good';
  if (percentage >= 50) return 'average';
  return 'poor';
};

const formatTimeTaken = (seconds) => {
  if (!seconds) return 'N/A';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  } else if (mins > 0) {
    return `${mins}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

const getViolationIcon = (type) => {
  const icons = {
    'Face Not Detected': '👤',
    'Multiple People': '👥',
    'Mobile Phone': '📱',
    'Looking Away': '👀',
    'Audio Detected': '🎤',
    'Tab Switching': '💻',
    'No Camera': '📹',
    'Other': '⚠️'
  };
  return icons[type] || '⚠️';
};

const exportSummaryToPDF = (exam, summaryData) => {
  // Implement PDF export logic here
  alert(`Exporting summary for ${exam.title}...`);
  // You would typically use a library like jsPDF or html2pdf here
};

export default ExamSummaryModal;