// src/App.jsx - CORRECTED IMPORT PATHS
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ToDoPage from "./pages/ToDoPage";
import ReviewPage from "./pages/ReviewPage";
import ClassDetails from "./pages/ClassDetails";
import ExamRoomWrapper from "./pages/ExamRoomWrapper";
import ExamFormView from "./pages/ExamFormView";
import AuthSuccess from "./pages/AuthSuccess";
import QuizFormPage from "./pages/QuizFormPage";
import StudentQuizPage from "./pages/StudentQuizPage";
import TeacherExamSession from "./pages/TeacherExamSession";
import StudentExamSession from "./pages/StudentExamSession";
import ProtectedRoute from "./components/ProtectedRoute";

// Admin components - IMPORTANT: All from pages/admin/
import AdminLogin from './pages/AdminLogin';
import AdminPrivateRoute from './pages/admin/AdminPrivateRoute';
import AdminLayout from './pages/admin/AdminLayout';  // Changed from components/admin/
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminClasses from './pages/AdminClasses';
import AdminExams from './pages/AdminExams';
import AdminAdmins from './pages/AdminAdmins';
import AdminReports from './pages/AdminReports';
import AdminAuditLogs from './pages/AdminAuditLogs';
import AdminSettings from './pages/AdminSettings';
import AdminSystem from './pages/AdminSystem';
import AdminUserForm from './pages/AdminUserForm';

// You need to create these missing admin pages!
// For now, I'll comment them out or create them below
// If they don't exist yet, you'll get errors

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          {/* ✅ DEFAULT ROUTE REDIRECTS TO LOGIN */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Public routes */}
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/success" element={<AuthSuccess />} />
          
          {/* Admin Public Route */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* ✅ PROTECTED ROUTES - MAIN APP */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />

          {/* Class and Quiz Routes */}
          <Route path="/class/:classId" element={
            <ProtectedRoute>
              <ClassDetails />
            </ProtectedRoute>
          } />

          {/* Quiz Creation Routes */}
          <Route path="/class/:classId/quiz/new" element={
            <ProtectedRoute requiredRole="teacher">
              <QuizFormPage />
            </ProtectedRoute>
          } />

          <Route path="/class/:classId/quiz/:examId/edit" element={
            <ProtectedRoute requiredRole="teacher">
              <QuizFormPage />
            </ProtectedRoute>
          } />

          {/* Legacy routes for backward compatibility */}
          <Route path="/quiz-form" element={
            <ProtectedRoute requiredRole="teacher">
              <QuizFormPage />
            </ProtectedRoute>
          } />

          {/* Exam and Quiz Session Routes */}
          <Route path="/student-quiz/:examId" element={
            <ProtectedRoute requiredRole="student">
              <StudentQuizPage />
            </ProtectedRoute>
          } />

          <Route path="/teacher-exam/:examId" element={
            <ProtectedRoute requiredRole="teacher">
              <TeacherExamSession />
            </ProtectedRoute>
          } />

          <Route path="/student-exam/:examId" element={
            <ProtectedRoute requiredRole="student">
              <StudentExamSession />
            </ProtectedRoute>
          } />

          <Route path="/exam-room/:examId" element={
            <ProtectedRoute>
              <ExamRoomWrapper />
            </ProtectedRoute>
          } />

          <Route path="/exam-form/:examId?" element={
            <ProtectedRoute requiredRole="teacher">
              <ExamFormView />
            </ProtectedRoute>
          } />

          {/* Other Protected Routes */}
          <Route path="/todo" element={
            <ProtectedRoute requiredRole="student">
              <ToDoPage />
            </ProtectedRoute>
          } />

          <Route path="/review" element={
            <ProtectedRoute requiredRole="teacher">
              <ReviewPage />
            </ProtectedRoute>
          } />

          {/* ✅ ADMIN PROTECTED ROUTES - SEPARATE SECTION */}
          <Route element={<AdminPrivateRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="users/new" element={<AdminUserForm />} />
              <Route path="users/:id/edit" element={<AdminUserForm />} />
              {/* Comment out missing pages for now */}
              <Route path="classes" element={<AdminClasses />} />
              <Route path="exams" element={<AdminExams />} />
              <Route path="admins" element={<AdminAdmins />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="audit-logs" element={<AdminAuditLogs />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="system" element={<AdminSystem />} /> 
            </Route>
          </Route>

          {/* Catch all route - redirect to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;