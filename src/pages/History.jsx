import React, { useState, useEffect } from 'react'
import { Clock, CheckCircle, XCircle, Activity, AlertCircle } from 'lucide-react'
import './History.css'

function History() {
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchScanHistory()
  }, [])

  const fetchScanHistory = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/scan/history?limit=50')
      if (!response.ok) {
        throw new Error('Failed to fetch scan history')
      }
      const data = await response.json()
      setScans(data.scans || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="history-loading">
        <Activity className="spinner" size={48} />
        <p>Loading scan history...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="history-error">
        <AlertCircle size={48} />
        <p>{error}</p>
        <button onClick={fetchScanHistory}>Retry</button>
      </div>
    )
  }

  return (
    <div className="history">
      <div className="history-header">
        <div>
          <h1>Scan History</h1>
          <p>View past scan runs and their performance</p>
        </div>
        <button className="refresh-btn" onClick={fetchScanHistory}>
          Refresh
        </button>
      </div>

      {scans.length === 0 ? (
        <div className="no-history">
          <Clock size={48} />
          <p>No scan history available</p>
          <p className="hint">Run a scan from the Dashboard to see history</p>
        </div>
      ) : (
        <div className="history-list">
          {scans.map((scan) => (
            <ScanHistoryCard key={scan.id} scan={scan} />
          ))}
        </div>
      )}
    </div>
  )
}

function ScanHistoryCard({ scan }) {
  const isCompleted = scan.status === 'completed'
  const isFailed = scan.status === 'failed'
  const isRunning = scan.status === 'running'

  const successRate = scan.coins_analyzed > 0
    ? ((scan.coins_analyzed - (scan.coins_failed || 0)) / scan.coins_analyzed * 100).toFixed(1)
    : 0

  return (
    <div className="history-card">
      <div className="history-card-header">
        <div className="scan-type-badge">{scan.scan_type}</div>
        <div className={`status-badge ${scan.status}`}>
          {isCompleted && <CheckCircle size={16} />}
          {isFailed && <XCircle size={16} />}
          {isRunning && <Activity size={16} />}
          {scan.status}
        </div>
      </div>

      <div className="history-details">
        <div className="detail-row">
          <Clock size={16} />
          <span className="detail-label">Started:</span>
          <span className="detail-value">
            {new Date(scan.started_at).toLocaleString()}
          </span>
        </div>

        {scan.completed_at && (
          <div className="detail-row">
            <CheckCircle size={16} />
            <span className="detail-label">Completed:</span>
            <span className="detail-value">
              {new Date(scan.completed_at).toLocaleString()}
            </span>
          </div>
        )}

        {scan.duration_seconds && (
          <div className="detail-row">
            <Clock size={16} />
            <span className="detail-label">Duration:</span>
            <span className="detail-value">
              {Math.floor(scan.duration_seconds / 60)}m {scan.duration_seconds % 60}s
            </span>
          </div>
        )}
      </div>

      <div className="history-stats">
        <div className="history-stat">
          <span className="stat-label">Coins Analyzed</span>
          <span className="stat-value">
            {scan.coins_analyzed || 0} / {scan.total_coins || 0}
          </span>
        </div>

        {scan.total_bots && (
          <div className="history-stat">
            <span className="stat-label">Bots Used</span>
            <span className="stat-value">{scan.total_bots}</span>
          </div>
        )}

        {scan.total_predictions && (
          <div className="history-stat">
            <span className="stat-label">Predictions</span>
            <span className="stat-value">{scan.total_predictions}</span>
          </div>
        )}

        {scan.coins_failed > 0 && (
          <div className="history-stat">
            <span className="stat-label">Failed</span>
            <span className="stat-value error">{scan.coins_failed}</span>
          </div>
        )}
      </div>

      {scan.coins_analyzed > 0 && (
        <div className="success-rate">
          <span>Success Rate:</span>
          <div className="rate-bar">
            <div
              className="rate-fill"
              style={{ width: `${successRate}%` }}
            />
          </div>
          <span className="rate-value">{successRate}%</span>
        </div>
      )}

      {scan.error_message && (
        <div className="error-message">
          <AlertCircle size={16} />
          <span>{scan.error_message}</span>
        </div>
      )}
    </div>
  )
}

export default History
