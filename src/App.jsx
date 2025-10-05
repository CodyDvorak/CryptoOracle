import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Dashboard from './pages/Dashboard'
import ScanResults from './pages/ScanResults'
import BotPerformance from './pages/BotPerformance'
import History from './pages/History'
import Insights from './pages/Insights'
import Profile from './pages/Profile'
import Login from './pages/Login'
import Signup from './pages/Signup'
import NotificationCenter from './components/NotificationCenter'
import { Activity, TrendingUp, BarChart3, History as HistoryIcon, Lightbulb, User, LogOut } from 'lucide-react'
import './App.css'

function Navigation() {
  const location = useLocation()
  const { user, signOut } = useAuth()

  const navItems = [
    { path: '/', icon: Activity, label: 'Dashboard' },
    { path: '/results', icon: TrendingUp, label: 'Results' },
    { path: '/insights', icon: Lightbulb, label: 'Insights' },
    { path: '/bots', icon: BarChart3, label: 'Bot Performance' },
    { path: '/history', icon: HistoryIcon, label: 'History' },
    { path: '/profile', icon: User, label: 'Profile' }
  ]

  return (
    <nav className="nav">
      <div className="nav-brand">
        <div className="brand-icon">🔮</div>
        <h1>Crypto Oracle</h1>
      </div>
      <div className="nav-links">
        {navItems.map(({ path, icon: Icon, label }) => (
          <Link
            key={path}
            to={path}
            className={`nav-link ${location.pathname === path ? 'active' : ''}`}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </div>
      <div className="nav-actions">
        <NotificationCenter />
        {user && (
          <button onClick={signOut} className="logout-btn" title="Sign Out">
            <LogOut size={20} />
          </button>
        )}
      </div>
    </nav>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    )
  }

  return user ? children : <Navigate to="/login" />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    )
  }

  return !user ? children : <Navigate to="/" />
}

function AppContent() {
  const location = useLocation()
  const isAuthPage = ['/login', '/signup'].includes(location.pathname)

  return (
    <div className="app">
      {!isAuthPage && <Navigation />}
      <main className={isAuthPage ? 'auth-main' : 'main-content'}>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/results" element={<ProtectedRoute><ScanResults /></ProtectedRoute>} />
          <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
          <Route path="/bots" element={<ProtectedRoute><BotPerformance /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  )
}

export default App
