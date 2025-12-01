// Frontend/src/components/PeopleTab.jsx
import { useState, useEffect } from 'react';
import { FaEllipsisV, FaEnvelope, FaUserMinus, FaVolumeMute, FaVolumeUp } from 'react-icons/fa';
import api from '../lib/api';
import './PeopleTab.css';

// ✅ UPDATED AVATAR COMPONENT
const PersonAvatar = ({ user, size = 40 }) => {
  const [imageError, setImageError] = useState(false);
  
  const getAvatarUrl = (user) => {
    // ✅ PRIORITIZE GOOGLE PROFILE IMAGE
    if (user.profileImage && user.profileImage.trim() !== '') {
      return user.profileImage;
    }
    // Fallback to avatar if exists
    if (user.avatar && user.avatar.trim() !== '') {
      return user.avatar;
    }
    // Final fallback to initials
    return null;
  };

  const avatarUrl = getAvatarUrl(user);
  const initials = user.name ? user.name.charAt(0).toUpperCase() : '?';

  const handleImageError = () => {
    console.log('❌ PeopleTab avatar failed to load:', avatarUrl);
    setImageError(true);
  };

  return (
    <div 
      className="person-avatar" 
      style={{ width: size, height: size }}
    >
      {avatarUrl && !imageError ? (
        <img 
          src={avatarUrl} 
          alt={user.name}
          className="avatar-image"
          onError={handleImageError}
        />
      ) : (
        <div className="avatar-fallback">
          {initials}
        </div>
      )}
    </div>
  );
};

const PeopleTab = ({ classId }) => {
  const [peopleData, setPeopleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeActions, setActiveActions] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [emailData, setEmailData] = useState({ subject: '', message: '' });

  useEffect(() => {
    fetchPeopleData();
  }, [classId]);

  // ✅ UPDATED: Better debugging for profile images
  const fetchPeopleData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/student-management/${classId}/students`);

      console.log('👥 People data API response:', response.data);

      if (response.data.success) {
        const peopleData = response.data.data;
        
        console.log('📊 People Tab - Profile Image Analysis:', {
          teachers: peopleData.teachers?.length || 0,
          students: peopleData.students?.length || 0,
          teachersWithProfiles: peopleData.teachers?.filter(t => t.profileImage)?.length || 0,
          studentsWithProfiles: peopleData.students?.filter(s => s.profileImage)?.length || 0,
          teacherDetails: peopleData.teachers?.map(t => ({
            name: t.name,
            email: t.email,
            profileImage: t.profileImage,
            hasImage: !!t.profileImage
          })),
          studentDetails: peopleData.students?.map(s => ({
            name: s.name,
            email: s.email,
            profileImage: s.profileImage,
            hasImage: !!s.profileImage
          }))
        });
        
        setPeopleData(peopleData);
      } else {
        setError(response.data.message);
      }
    } catch (err) {
      setError('Failed to load people data');
      console.error('Error fetching people data:', err);
      console.error('Error details:', err.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const toggleActions = (personId) => {
    setActiveActions(activeActions === personId ? null : personId);
  };

  const handleRemoveStudent = async (studentId, studentName) => {
    if (!window.confirm(`Are you sure you want to remove ${studentName} from this class?`)) {
      return;
    }

    try {
      const response = await api.delete(`/student-management/${classId}/students/${studentId}`);

      if (response.data.success) {
        alert('Student removed successfully');
        fetchPeopleData();
      } else {
        alert('Failed to remove student: ' + response.data.message);
      }
    } catch (err) {
      alert('Failed to remove student');
      console.error('Error removing student:', err);
    }
  };

  const handleToggleMute = async (studentId, studentName, isCurrentlyMuted) => {
    try {
      const response = await api.patch(`/student-management/${classId}/students/${studentId}/mute`);

      if (response.data.success) {
        alert(`Student ${isCurrentlyMuted ? 'unmuted' : 'muted'} successfully`);
        fetchPeopleData();
      } else {
        alert('Failed to update student: ' + response.data.message);
      }
    } catch (err) {
      alert('Failed to update student');
      console.error('Error toggling mute:', err);
    }
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const selectAllStudents = () => {
    if (selectedStudents.length === peopleData.students.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(peopleData.students.map(student => student._id));
    }
  };

  const handleEmailStudents = async () => {
    if (!emailData.subject.trim() || !emailData.message.trim()) {
      alert('Please enter both subject and message');
      return;
    }

    try {
      const response = await api.post(`/student-management/${classId}/email-students`, {
        studentIds: selectedStudents,
        subject: emailData.subject,
        message: emailData.message
      });

      if (response.data.success) {
        alert(`Email prepared for ${response.data.data.recipients} students`);
        setShowEmailModal(false);
        setSelectedStudents([]);
        setEmailData({ subject: '', message: '' });
      } else {
        alert('Failed to send emails: ' + response.data.message);
      }
    } catch (err) {
      alert('Failed to send emails');
      console.error('Error sending emails:', err);
    }
  };

  if (loading) return <div className="loading">Loading people...</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!peopleData) return <div className="error-message">No data available</div>;

  return (
    <div className="people-tab">
      {/* Teachers Section */}
      <section className="people-section">
        <h3 className="section-title">Teachers</h3>
        <div className="people-list">
          {peopleData.teachers && peopleData.teachers.length > 0 ? (
            peopleData.teachers.map(teacher => (
              <div key={teacher._id} className="person-card teacher-card">
                {/* ✅ UPDATED: Using PersonAvatar component */}
                <PersonAvatar user={teacher} size={44} />
                <div className="person-info">
                  <div className="person-name">{teacher.name}</div>
                  <div className="person-email">{teacher.email}</div>
                  <div className="person-role teacher-role">Teacher</div>
                </div>
              </div>
            ))
          ) : (
            <div className="no-teachers">
              <p>No teachers found</p>
            </div>
          )}
        </div>
      </section>

      {/* Students Section */}
      <section className="people-section">
        <div className="section-header">
          <h3 className="section-title">Students ({peopleData.students?.length || 0})</h3>
          {peopleData.students && peopleData.students.length > 0 && (
            <div className="bulk-actions">
              <button
                className="bulk-action-btn"
                onClick={() => setShowEmailModal(true)}
              >
                <FaEnvelope /> Email Students
              </button>
            </div>
          )}
        </div>

        {peopleData.students && peopleData.students.length > 0 ? (
          <div className="students-container">
            <div className="bulk-selection-header">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedStudents.length === peopleData.students.length}
                  onChange={selectAllStudents}
                />
                Select All
              </label>
              <span className="selected-count">
                {selectedStudents.length} selected
              </span>
            </div>

            <div className="people-list">
              {peopleData.students.map(student => (
                <div key={student._id} className="person-card student-card">
                  <div className="student-select">
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(student._id)}
                      onChange={() => toggleStudentSelection(student._id)}
                    />
                  </div>

                  {/* ✅ UPDATED: Using PersonAvatar component */}
                  <PersonAvatar user={student} size={44} />

                  <div className="person-info">
                    <div className="person-name">
                      {student.name}
                      {student.isMuted && <span className="muted-badge">Muted</span>}
                    </div>
                    <div className="person-email">{student.email}</div>
                    <div className="person-meta">
                      Joined {new Date(student.joinedAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="person-actions">
                    <button
                      className="actions-toggle"
                      onClick={() => toggleActions(student._id)}
                    >
                      <FaEllipsisV />
                    </button>

                    {activeActions === student._id && (
                      <div className="actions-dropdown">
                        <button
                          className="action-item"
                          onClick={() => handleToggleMute(student._id, student.name, student.isMuted)}
                        >
                          {student.isMuted ? <FaVolumeUp /> : <FaVolumeMute />}
                          {student.isMuted ? 'Unmute' : 'Mute'} Student
                        </button>
                        <button
                          className="action-item remove"
                          onClick={() => handleRemoveStudent(student._id, student.name)}
                        >
                          <FaUserMinus />
                          Remove from Class
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h4>No Students Yet</h4>
            <p>Students will appear here once they join your class using the class code.</p>
          </div>
        )}
      </section>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Email Students</h3>
              <button
                className="close-btn"
                onClick={() => setShowEmailModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>Sending to {selectedStudents.length} selected students</p>
              <div className="form-group">
                <label>Subject</label>
                <input
                  type="text"
                  placeholder="Enter email subject"
                  value={emailData.subject}
                  onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Message</label>
                <textarea
                  placeholder="Enter your message"
                  rows="6"
                  value={emailData.message}
                  onChange={(e) => setEmailData(prev => ({ ...prev, message: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowEmailModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleEmailStudents}
                disabled={!emailData.subject.trim() || !emailData.message.trim()}
              >
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PeopleTab;