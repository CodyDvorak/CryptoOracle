import React, { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Percent, Activity, CircleAlert as AlertCircle } from 'lucide-react'
import { API_ENDPOINTS, getHeaders } from '../config/api'
import './ScanResults.css'

function ScanResults() {
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('confidence')

  useEffect(() => {
    fetchLatestResults()
  }, [])

  const fetchLatestResults = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(API_ENDPOINTS.scanLatest, {
        headers: getHeaders(),
      })
      if (!response.ok) {
        throw new Error('Failed to fetch results')
      }
      const data = await response.json()
      setResults(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="results-loading">
        <Activity className="spinner" size={48} />
        <p>Loading scan results...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="results-error">
        <AlertCircle size={48} />
        <p>{error}</p>
        <button onClick={fetchLatestResults}>Retry</button>
      </div>
    )
  }

  if (!results || !results.recommendations) {
    return (
      <div className="results-empty">
        <AlertCircle size={48} />
        <p>No scan results available</p>
        <p className="hint">Run a scan from the Dashboard to see recommendations</p>
      </div>
    )
  }

  const { scan, recommendations } = results

  const tabs = [
    { id: 'confidence', label: 'Top Confidence', data: recommendations || [] },
  ]

  const activeData = tabs.find(t => t.id === activeTab)?.data || []

  return (
    <div className="scan-results">
      <div className="results-header">
        <div>
          <h1>Scan Results</h1>
          <p>Latest trading recommendations from bot consensus</p>
        </div>
        <button className="refresh-btn" onClick={fetchLatestResults}>
          Refresh
        </button>
      </div>

      {scan && (
        <div className="scan-summary">
          <div className="summary-item">
            <span className="label">Scan Type</span>
            <span className="value">{scan.scan_type}</span>
          </div>
          <div className="summary-item">
            <span className="label">Status</span>
            <span className={`badge ${scan.status}`}>{scan.status}</span>
          </div>
          <div className="summary-item">
            <span className="label">Coins Analyzed</span>
            <span className="value">{scan.total_coins}</span>
          </div>
          <div className="summary-item">
            <span className="label">Completed</span>
            <span className="value">{new Date(scan.completed_at).toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="results-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="recommendations-grid">
        {activeData.map((rec, index) => (
          <RecommendationCard key={index} recommendation={rec} rank={index + 1} />
        ))}
      </div>

      {activeData.length === 0 && (
        <div className="no-recommendations">
          <p>No recommendations available in this category</p>
        </div>
      )}
    </div>
  )
}

function RecommendationCard({ recommendation, rank }) {
  const isLong = recommendation.consensus_direction?.toUpperCase() === 'LONG'
  const confidenceColor = recommendation.avg_confidence >= 0.7 ? 'high' : recommendation.avg_confidence >= 0.5 ? 'medium' : 'low'

  return (
    <div className="recommendation-card">
      <div className="card-header">
        <div className="rank-badge">#{rank}</div>
        <div className="coin-info">
          <h3>{recommendation.ticker}</h3>
          <span className="coin-name">{recommendation.coin}</span>
        </div>
        <div className={`direction-badge ${isLong ? 'long' : 'short'}`}>
          {isLong ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          {isLong ? 'LONG' : 'SHORT'}
        </div>
      </div>

      <div className="card-stats">
        <div className="stat">
          <span className="stat-label">Current Price</span>
          <span className="stat-value">${recommendation.current_price?.toFixed(4)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Confidence</span>
          <span className={`stat-value confidence-${confidenceColor}`}>
            {(recommendation.avg_confidence * 10)?.toFixed(1)}/10
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Consensus</span>
          <span className="stat-value">{recommendation.consensus_percent?.toFixed(1)}%</span>
        </div>
      </div>

      <div className="bot-votes">
        <div className="vote-bar">
          <div
            className="vote-fill long"
            style={{ width: `${(recommendation.long_bots / recommendation.bot_count) * 100}%` }}
          />
        </div>
        <div className="vote-labels">
          <span className="long">{recommendation.long_bots} Long</span>
          <span className="short">{recommendation.short_bots} Short</span>
        </div>
      </div>

      {recommendation.predicted_gain_pct && (
        <div className="predictions">
          <div className="prediction-item">
            <Percent size={16} />
            <span>Expected Gain: {recommendation.predicted_gain_pct?.toFixed(2)}%</span>
          </div>
          <div className="prediction-item">
            <DollarSign size={16} />
            <span>Target: ${recommendation.predicted_7d?.toFixed(4)}</span>
          </div>
        </div>
      )}

      {recommendation.market_regime && (
        <div className="market-regime">
          <span className={`regime-badge ${recommendation.market_regime.toLowerCase()}`}>
            {recommendation.market_regime}
          </span>
          {recommendation.regime_confidence && (
            <span className="regime-confidence">
              {(recommendation.regime_confidence * 100).toFixed(0)}% confidence
            </span>
          )}
        </div>
      )}

      {recommendation.rationale && (
        <div className="rationale">
          <p>{recommendation.rationale}</p>
        </div>
      )}
    </div>
  )
}

export default ScanResults
