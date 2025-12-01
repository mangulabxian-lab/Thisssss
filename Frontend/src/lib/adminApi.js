// src/lib/adminApi.js - Make sure it looks like this
import axios from "axios";

// Use import.meta.env NOT process.env
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const adminApi = axios.create({
  baseURL: API_BASE_URL + "/admin",
  withCredentials: true,
  timeout: 10000,
});

// SINGLE Request interceptor
adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("adminToken");
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor for handling auth errors
adminApi.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      console.log("🔐 Admin authentication failed, redirecting to login");
      localStorage.removeItem("adminToken");
      localStorage.removeItem("admin");
      window.location.href = "/admin/login";
    }
    return Promise.reject(error);
  }
);

// ===== ADMIN AUTH FUNCTIONS =====
export const adminLogin = async (email, password) => {
  const response = await adminApi.post("/auth/login", { email, password });
  return response;
};

export const verify2FA = async (email, token) => {
  const response = await adminApi.post("/auth/verify-2fa", { email, token });
  return response;
};

export const setup2FA = async () => {
  const response = await adminApi.post("/auth/setup-2fa");
  return response;
};

export const toggle2FA = async (token, enable) => {
  const response = await adminApi.post("/auth/toggle-2fa", { token, enable });
  return response;
};

export const getAdminProfile = async () => {
  const response = await adminApi.get("/auth/profile");
  return response;
};

export const updateAdminProfile = async (data) => {
  const response = await adminApi.put("/auth/profile", data);
  return response;
};

export const adminLogout = async () => {
  const response = await adminApi.post("/auth/logout");
  return response;
};

// ===== ADMIN DASHBOARD FUNCTIONS =====
export const getAdminStats = async (timeRange = "week") => {
  const response = await adminApi.get("/dashboard/stats", { params: { timeRange } });
  return response;
};

// ===== USER MANAGEMENT =====
export const getUsers = async (params = {}) => {
  const response = await adminApi.get("/dashboard/users", { params });
  return response;
};

export const getUserDetails = async (userId) => {
  const response = await adminApi.get(`/dashboard/users/${userId}`);
  return response;
};

export const updateUser = async (userId, data) => {
  const response = await adminApi.put(`/dashboard/users/${userId}`, data);
  return response;
};

export const deleteUser = async (userId) => {
  const response = await adminApi.delete(`/dashboard/users/${userId}`);
  return response;
};

export const createUser = async (data) => {
  const response = await adminApi.post("/dashboard/users", data);
  return response;
};

// ===== CLASS MANAGEMENT =====
export const getClasses = async (params = {}) => {
  const response = await adminApi.get("/dashboard/classes", { params });
  return response;
};

export const getClassDetails = async (classId) => {
  const response = await adminApi.get(`/dashboard/classes/${classId}`);
  return response;
};

export const updateClass = async (classId, data) => {
  const response = await adminApi.put(`/dashboard/classes/${classId}`, data);
  return response;
};

// ===== EXAM MANAGEMENT =====
export const getExams = async (params = {}) => {
  const response = await adminApi.get("/dashboard/exams", { params });
  return response;
};

export const getExamDetails = async (examId) => {
  const response = await adminApi.get(`/dashboard/exams/${examId}/details`);
  return response;
};

// ===== ADMIN MANAGEMENT =====
export const getAdmins = async (params = {}) => {
  const response = await adminApi.get("/dashboard/admins", { params });
  return response;
};

export const createAdmin = async (data) => {
  const response = await adminApi.post("/dashboard/admins", data);
  return response;
};

export const updateAdmin = async (adminId, data) => {
  const response = await adminApi.put(`/dashboard/admins/${adminId}`, data);
  return response;
};

// ===== AUDIT LOGS =====
export const getAuditLogs = async (params = {}) => {
  const response = await adminApi.get("/dashboard/audit-logs", { params });
  return response;
};

// ===== REPORTS =====
export const generateReport = async (data) => {
  const response = await adminApi.post("/dashboard/reports/generate", data);
  return response;
};

export const getReports = async (params = {}) => {
  const response = await adminApi.get("/dashboard/reports", { params });
  return response;
};

export const getReport = async (reportId) => {
  const response = await adminApi.get(`/dashboard/reports/${reportId}`);
  return response;
};

// ===== SETTINGS =====
export const getSettings = async () => {
  const response = await adminApi.get("/dashboard/settings");
  return response;
};

export const updateSetting = async (key, value) => {
  const response = await adminApi.put(`/dashboard/settings/${key}`, { value });
  return response;
};

// ===== SYSTEM =====
export const getSystemInfo = async () => {
  const response = await adminApi.get("/dashboard/system/info");
  return response;
};

export const clearCache = async () => {
  const response = await adminApi.post("/dashboard/system/clear-cache");
  return response;
};

// DEFAULT EXPORT
export default adminApi;