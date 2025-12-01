// Frontend/src/pages/AdminUserForm.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createUser, updateUser, getUserDetails } from '../lib/adminApi';


const AdminUserForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'student',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (isEditMode) {
      fetchUserDetails();
    }
  }, [id]);

  const fetchUserDetails = async () => {
    try {
      const user = await getUserDetails(id);
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        password: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isEditMode) {
        await updateUser(id, formData);
        alert('User updated successfully!');
      } else {
        if (formData.password !== formData.confirmPassword) {
          alert('Passwords do not match!');
          return;
        }
        await createUser(formData);
        alert('User created successfully!');
      }
      navigate('/admin/users');
    } catch (error) {
      alert(error.response?.data?.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-user-form">
      <h1>{isEditMode ? 'Edit User' : 'Create New User'}</h1>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Full Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            required
          />
        </div>

        <div className="form-group">
          <label>Email *</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            required
          />
        </div>

        <div className="form-group">
          <label>Role *</label>
          <select
            value={formData.role}
            onChange={(e) => setFormData({...formData, role: e.target.value})}
            required
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>
        </div>

        <div className="form-group">
          <label>{isEditMode ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            required={!isEditMode}
          />
        </div>

        {!isEditMode && (
          <div className="form-group">
            <label>Confirm Password *</label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
              required
            />
          </div>
        )}

        <div className="form-actions">
          <button type="submit" disabled={loading}>
            {loading ? 'Saving...' : isEditMode ? 'Update User' : 'Create User'}
          </button>
          <button type="button" onClick={() => navigate('/admin/users')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminUserForm;