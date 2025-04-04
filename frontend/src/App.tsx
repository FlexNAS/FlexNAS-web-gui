import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Storage from './pages/Storage';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Sharing from './pages/Sharing';
import { AuthProvider, useAuth } from './hooks/useAuth';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  console.log('PrivateRoute - Auth state:', isAuthenticated);
  console.log('PrivateRoute - Token in localStorage:', localStorage.getItem('token') ? 'Present' : 'Not present');
  
  if (!isAuthenticated) {
    console.log('Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }
  
  console.log('Authenticated, rendering children');
  return <>{children}</>;
};

// Simple bypass component to force login and go directly to dashboard
const BypassAuth = () => {
  console.log('Using bypass authentication');
  localStorage.setItem('token', 'debug_token_12345');
  localStorage.setItem('user', 'admin');
  localStorage.setItem('role', 'admin');
  
  // Return redirect to dashboard
  return <Navigate to="/dashboard" replace />;
};

export const App = () => {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/bypass" element={<BypassAuth />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <Layout>
              <Dashboard />
            </Layout>
          }
        />
        <Route
          path="/storage"
          element={
            <PrivateRoute>
              <Layout>
                <Storage />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/sharing"
          element={
            <PrivateRoute>
              <Layout>
                <Sharing />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/users"
          element={
            <PrivateRoute>
              <Layout>
                <Users />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <Layout>
                <Settings />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}; 