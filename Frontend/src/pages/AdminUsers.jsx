import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminUsers.css';
import { 
  getUsers, 
  getUserDetails, 
  updateUser, 
  deleteUser 
} from '../lib/adminApi';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    role: '',
    search: '',
    status: ''
  });
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
  }, [filters]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await getUsers(filters);
      setUsers(response.users);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (userId) => {
    try {
      const user = await getUserDetails(userId);
      setSelectedUser(user);
      setModalOpen(true);
    } catch (error) {
      console.error('Failed to fetch user details:', error);
    }
  };

  const handleUpdateUser = async (userId, updates) => {
    try {
      await updateUser(userId, updates);
      fetchUsers();
      if (selectedUser?._id === userId) {
        setSelectedUser({ ...selectedUser, ...updates });
      }
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await deleteUser(userId);
      fetchUsers();
      if (selectedUser?._id === userId) {
        setModalOpen(false);
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (page) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: 'success',
      inactive: 'warning',
      suspended: 'danger',
      deleted: 'secondary'
    };
    return badges[status] || 'secondary';
  };

  const getRoleBadge = (role) => {
    const badges = {
      teacher: 'primary',
      student: 'info',
      admin: 'dark'
    };
    return badges[role] || 'secondary';
  };

  return (
    <div className="admin-users">
      <div className="page-header">
        <h1>User Management</h1>
        <button 
          className="btn btn-primary"
          onClick={() => navigate('/admin/users/new')}
        >
          + Add User
        </button>
      </div>

      {/* Filters */}
      <div className="filters-card">
        <div className="filter-row">
          <div className="filter-group">
            <label>Role</label>
            <select
              value={filters.role}
              onChange={(e) => handleFilterChange('role', e.target.value)}
              className="form-select"
            >
              <option value="">All Roles</option>
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="form-select"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Search by name or email..."
              className="form-control"
            />
          </div>

          <div className="filter-group">
            <label>Items per page</label>
            <select
              value={filters.limit}
              onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
              className="form-select"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="table-card">
        {loading ? (
          <div className="loading">Loading users...</div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user._id}>
                      <td>
                        <div className="user-info">
                          <div className="user-avatar">
                            {user.name?.charAt(0) || 'U'}
                          </div>
                          <div className="user-details">
                            <div className="user-name">{user.name}</div>
                            <div className="user-id">ID: {user._id.substring(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`badge badge-${getRoleBadge(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${getStatusBadge(user.status)}`}>
                          {user.status}
                        </span>
                      </td>
                      <td>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        {user.lastLogin 
                          ? new Date(user.lastLogin).toLocaleDateString()
                          : 'Never'
                        }
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleViewDetails(user._id)}
                          >
                            View
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => navigate(`/admin/users/${user._id}/edit`)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDeleteUser(user._id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="pagination">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => handlePageChange(filters.page - 1)}
                  disabled={filters.page === 1}
                >
                  Previous
                </button>
                
                <div className="page-numbers">
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    let pageNum;
                    if (pagination.pages <= 5) {
                      pageNum = i + 1;
                    } else if (filters.page <= 3) {
                      pageNum = i + 1;
                    } else if (filters.page >= pagination.pages - 2) {
                      pageNum = pagination.pages - 4 + i;
                    } else {
                      pageNum = filters.page - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        className={`btn ${filters.page === pageNum ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => handlePageChange(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  className="btn btn-outline-secondary"
                  onClick={() => handlePageChange(filters.page + 1)}
                  disabled={filters.page === pagination.pages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* User Details Modal */}
      {modalOpen && selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          onClose={() => setModalOpen(false)}
          onUpdate={handleUpdateUser}
        />
      )}
    </div>
  );
};

const UserDetailsModal = ({ user, onClose, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    isVerified: user.isVerified
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onUpdate(user._id, formData);
    setEditing(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>User Details</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          {!editing ? (
            <div className="user-details-view">
              <div className="detail-row">
                <label>Name:</label>
                <span>{user.name}</span>
              </div>
              <div className="detail-row">
                <label>Email:</label>
                <span>{user.email}</span>
              </div>
              <div className="detail-row">
                <label>Role:</label>
                <span className={`badge badge-${user.role === 'teacher' ? 'primary' : 'info'}`}>
                  {user.role}
                </span>
              </div>
              <div className="detail-row">
                <label>Status:</label>
                <span className={`badge badge-${user.status === 'active' ? 'success' : 'warning'}`}>
                  {user.status}
                </span>
              </div>
              <div className="detail-row">
                <label>Verified:</label>
                <span>{user.isVerified ? 'Yes' : 'No'}</span>
              </div>
              <div className="detail-row">
                <label>Joined:</label>
                <span>{new Date(user.createdAt).toLocaleString()}</span>
              </div>
              {user.lastLogin && (
                <div className="detail-row">
                  <label>Last Login:</label>
                  <span>{new Date(user.lastLogin).toLocaleString()}</span>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="form-control"
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="form-control"
                  required
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="form-control"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="form-control"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isVerified}
                    onChange={(e) => setFormData({ ...formData, isVerified: e.target.checked })}
                  />
                  Verified Account
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
        
        <div className="modal-footer">
          {!editing && (
            <>
              <button className="btn btn-primary" onClick={() => setEditing(true)}>
                Edit User
              </button>
              <button className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;