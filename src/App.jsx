import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import ScanResults from './pages/ScanResults'
import BotPerformance from './pages/BotPerformance'
import History from './pages/History'
import NotificationCenter from './components/NotificationCenter'
import { Activity, TrendingUp, BarChart3, History as HistoryIcon } from 'lucide-react'
import './App.css'

function Navigation() {
  const location = useLocation()

  const navItems = [
    { path: '/', icon: Activity, label: 'Dashboard' },
    { path: '/results', icon: TrendingUp, label: 'Results' },
    { path: '/bots', icon: BarChart3, label: 'Bot Performance' },
    { path: '/history', icon: HistoryIcon, label: 'History' }
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
      </div>
    </nav>
  )
}

function App() {
  return (
    <Router>
      <div className="app">
        <Navigation />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/results" element={<ScanResults />} />
            <Route path="/bots" element={<BotPerformance />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
