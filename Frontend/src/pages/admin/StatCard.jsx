// src/components/admin/StatCard.jsx
import React from 'react';
import "./StatCard.css";

const StatCard = ({ title, value, change, icon, color, isStatus = false }) => {
  const changeType = change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral';
  const statusClass = typeof value === 'string' && value.toLowerCase();
  
  return (
    <div className="stat-card-minimal" data-color={color}>
      <div className="stat-main">
        <div className="stat-icon-wrapper">
          <div className="stat-icon-minimal">{icon}</div>
        </div>
        
        <div className="stat-content-minimal">
          <div className="stat-value-minimal">{value}</div>
          <span className="stat-title-minimal">{title}</span>
        </div>
      </div>
      
      <div className="stat-indicator">
        {!isStatus ? (
          <div className={`stat-change-minimal ${changeType}`}>
            {change > 0 ? '+' : ''}{change}%
          </div>
        ) : (
          <div className={`status-indicator-minimal ${statusClass}`}>
            <span className="status-dot-minimal"></span>
            {value}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;