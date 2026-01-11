// backend/services/examTimerService.js - SERVER-AUTHORITATIVE TIMER
const Exam = require('../models/Exam');

class ExamTimerService {
  static async startExamTimer(examId, durationInMinutes) {
    const exam = await Exam.findById(examId);
    if (!exam) throw new Error('Exam not found');
    
    const now = new Date();
    const endTime = new Date(now.getTime() + (durationInMinutes * 60000));
    
    exam.examSession = {
      startTime: now,
      endTime: endTime,
      duration: durationInMinutes * 60, // seconds
      isActive: true,
      timeExtension: 0,
      pausedAt: null,
      pausedDuration: 0,
      serverRemainingTime: durationInMinutes * 60
    };
    
    await exam.save();
    
    // Schedule auto-end
    this.scheduleAutoEnd(examId, durationInMinutes * 60000);
    
    return {
      success: true,
      startTime: now,
      endTime: endTime,
      duration: durationInMinutes,
      examId: exam._id
    };
  }
  
  static async getServerRemainingTime(examId, studentId = null) {
    const exam = await Exam.findById(examId);
    if (!exam || !exam.examSession || !exam.examSession.isActive) {
      return { hasTime: false, remaining: 0, isActive: false };
    }
    
    const now = new Date();
    const session = exam.examSession;
    
    // If paused, return paused time
    if (session.pausedAt) {
      return {
        hasTime: true,
        remaining: session.serverRemainingTime || 0,
        isActive: false,
        isPaused: true,
        pausedAt: session.pausedAt
      };
    }
    
    // Calculate real server remaining time
    const endTime = new Date(session.endTime);
    let remainingMs = endTime - now;
    
    if (remainingMs <= 0) {
      // Time's up - auto end exam
      await this.endExamTimer(examId);
      return { hasTime: false, remaining: 0, isActive: false, ended: true };
    }
    
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    
    // Update server remaining time
    session.serverRemainingTime = remainingSeconds;
    await exam.save();
    
    return {
      hasTime: true,
      remaining: remainingSeconds,
      isActive: true,
      endTime: endTime,
      serverTime: now
    };
  }
  
  static async pauseExamTimer(examId) {
    const exam = await Exam.findById(examId);
    if (!exam || !exam.examSession || !exam.examSession.isActive) {
      throw new Error('Exam not active');
    }
    
    const now = new Date();
    exam.examSession.pausedAt = now;
    exam.examSession.isActive = false;
    await exam.save();
    
    return { success: true, pausedAt: now };
  }
  
  static async resumeExamTimer(examId) {
    const exam = await Exam.findById(examId);
    if (!exam || !exam.examSession || !exam.examSession.pausedAt) {
      throw new Error('Exam not paused');
    }
    
    const session = exam.examSession;
    const now = new Date();
    
    // Calculate paused duration
    const pausedDuration = Math.floor((now - session.pausedAt) / 1000);
    session.pausedDuration += pausedDuration;
    
    // Adjust end time
    const newEndTime = new Date(session.endTime.getTime() + (pausedDuration * 1000));
    session.endTime = newEndTime;
    session.pausedAt = null;
    session.isActive = true;
    
    await exam.save();
    
    // Re-schedule auto-end
    const remainingMs = newEndTime - now;
    this.scheduleAutoEnd(examId, remainingMs);
    
    return {
      success: true,
      resumedAt: now,
      newEndTime: newEndTime,
      timeAdded: pausedDuration
    };
  }
  
  static async addTimeToExam(examId, additionalMinutes) {
    const exam = await Exam.findById(examId);
    if (!exam || !exam.examSession) {
      throw new Error('Exam not found');
    }
    
    const session = exam.examSession;
    const additionalMs = additionalMinutes * 60000;
    
    // Extend end time
    session.endTime = new Date(session.endTime.getTime() + additionalMs);
    session.timeExtension += additionalMinutes;
    session.serverRemainingTime += (additionalMinutes * 60);
    
    await exam.save();
    
    // Reschedule auto-end
    const now = new Date();
    const remainingMs = session.endTime - now;
    this.scheduleAutoEnd(examId, remainingMs);
    
    return {
      success: true,
      additionalMinutes,
      newEndTime: session.endTime,
      totalExtension: session.timeExtension
    };
  }
  
  static async scheduleAutoEnd(examId, durationMs) {
    // Clear any existing timeout
    if (global.examTimeouts && global.examTimeouts[examId]) {
      clearTimeout(global.examTimeouts[examId]);
    }
    
    // Schedule auto-end
    global.examTimeouts = global.examTimeouts || {};
    global.examTimeouts[examId] = setTimeout(async () => {
      await this.endExamTimer(examId);
      
      // Notify via socket
      const io = require('../index').io;
      io.to(`exam-${examId}`).emit('exam-auto-ended', {
        examId,
        reason: 'time_expired',
        timestamp: new Date().toISOString()
      });
    }, durationMs);
  }
  
  static async endExamTimer(examId) {
    const exam = await Exam.findById(examId);
    if (!exam) return;
    
    if (exam.examSession) {
      exam.examSession.isActive = false;
      await exam.save();
    }
    
    // Clear timeout
    if (global.examTimeouts && global.examTimeouts[examId]) {
      clearTimeout(global.examTimeouts[examId]);
      delete global.examTimeouts[examId];
    }
    
    return { success: true, endedAt: new Date() };
  }
  
  static async getExamStatus(examId, studentId) {
    const exam = await Exam.findById(examId);
    if (!exam) return { notFound: true };
    
    // Check student-specific time limit if exists
    if (studentId && exam.studentTimeLimits) {
      const studentLimit = exam.studentTimeLimits.find(
        limit => limit.studentId.toString() === studentId.toString()
      );
      
      if (studentLimit && studentLimit.isTimeLimitStarted) {
        const now = new Date();
        const remainingMs = studentLimit.endTime - now;
        const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
        
        return {
          hasTime: remainingSeconds > 0,
          remaining: remainingSeconds,
          isActive: !studentLimit.isTimeLimitExpired,
          isStudentSpecific: true,
          endTime: studentLimit.endTime
        };
      }
    }
    
    // Return general exam timer
    return await this.getServerRemainingTime(examId, studentId);
  }
}

module.exports = ExamTimerService;