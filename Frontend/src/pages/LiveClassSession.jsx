// LiveClassSession.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../lib/api';

export default function LiveClassSession() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [isClassActive, setIsClassActive] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    loadExamData();
    
    // Connect to socket for live class
    const token = localStorage.getItem('token');
    const newSocket = io('http://localhost:3000', {
      auth: { token },
      query: { examId, userRole: 'live-class' }
    });
    
    setSocket(newSocket);
    
    // Socket event handlers
    newSocket.on('live-class-started', (data) => {
      setIsClassActive(true);
      setParticipants(data.participants || []);
    });
    
    newSocket.on('live-class-ended', (data) => {
      setIsClassActive(false);
      alert('Live class has ended');
      navigate('/dashboard');
    });
    
    newSocket.on('participant-joined', (data) => {
      setParticipants(prev => [...prev, data.participant]);
    });
    
    newSocket.on('participant-left', (data) => {
      setParticipants(prev => prev.filter(p => p.id !== data.participantId));
    });
    
    newSocket.on('chat-message', (data) => {
      setChatMessages(prev => [...prev, data]);
    });
    
    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [examId]);
  
  const loadExamData = async () => {
    try {
      const response = await api.get(`/exams/${examId}/details`);
      if (response.success) {
        setExam(response.data);
        
        // Check if user is teacher/host
        const classResponse = await api.get(`/class/${response.data.classId}`);
        if (classResponse.success) {
          setIsHost(classResponse.data.ownerId === response.data.createdBy);
        }
      }
    } catch (error) {
      console.error('Failed to load exam:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const startLiveClass = async () => {
    try {
      const response = await api.post(`/exams/${examId}/start-live-class`);
      if (response.success) {
        setIsClassActive(true);
        if (socket) {
          socket.emit('start-live-class', {
            examId,
            hostId: exam.createdBy
          });
        }
      }
    } catch (error) {
      console.error('Failed to start live class:', error);
    }
  };
  
  const endLiveClass = async () => {
    try {
      const response = await api.post(`/exams/${examId}/end-live-class`);
      if (response.success) {
        setIsClassActive(false);
        if (socket) {
          socket.emit('end-live-class', { examId });
        }
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Failed to end live class:', error);
    }
  };
  
  const joinLiveClass = async () => {
    try {
      const response = await api.post(`/exams/${examId}/join-live-class`);
      if (response.success) {
        setIsClassActive(true);
        if (socket) {
          socket.emit('join-live-class', {
            examId,
            userId: response.data.userId
          });
        }
      }
    } catch (error) {
      console.error('Failed to join live class:', error);
    }
  };
  
  if (loading) return <div>Loading...</div>;
  if (!exam) return <div>Exam not found</div>;
  
  return (
    <div className="live-class-container">
      <div className="live-class-header">
        <h1>{exam.title} - Live Class</h1>
        <div className="class-status">
          <span className={`status-badge ${isClassActive ? 'active' : 'inactive'}`}>
            {isClassActive ? '🔴 LIVE' : '⏸️ Not Active'}
          </span>
          <span className="participants-count">👥 {participants.length} Participants</span>
        </div>
      </div>
      
      <div className="live-class-content">
        <div className="main-content">
          {/* Video/Audio stream would go here */}
          <div className="video-container">
            <div className="placeholder-video">
              <p>🎥 Live Class in Session</p>
              <p>Participants: {participants.length}</p>
            </div>
          </div>
          
          <div className="class-controls">
            {isHost ? (
              <>
                {!isClassActive ? (
                  <button onClick={startLiveClass} className="start-class-btn">
                    🎥 Start Live Class
                  </button>
                ) : (
                  <button onClick={endLiveClass} className="end-class-btn">
                    ⏹️ End Live Class
                  </button>
                )}
              </>
            ) : (
              <>
                {isClassActive ? (
                  <button className="joined-btn" disabled>
                    ✅ Joined Live Class
                  </button>
                ) : (
                  <button onClick={joinLiveClass} className="join-class-btn">
                    🎥 Join Live Class
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        
        <div className="sidebar">
          <div className="participants-list">
            <h3>Participants ({participants.length})</h3>
            <div className="participants">
              {participants.map(participant => (
                <div key={participant.id} className="participant">
                  <span className="participant-name">{participant.name}</span>
                  {participant.role === 'host' && <span className="host-badge">👑 Host</span>}
                </div>
              ))}
            </div>
          </div>
          
          <div className="chat-section">
            <h3>Chat</h3>
            <div className="chat-messages">
              {chatMessages.map((msg, index) => (
                <div key={index} className="message">
                  <strong>{msg.sender}:</strong> {msg.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}