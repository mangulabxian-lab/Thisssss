import React, { useState, useEffect, useRef } from "react";
import { getClassPendingExams } from "../lib/api";

const ClassCard = ({
  classData,
  handleSelectClass,
  toggleMenu,
  showMenuForClass,
  setShowMenuForClass,
  confirmArchive,
  confirmUnenroll,
  confirmDelete,
  userId
}) => {
  const isTeacher = classData.userRole === "teacher";
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingExams, setPendingExams] = useState([]);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [loadingPending, setLoadingPending] = useState(false);
  
  const teacherImage =
    classData.ownerId?.profileImage ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      classData.ownerId?.name || "Teacher"
    )}&background=6b7280&color=fff`;

  // Fetch pending exams when component mounts
  useEffect(() => {
    const fetchPendingExams = async () => {
      // Only fetch for students, not teachers
      if (!isTeacher && classData._id) {
        setLoadingPending(true);
        try {
          const response = await getClassPendingExams(classData._id);
          if (response.success) {
            setPendingCount(response.data.pendingCount || 0);
            setPendingExams(response.data.pendingExams || []);
          }
        } catch (error) {
          console.error('Error fetching pending exams:', error);
        } finally {
          setLoadingPending(false);
        }
      }
    };

    fetchPendingExams();
    
    // Set up polling for updates every 30 seconds
    const interval = setInterval(fetchPendingExams, 30000);
    
    return () => clearInterval(interval);
  }, [classData._id, isTeacher]);

  // Handle card click
  const handleCardClick = () => {
    if (pendingCount > 0 && !isTeacher) {
      setShowPendingModal(true);
    } else {
      handleSelectClass(classData);
    }
  };

  // Handle start exam from modal
  const handleStartExam = (exam) => {
    console.log('Starting exam:', exam);
    setShowPendingModal(false);
    // Navigate to the exam
    if (exam.examType === 'live-class' && exam.isActive) {
      window.location.href = `/student-quiz/${exam.examId}`;
    } else {
      window.location.href = `/student-quiz/${exam.examId}`;
    }
  };

  // Pending exams modal
  const PendingExamsModal = () => {
    if (!showPendingModal || pendingExams.length === 0) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="bg-[#56586a] text-white px-6 py-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">{classData.name}</h2>
              <button
                onClick={() => setShowPendingModal(false)}
                className="text-white hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm opacity-90 mt-1">
              You have {pendingCount} pending {pendingCount === 1 ? 'exam' : 'exams'}
            </p>
          </div>

          {/* Exams List */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            <div className="space-y-4">
              {pendingExams.map((exam, index) => (
                <div key={exam.examId} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {exam.examType === 'live-class' ? (
                          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                            LIVE CLASS
                          </span>
                        ) : (
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                            QUIZ
                          </span>
                        )}
                        {exam.scheduledAt && (
                          <span className="text-xs text-gray-500">
                            {new Date(exam.scheduledAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-gray-900">{exam.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {exam.examType === 'live-class' ? 
                          'Join live class session' : 
                          `${exam.timeLimit || 60} minute quiz`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleStartExam(exam)}
                      className={`ml-4 px-4 py-2 rounded-lg text-sm font-medium ${
                        exam.examType === 'live-class' && exam.isActive
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {exam.examType === 'live-class' && exam.isActive ? 'Join Now' : 'Start'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* View All Button */}
            <button
              onClick={() => {
                setShowPendingModal(false);
                handleSelectClass(classData);
              }}
              className="w-full mt-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              View All Classwork
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className="w-[320px] rounded-3xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer bg-transparent relative"
      >
        {/* ================= HEADER ================= */}
        <div className="relative bg-[#56586a] text-white px-5 pt-5 pb-14 rounded-t-3xl">
          <h2 className="text-lg font-semibold tracking-wide truncate">
            {classData.name}
          </h2>
          <p className="text-xs opacity-90 truncate">
            {classData.section || "BSCE 4-A"}
          </p>

          {/* PENDING EXAMS BADGE - Only for students */}
          {!isTeacher && pendingCount > 0 && (
            <div className="absolute top-2 left-2 z-30">
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                {pendingCount} {pendingCount === 1 ? 'Pending' : 'Pending'}
              </span>
            </div>
          )}

          {/* OPTIONS MENU */}
          <div className="absolute top-3 right-3 z-40">
            <button
              className="p-2 rounded-full hover:bg-white/10"
              onClick={(e) => toggleMenu(classData._id, e)}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>

            {showMenuForClass === classData._id && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 text-gray-700 z-50">
                {isTeacher ? (
                  <>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50"
                      onClick={(e) => confirmArchive(classData, e)}
                    >
                      Archive class
                    </button>

                    <hr className="my-1" />

                    <button
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      onClick={(e) => confirmDelete(classData._id, e)}
                    >
                      Delete class
                    </button>
                  </>
                ) : (
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    onClick={(e) => confirmUnenroll(classData, e)}
                  >
                    Unenroll from class
                  </button>
                )}
              </div>
            )}
          </div>

          {/* TEACHER AVATAR - FIXED BACKGROUND */}
          <div className="absolute -bottom-8 right-5 w-16 h-16 rounded-full border-4 border-white shadow-md overflow-hidden">
            <img
              src={teacherImage}
              alt="Teacher"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* ================= BODY ================= */}
        <div className="bg-white rounded-b-3xl px-6 pt-10 pb-6 min-h-[120px] flex flex-col">
          {/* CONDITIONAL LAYOUT */}
          {!isTeacher && pendingExams.length > 0 ? (
            // SHOW PENDING EXAMS LAYOUT (when there ARE pending exams)
            <div className="flex-1">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Pending Exams
                </span>
                <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                  {pendingCount} pending
                </span>
              </div>
              <div className="space-y-2">
                {pendingExams.slice(0, 2).map((exam, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      exam.examType === 'live-class' && exam.isActive ? 'bg-red-500 animate-pulse' : 'bg-blue-500'
                    }`}></div>
                    <span className="text-sm text-gray-700 truncate">
                      {exam.title}
                    </span>
                    {exam.examType === 'live-class' && exam.isActive && (
                      <span className="text-xs text-red-600 font-medium ml-auto">
                        LIVE
                      </span>
                    )}
                  </div>
                ))}
                {pendingExams.length > 2 && (
                  <div className="text-xs text-gray-500 text-center pt-1">
                    +{pendingExams.length - 2} more
                  </div>
                )}
              </div>
            </div>
          ) : (
            // SHOW SIMPLE "No exams yet" LAYOUT (when there are NO pending exams)
            <div className="flex-1 flex flex-col items-center justify-center">
              <svg 
                className="w-12 h-12 text-gray-300 mb-2" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                />
              </svg>
              <span className="text-gray-400 text-sm">
                No exams yet
              </span>
              {isTeacher && (
                <button 
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectClass(classData);
                  }}
                >
                  Create first exam
                </button>
              )}
            </div>
          )}
          
          {/* For Teachers: Also show their created exams if any */}
          {isTeacher && classData.exams && classData.exams.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">
                  Your Exams
                </span>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                  {classData.exams.length} created
                </span>
              </div>
              <div className="space-y-1">
                {classData.exams.slice(0, 2).map((exam, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-600 truncate">
                      {exam.title || `Exam ${index + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pending Exams Modal */}
      {PendingExamsModal()}
    </>
  );
};

export default ClassCard;