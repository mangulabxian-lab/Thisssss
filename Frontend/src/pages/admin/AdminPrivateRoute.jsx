import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const AdminPrivateRoute = () => {
  const token = localStorage.getItem('adminToken');
  const admin = JSON.parse(localStorage.getItem('admin') || '{}');

  if (!token || !admin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
};

export default AdminPrivateRoute;