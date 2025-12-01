// src/pages/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer 
} from 'recharts';
import "./AdminDashboard.css";
import { getAdminStats } from "../lib/adminApi";
import StatCard from "./admin/StatCard";

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('week');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await getAdminStats(timeRange);
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  const userData = stats?.users?.growth || [];
  const examData = stats?.exams?.distribution || [];
  const classData = stats?.classes?.status || [];

  const COLORS = ['#667eea', '#00C49F', '#FF9800', '#FF8042'];

  return (
    <div className={`admin-dashboard-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar */}
      <div className="admin-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <span className="brand-icon">📊</span>
            {!sidebarCollapsed && <span className="brand-text">EduAdmin</span>}
          </div>
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>
        
        <div className="sidebar-menu">
          <div className="menu-section">
            {!sidebarCollapsed && <span className="section-label">MAIN</span>}
            <a href="#" className="menu-item active">
              <span className="menu-icon">🏠</span>
              {!sidebarCollapsed && <span>Dashboard</span>}
            </a>
            <a href="#" className="menu-item">
              <span className="menu-icon">👥</span>
              {!sidebarCollapsed && <span>Users</span>}
            </a>
            <a href="#" className="menu-item">
              <span className="menu-icon">🏫</span>
              {!sidebarCollapsed && <span>Classes</span>}
            </a>
            <a href="#" className="menu-item">
              <span className="menu-icon">📝</span>
              {!sidebarCollapsed && <span>Exams</span>}
            </a>
          </div>
          
          <div className="menu-section">
            {!sidebarCollapsed && <span className="section-label">ANALYTICS</span>}
            <a href="#" className="menu-item">
              <span className="menu-icon">📈</span>
              {!sidebarCollapsed && <span>Reports</span>}
            </a>
            <a href="#" className="menu-item">
              <span className="menu-icon">📊</span>
              {!sidebarCollapsed && <span>Analytics</span>}
            </a>
            <a href="#" className="menu-item">
              <span className="menu-icon">📋</span>
              {!sidebarCollapsed && <span>Logs</span>}
            </a>
          </div>
          
          <div className="menu-section">
            {!sidebarCollapsed && <span className="section-label">SETTINGS</span>}
            <a href="#" className="menu-item">
              <span className="menu-icon">⚙️</span>
              {!sidebarCollapsed && <span>Settings</span>}
            </a>
            <a href="#" className="menu-item">
              <span className="menu-icon">👤</span>
              {!sidebarCollapsed && <span>Profile</span>}
            </a>
          </div>
        </div>
        
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">AD</div>
            {!sidebarCollapsed && (
              <div className="user-info">
                <span className="user-name">Admin User</span>
                <span className="user-role">Super Admin</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="admin-main-content">
        {/* Top Header */}
        <div className="main-header">
          <div className="header-left">
            <h1>Dashboard Overview</h1>
            <p className="subtitle">Welcome back! Here's your platform performance summary.</p>
          </div>
          <div className="header-right">
            <div className="time-range-selector">
              <select 
                value={timeRange} 
                onChange={(e) => setTimeRange(e.target.value)}
                className="select-minimal"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
            </div>
            <button className="btn-primary" onClick={fetchStats}>
              Refresh Data
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <StatCard
            title="Total Users"
            value={stats?.users?.total || 0}
            change={stats?.users?.growthPercentage || 0}
            icon="👥"
            color="#2196F3"
          />
          <StatCard
            title="Active Classes"
            value={stats?.classes?.active || 0}
            change={stats?.classes?.growthPercentage || 0}
            icon="🏫"
            color="#4CAF50"
          />
          <StatCard
            title="Ongoing Exams"
            value={stats?.exams?.active || 0}
            change={stats?.exams?.growthPercentage || 0}
            icon="📝"
            color="#FF9800"
          />
          <StatCard
            title="System Status"
            value={stats?.system?.status || 'Good'}
            change={0}
            icon="🛡️"
            color="#9C27B0"
            isStatus={true}
          />
        </div>

        {/* Charts Section */}
        <div className="charts-section">
          <div className="section-header">
            <h2>Analytics & Insights</h2>
            <button className="text-link">View detailed reports →</button>
          </div>
          
          <div className="charts-grid">
            {/* User Growth Chart */}
            <div className="chart-card">
              <div className="chart-header">
                <h3>User Growth Trend</h3>
                <div className="chart-legend">
                  <div className="legend-item">
                    <span className="legend-dot students"></span>
                    <span>Students</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot teachers"></span>
                    <span>Teachers</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={userData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#999"
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#999"
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{
                      fontSize: '12px',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="students" 
                    stroke="#667eea" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="teachers" 
                    stroke="#00C49F" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Exam Distribution Chart */}
            <div className="chart-card">
              <div className="chart-header">
                <h3>Exam Distribution</h3>
                <span className="chart-subtitle">By subject area</span>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={examData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="#fff"
                    strokeWidth={1}
                  >
                    {examData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`${value} exams`, 'Count']}
                    contentStyle={{
                      fontSize: '12px',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Class Status Chart */}
            <div className="chart-card">
              <div className="chart-header">
                <h3>Class Status</h3>
                <span className="chart-subtitle">Active vs Inactive</span>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={classData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="status" 
                    stroke="#999"
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#999"
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{
                      fontSize: '12px',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="#667eea"
                    radius={[4, 4, 0, 0]}
                    barSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Recent Activities */}
            <div className="chart-card">
              <div className="chart-header">
                <h3>Recent Activities</h3>
                <button className="text-link">View all →</button>
              </div>
              <div className="activity-list">
                {stats?.recentActivities?.slice(0, 6).map((activity, index) => (
                  <div key={index} className="activity-item">
                    <div className="activity-icon">
                      {activity.type === 'login' ? '→' : 
                       activity.type === 'create' ? '+' : 
                       activity.type === 'update' ? '↻' : '×'}
                    </div>
                    <div className="activity-content">
                      <div className="activity-text">{activity.description}</div>
                      <div className="activity-meta">
                        <span className="activity-user">{activity.user}</span>
                        <span className="activity-time">• {activity.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions & System Status */}
        <div className="actions-section">
          <div className="actions-grid">
            <div className="quick-actions-card">
              <div className="section-header">
                <h2>Quick Actions</h2>
              </div>
              <div className="quick-actions-grid">
                <button className="quick-action-btn">
                  <span className="action-icon">+</span>
                  <div className="action-content">
                    <span className="action-title">Add User</span>
                    <span className="action-desc">Create new user account</span>
                  </div>
                </button>
                <button className="quick-action-btn">
                  <span className="action-icon">📊</span>
                  <div className="action-content">
                    <span className="action-title">Generate Report</span>
                    <span className="action-desc">Export analytics data</span>
                  </div>
                </button>
                <button className="quick-action-btn">
                  <span className="action-icon">📧</span>
                  <div className="action-content">
                    <span className="action-title">Send Announcement</span>
                    <span className="action-desc">Broadcast message</span>
                  </div>
                </button>
                <button className="quick-action-btn">
                  <span className="action-icon">⚙️</span>
                  <div className="action-content">
                    <span className="action-title">System Settings</span>
                    <span className="action-desc">Configure platform</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="system-status-card">
              <div className="section-header">
                <h2>System Status</h2>
                <span className="status-badge good">All Systems Operational</span>
              </div>
              <div className="system-status-list">
                <div className="status-item">
                  <div className="status-info">
                    <span className="status-name">Web Server</span>
                    <span className="status-value">120ms response</span>
                  </div>
                  <span className="status-indicator good"></span>
                </div>
                <div className="status-item">
                  <div className="status-info">
                    <span className="status-name">Database</span>
                    <span className="status-value">45 queries/sec</span>
                  </div>
                  <span className="status-indicator good"></span>
                </div>
                <div className="status-item">
                  <div className="status-info">
                    <span className="status-name">Storage</span>
                    <span className="status-value">85% used</span>
                  </div>
                  <span className="status-indicator warning"></span>
                </div>
                <div className="status-item">
                  <div className="status-info">
                    <span className="status-name">API Service</span>
                    <span className="status-value">99.9% uptime</span>
                  </div>
                  <span className="status-indicator good"></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;