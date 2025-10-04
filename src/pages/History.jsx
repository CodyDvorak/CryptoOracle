import React, { useState, useEffect } from 'react'
import { Clock, CircleCheck as CheckCircle, Circle as XCircle, Activity, CircleAlert as AlertCircle, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react'
import { API_ENDPOINTS, getHeaders } from '../config/api'
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
      const response = await fetch(`${API_ENDPOINTS.scanHistory}?limit=50`, {
        headers: getHeaders(),
      })
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
  const [expanded, setExpanded] = useState(false)
  const [recommendations, setRecommendations] = useState([])
  const [loadingDetails, setLoadingDetails] = useState(false)

  const isCompleted = scan.status === 'completed'
  const isFailed = scan.status === 'failed'
  const isRunning = scan.status === 'running'

  const successRate = scan.total_available_coins > 0
    ? ((scan.total_available_coins / scan.total_coins) * 100).toFixed(1)
    : 0

  const fetchRecommendations = async () => {
    if (recommendations.length > 0) return

    setLoadingDetails(true)
    try {
      const response = await fetch(`${API_ENDPOINTS.scanLatest}?runId=${scan.id}`, {
        headers: getHeaders(),
      })
      if (response.ok) {
        const data = await response.json()
        setRecommendations(data.recommendations || [])
      }
    } catch (err) {
      console.error('Failed to fetch recommendations:', err)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleToggle = () => {
    if (!expanded && recommendations.length === 0) {
      fetchRecommendations()
    }
    setExpanded(!expanded)
  }

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

        {scan.completed_at && scan.started_at && (
          <div className="detail-row">
            <Clock size={16} />
            <span className="detail-label">Duration:</span>
            <span className="detail-value">
              {Math.floor((new Date(scan.completed_at) - new Date(scan.started_at)) / 1000)}s
            </span>
          </div>
        )}
      </div>

      <div className="history-stats">
        <div className="history-stat">
          <span className="stat-label">Coins Analyzed</span>
          <span className="stat-value">
            {scan.total_available_coins || 0} / {scan.total_coins || 0}
          </span>
        </div>

        {scan.total_bots && (
          <div className="history-stat">
            <span className="stat-label">Bots Used</span>
            <span className="stat-value">{scan.total_bots}</span>
          </div>
        )}

        {scan.recommendationCount && (
          <div className="history-stat">
            <span className="stat-label">Recommendations</span>
            <span className="stat-value">{scan.recommendationCount}</span>
          </div>
        )}
      </div>

      {scan.total_available_coins > 0 && (
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

      {isCompleted && (
        <>
          <button
            className="expand-btn"
            onClick={handleToggle}
          >
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            {expanded ? 'Hide' : 'Show'} Recommendations
          </button>

          {expanded && (
            <div className="scan-details">
              {loadingDetails ? (
                <div className="details-loading">
                  <Activity className="spinner" size={24} />
                  <span>Loading recommendations...</span>
                </div>
              ) : recommendations.length > 0 ? (
                <div className="recommendations-grid">
                  {recommendations.map((rec, idx) => (
                    <RecommendationDetail key={idx} recommendation={rec} />
                  ))}
                </div>
              ) : (
                <div className="no-recommendations">
                  <p>No recommendations found for this scan</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function RecommendationDetail({ recommendation }) {
  const isLong = recommendation.consensus_direction === 'LONG'
  const confidencePercent = (recommendation.avg_confidence * 10).toFixed(1)
  const consensusPercent = recommendation.consensus_percent?.toFixed(1) || 0

  return (
    <div className="recommendation-detail">
      <div className="rec-header">
        <div className="rec-title">
          <span className="rec-coin">{recommendation.coin}</span>
          <span className="rec-ticker">{recommendation.ticker}</span>
        </div>
        <div className={`rec-direction ${isLong ? 'long' : 'short'}`}>
          {isLong ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          {recommendation.consensus_direction}
        </div>
      </div>

      <div className="rec-metrics">
        <div className="rec-metric">
          <span className="metric-label">Price</span>
          <span className="metric-value">${recommendation.current_price?.toFixed(6)}</span>
        </div>
        <div className="rec-metric">
          <span className="metric-label">Confidence</span>
          <span className="metric-value">{confidencePercent}/10</span>
        </div>
        <div className="rec-metric">
          <span className="metric-label">Consensus</span>
          <span className="metric-value">{consensusPercent}%</span>
        </div>
      </div>

      <div className="rec-bots">
        <span className="bots-label">Bot Analysis:</span>
        <div className="bots-breakdown">
          <span className="bot-count long">{recommendation.long_bots} LONG</span>
          <span className="bot-separator">•</span>
          <span className="bot-count short">{recommendation.short_bots} SHORT</span>
        </div>
      </div>
    </div>
  )
}

export default History
