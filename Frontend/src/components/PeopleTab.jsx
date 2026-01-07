// src/components/PeopleTab.jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaEllipsisV, FaVolumeMute, FaVolumeUp, FaUserMinus } from 'react-icons/fa';
import './PeopleTab.css';

const PeopleTab = ({ 
  classPeople, 
  loadingPeople, 
  selectedClass, 
  isTeacher, 
  user,
  api,
  activeActions,
  setActiveActions,
  handleToggleMute,
  handleRemoveStudent
}) => {
  const actionsDropdownRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [activeStudentId, setActiveStudentId] = useState(null);
  const buttonRefs = useRef({});
  
  // Handle click outside for dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(event.target)) {
        setActiveActions(null);
        setActiveStudentId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setActiveActions]);

  const toggleActions = useCallback((studentId, event) => {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
      
      // Get the button position
      const button = buttonRefs.current[studentId];
      if (button) {
        const rect = button.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 5,
          left: rect.right + window.scrollX - 180, // Adjust based on dropdown width
        });
      }
      
      if (activeStudentId === studentId) {
        setActiveStudentId(null);
        setActiveActions(null);
      } else {
        setActiveStudentId(studentId);
        setActiveActions(studentId);
      }
    }
  }, [activeStudentId, setActiveActions]);

  // Helper function to get profile image URL
  const getProfileImage = (person) => {
    if (person.profileImage) {
      if (person.profileImage.startsWith('http')) {
        return person.profileImage;
      }
      if (person.profileImage.startsWith('/')) {
        return `http://localhost:3000${person.profileImage}`;
      }
      if (person.profileImage.startsWith('data:')) {
        return person.profileImage;
      }
      return `http://localhost:3000/uploads/${person.profileImage}`;
    }
    return null;
  };

  if (loadingPeople) {
    return <div className="loading">Loading people...</div>;
  }

  // Get the active student for the dropdown
  const activeStudent = classPeople.students?.find(s => s._id === activeStudentId);

  return (
    <>
      <div className="people-tab">
        <div className="people-header">
          <h3>People</h3>
        </div>

        {/* Teachers Section */}
        <div className="people-section">
          <h4 className="section-title">Teachers ({classPeople.teachers?.length || 0})</h4>
          <div className="people-list">
            {classPeople.teachers && classPeople.teachers.length > 0 ? (
              classPeople.teachers.map(teacher => {
                const profileImage = getProfileImage(teacher);
                
                return (
                  <div key={teacher._id} className="person-card teacher-card">
                    <div className="person-avatar">
                      {profileImage ? (
                        <img 
                          src={profileImage} 
                          alt={teacher.name}
                          className="avatar-image"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const fallback = e.target.nextSibling;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className={`avatar-fallback ${profileImage ? 'hidden' : ''}`}
                        style={{ display: profileImage ? 'none' : 'flex' }}
                      >
                        {teacher.name?.charAt(0)?.toUpperCase() || 'T'}
                      </div>
                    </div>
                    <div className="person-info">
                      <div className="person-name">{teacher.name}</div>
                      <div className="person-role teacher-role">Teacher</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="no-teachers">
                <p>No teachers found</p>
              </div>
            )}
          </div>
        </div>

        {/* Students Section */}
        <div className="people-section">
          <div className="section-header">
            <h4 className="section-title">Students ({classPeople.students?.length || 0})</h4>
          </div>

          {classPeople.students && classPeople.students.length > 0 ? (
            <div className="students-container">
              <div className="people-list">
                {classPeople.students.map(student => {
                  const profileImage = getProfileImage(student);
                  
                  return (
                    <div key={student._id} className="person-card student-card">
                      <div className="person-avatar">
                        {profileImage ? (
                          <img 
                            src={profileImage} 
                            alt={student.name}
                            className="avatar-image"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              const fallback = e.target.nextSibling;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className={`avatar-fallback ${profileImage ? 'hidden' : ''}`}
                          style={{ display: profileImage ? 'none' : 'flex' }}
                        >
                          {student.name?.charAt(0)?.toUpperCase() || 'S'}
                        </div>
                      </div>
                      <div className="person-info">
                        <div className="person-name">
                          {student.name}
                          {student.isMuted && <span className="muted-badge">Muted</span>}
                        </div>
                        <div className="person-email">{student.email}</div>
                      </div>
                      {isTeacher && (
                        <div className="person-actions-container">
                          <button 
                            ref={el => buttonRefs.current[student._id] = el}
                            className="actions-toggle"
                            onClick={(e) => toggleActions(student._id, e)}
                            aria-label="Student actions"
                          >
                            <FaEllipsisV />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="no-students">
              <p>No students enrolled yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Dropdown Portal - Rendered at body level */}
      {activeStudentId && activeStudent && createPortal(
        <div 
          ref={actionsDropdownRef}
          className="dropdown-portal"
          style={{
            position: 'absolute',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 99999,
          }}
        >
          <div className="actions-dropdown">
            <button 
              className="action-item"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleMute(activeStudentId, activeStudent.name, activeStudent.isMuted);
                setActiveStudentId(null);
                setActiveActions(null);
              }}
            >
              {activeStudent.isMuted ? <FaVolumeUp /> : <FaVolumeMute />}
              {activeStudent.isMuted ? 'Unmute' : 'Mute'} Student
            </button>
            <button 
              className="action-item remove"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveStudent(activeStudentId, activeStudent.name);
                setActiveStudentId(null);
                setActiveActions(null);
              }}
            >
              <FaUserMinus />
              Remove from Class
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default PeopleTab;