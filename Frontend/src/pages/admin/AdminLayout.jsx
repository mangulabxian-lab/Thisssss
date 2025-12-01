// src/layouts/AdminLayout.jsx
import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import './AdminLayout.css';

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/admin/dashboard' },
    { id: 'users', label: 'Users', icon: '👥', path: '/admin/users' },
    { id: 'classes', label: 'Classes', icon: '🏫', path: '/admin/classes' },
    { id: 'exams', label: 'Exams', icon: '📝', path: '/admin/exams' },
    { id: 'reports', label: 'Reports', icon: '📈', path: '/admin/reports' },
    { id: 'settings', label: 'Settings', icon: '⚙️', path: '/admin/settings' },
  ];

  const quickActions = [
    { label: 'Add User', icon: '👤', action: () => console.log('Add User') },
    { label: 'Create Exam', icon: '📋', action: () => console.log('Create Exam') },
    { label: 'Send Alert', icon: '🔔', action: () => console.log('Send Alert') },
    { label: 'View Logs', icon: '📊', action: () => console.log('View Logs') },
  ];

  const handleNavigation = (path) => {
    navigate(path);
  };

  const isActive = (path) => {
    return location.pathname.includes(path.split('/')[2]);
  };

  return (
    <div className={`admin-layout ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-icon">🎯</div>
            {sidebarOpen && <h2 className="brand-text">ExamPro Admin</h2>}
          </div>
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? '‹' : '›'}
          </button>
        </div>

        <div className="sidebar-content">
          {/* Navigation Menu */}
          <nav className="sidebar-nav">
            <div className="nav-section">
              <h3 className="section-title">MAIN MENU</h3>
              <ul className="nav-list">
                {navItems.map((item) => (
                  <li key={item.id}>
                    <button
                      className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                      onClick={() => handleNavigation(item.path)}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      {sidebarOpen && <span className="nav-label">{item.label}</span>}
                      {isActive(item.path) && <span className="active-indicator"></span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick Actions */}
            <div className="nav-section">
              <h3 className="section-title">QUICK ACTIONS</h3>
              <div className="quick-actions-grid">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    className="quick-action-btn"
                    onClick={action.action}
                    title={action.label}
                  >
                    <span className="action-icon">{action.icon}</span>
                    {sidebarOpen && <span className="action-label">{action.label}</span>}
                  </button>
                ))}
              </div>
            </div>
          </nav>

          {/* User Profile */}
          <div className="user-profile">
            <div className="profile-avatar">
              <span className="avatar-text">AD</span>
            </div>
            {sidebarOpen && (
              <div className="profile-info">
                <h4 className="profile-name">Admin User</h4>
                <p className="profile-role">Super Administrator</p>
                <button className="profile-settings">
                  <span className="settings-icon">⚙️</span>
                  Account Settings
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-content-wrapper">
        {/* Top Header */}
        <header className="main-header">
          <div className="header-left">
            <h1 className="page-title">
              {navItems.find(item => isActive(item.path))?.label || 'Dashboard'}
            </h1>
            <p className="page-subtitle">Welcome back! Here's what's happening today.</p>
          </div>
          
          <div className="header-right">
            <div className="search-bar">
              <span className="search-icon">🔍</span>
              <input 
                type="text" 
                placeholder="Search anything..." 
                className="search-input"
              />
            </div>
            
            <div className="header-actions">
              <button className="header-action" title="Notifications">
                <span className="action-icon">🔔</span>
                <span className="notification-badge">3</span>
              </button>
              <button className="header-action" title="Messages">
                <span className="action-icon">💬</span>
              </button>
              <button className="header-action" title="Help">
                <span className="action-icon">❓</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="content-area">
          <div className="content-container">
            <Outlet />
          </div>
        </main>

        {/* Footer */}
        <footer className="main-footer">
          <div className="footer-content">
            <div className="footer-left">
              <span className="copyright">© 2024 ExamPro Admin Dashboard</span>
              <div className="footer-links">
                <a href="#" className="footer-link">Privacy Policy</a>
                <a href="#" className="footer-link">Terms of Service</a>
                <a href="#" className="footer-link">Support</a>
              </div>
            </div>
            <div className="footer-right">
              <span className="system-status">
                <span className="status-indicator active"></span>
                System Status: Operational
              </span>
              <span className="version">v2.4.1</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default AdminLayout;