import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminLogin.css';
import { adminLogin, verify2FA } from '../lib/adminApi';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!requires2FA) {
        const response = await adminLogin(email, password);
        
        if (response.requires2FA) {
          setRequires2FA(true);
        } else {
          localStorage.setItem('adminToken', response.token);
          localStorage.setItem('admin', JSON.stringify(response.admin));
          navigate('/admin/dashboard');
        }
      } else {
        const response = await verify2FA(email, token);
        localStorage.setItem('adminToken', response.token);
        localStorage.setItem('admin', JSON.stringify(response.admin));
        navigate('/admin/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-box">
        <div className="admin-login-header">
          <h1>Admin Portal</h1>
          <p>E-Learning Management System</p>
        </div>
        
        <form onSubmit={handleSubmit} className="admin-login-form">
          {error && <div className="alert alert-danger">{error}</div>}
          
          {!requires2FA ? (
            <>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@example.com"
                />
              </div>
              
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>
            </>
          ) : (
            <div className="form-group">
              <label>2FA Token</label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                placeholder="Enter 6-digit token"
                maxLength="6"
              />
              <small className="text-muted">
                Enter the code from your authenticator app
              </small>
            </div>
          )}
          
          <button 
            type="submit" 
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? 'Logging in...' : requires2FA ? 'Verify' : 'Login'}
          </button>
          
          {requires2FA && (
            <button
              type="button"
              className="btn btn-link btn-block"
              onClick={() => setRequires2FA(false)}
            >
              Back to login
            </button>
          )}
        </form>
        
        <div className="admin-login-footer">
          <p>© {new Date().getFullYear()} E-Learning System</p>
          {/* FIXED: Use import.meta.env or just hardcode */}
          <p className="text-muted">v1.0.0</p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;