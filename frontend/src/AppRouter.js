import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import App from './App';
import Login from './pages/Login';
import Register from './pages/Register';
import History from './pages/History';
import BotPerformanceDashboard from './components/BotPerformanceDashboard';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

const AppRouter = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<App />} />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <History />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bot-performance"
        element={
          <ProtectedRoute>
            <BotPerformanceDashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

export default AppRouter;
