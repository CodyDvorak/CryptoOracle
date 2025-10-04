import React, { useState, useEffect } from 'react'
import { Play, Clock, Coins, Activity, CircleAlert as AlertCircle } from 'lucide-react'
import { API_ENDPOINTS, getHeaders } from '../config/api'
import './Dashboard.css'

const SCAN_TYPES = [
  { id: 'speed_run', name: 'Speed Run', duration: '4-5 min', coins: 75, bots: 25, description: 'Ultra-fast snapshot' },
  { id: 'quick_scan', name: 'Quick Scan', duration: '7-10 min', coins: 100, bots: 48, description: 'Standard quick check' },
  { id: 'fast_parallel', name: 'Fast Parallel', duration: '8-10 min', coins: 100, bots: 48, description: 'Faster quick check' },
  { id: 'focused_scan', name: 'Focused Scan', duration: '10-12 min', coins: 50, bots: 48, description: 'Top 50 deep dive' },
  { id: 'focused_ai', name: 'Focused AI', duration: '25-28 min', coins: 20, bots: 49, description: 'AI deep dive top 20' },
  { id: 'full_scan_lite', name: 'Full Scan Lite', duration: '15-18 min', coins: 200, bots: 48, description: 'Broad coverage' },
  { id: 'complete_market_scan', name: 'Complete Market', duration: '18-20 min', coins: 250, bots: 48, description: 'Market overview' },
  { id: 'all_in_lite', name: 'All In Lite', duration: '18-20 min', coins: 250, bots: 48, description: 'Wide coverage' },
  { id: 'all_in_under_5_lite', name: 'All In Under $5 Lite', duration: '15-18 min', coins: '250 <$5', bots: 48, description: 'Low-price gems' },
  { id: 'all_in', name: 'All In', duration: '30-35 min', coins: 500, bots: 48, description: 'Maximum coverage' },
  { id: 'all_in_ai', name: 'All In + AI', duration: '45-50 min', coins: 500, bots: 49, description: 'Max + AI insights' },
]

function Dashboard() {
  const [selectedScan, setSelectedScan] = useState('quick_scan')
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(null)
  const [scanStatus, setScanStatus] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    checkScanStatus()
    const interval = setInterval(checkScanStatus, 3000)
    return () => clearInterval(interval)
  }, [])

  const checkScanStatus = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.scanStatus, {
        headers: getHeaders(),
      })
      const data = await response.json()

      if (data.isRunning) {
        setIsScanning(true)
        setScanProgress(data.progress)
        setScanStatus(data.currentScan)
      } else {
        setIsScanning(false)
        setScanProgress(null)
      }
    } catch (err) {
      console.error('Error checking scan status:', err)
    }
  }

  const startScan = async () => {
    setError(null)
    setIsScanning(true)

    try {
      const response = await fetch(API_ENDPOINTS.scanRun, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          scanType: selectedScan,
          filterScope: 'all',
          interval: '4h'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to start scan')
      }

      const data = await response.json()
      console.log('Scan started:', data)
    } catch (err) {
      setError(err.message)
      setIsScanning(false)
    }
  }

  const selectedScanInfo = SCAN_TYPES.find(s => s.id === selectedScan)

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Trading Dashboard</h1>
          <p>AI-powered cryptocurrency trading recommendations</p>
        </div>
        {scanStatus && !isScanning && (
          <div className="last-scan">
            <Clock size={16} />
            <span>Last scan: {new Date(scanStatus.started_at).toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="error-banner">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="scan-control-card">
        <h2>Start New Scan</h2>

        <div className="scan-selector">
          <label htmlFor="scan-type">Select Scan Type</label>
          <select
            id="scan-type"
            value={selectedScan}
            onChange={(e) => setSelectedScan(e.target.value)}
            disabled={isScanning}
          >
            {SCAN_TYPES.map(scan => (
              <option key={scan.id} value={scan.id}>
                {scan.name} - {scan.duration}
              </option>
            ))}
          </select>
        </div>

        {selectedScanInfo && (
          <div className="scan-info-grid">
            <div className="scan-info-item">
              <Clock size={20} />
              <div>
                <span className="label">Duration</span>
                <span className="value">{selectedScanInfo.duration}</span>
              </div>
            </div>
            <div className="scan-info-item">
              <Coins size={20} />
              <div>
                <span className="label">Coins</span>
                <span className="value">{selectedScanInfo.coins}</span>
              </div>
            </div>
            <div className="scan-info-item">
              <Activity size={20} />
              <div>
                <span className="label">Bots</span>
                <span className="value">{selectedScanInfo.bots}</span>
              </div>
            </div>
          </div>
        )}

        {selectedScanInfo && (
          <div className="scan-description">
            {selectedScanInfo.description}
          </div>
        )}

        <button
          className="start-scan-btn"
          onClick={startScan}
          disabled={isScanning}
        >
          <Play size={20} />
          {isScanning ? 'Scan in Progress...' : 'Start Scan'}
        </button>

        {isScanning && scanProgress && (
          <div className="scan-progress">
            <div className="progress-header">
              <span>Processing: {scanProgress.coins_processed} / {scanProgress.total_coins} coins</span>
              <span>{scanProgress.percent_complete}%</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${scanProgress.percent_complete}%` }}
              />
            </div>
            {scanStatus?.current_coin && (
              <div className="current-coin">
                Analyzing: {scanStatus.current_coin}
              </div>
            )}
            {scanProgress.estimated_time_remaining && (
              <div className="time-remaining">
                Estimated time remaining: {Math.floor(scanProgress.estimated_time_remaining / 60)}m {scanProgress.estimated_time_remaining % 60}s
              </div>
            )}
          </div>
        )}
      </div>

      <div className="quick-stats">
        <div className="stat-card">
          <div className="stat-icon blue">
            <Activity size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Bots</span>
            <span className="stat-value">54</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <Coins size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Tracked Coins</span>
            <span className="stat-value">500+</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Scan Types</span>
            <span className="stat-value">15</span>
          </div>
        </div>
      </div>

      <div className="info-cards">
        <div className="info-card">
          <h3>How It Works</h3>
          <ul>
            <li>54 specialized trading bots analyze market data</li>
            <li>Each bot votes on direction (long/short) with confidence (1-10)</li>
            <li>Consensus recommendations are generated from bot votes</li>
            <li>Market regime detection weighs predictions</li>
            <li>Multi-timeframe analysis increases accuracy</li>
          </ul>
        </div>

        <div className="info-card">
          <h3>Scan Types</h3>
          <ul>
            <li><strong>Speed Run:</strong> 4-5 min, 75 coins, 25 top bots</li>
            <li><strong>Quick Scan:</strong> 7-10 min, 100 coins, 48 bots</li>
            <li><strong>Focused AI:</strong> 25-28 min, AI analysis on top 20</li>
            <li><strong>All In:</strong> 30-35 min, 500 coins maximum coverage</li>
            <li><strong>All In + AI:</strong> 45-50 min, full AI insights</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
