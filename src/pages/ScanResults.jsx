import React, { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Percent, Activity, CircleAlert as AlertCircle, Info } from 'lucide-react'
import { supabase } from '../config/api'
import BotDetailsModal from '../components/BotDetailsModal'
import BotPredictionsPanel from '../components/BotPredictionsPanel'
import './ScanResults.css'

function ScanResults() {
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('confidence')
  const [selectedCoin, setSelectedCoin] = useState(null)

  useEffect(() => {
    fetchLatestResults()

    const recommendationsChannel = supabase
      .channel('scan-results-recommendations')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'recommendations'
      }, (payload) => {
        console.log('New recommendation detected:', payload.new)
        setResults(prev => {
          if (!prev) return prev
          const updatedRecs = [payload.new, ...(prev.recommendations || [])]
            .sort((a, b) => b.avg_confidence - a.avg_confidence)
          return { ...prev, recommendations: updatedRecs }
        })
      })
      .subscribe()

    const botPredictionsChannel = supabase
      .channel('scan-results-bot-predictions')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bot_predictions'
      }, (payload) => {
        console.log('New bot prediction detected:', payload.new)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(recommendationsChannel)
      supabase.removeChannel(botPredictionsChannel)
    }
  }, [])

  const fetchLatestResults = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: latestScan, error: scanError } = await supabase
        .from('scan_runs')
        .select('*')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (scanError) throw scanError

      if (latestScan) {
        const { data: recs, error: recsError } = await supabase
          .from('recommendations')
          .select('*')
          .eq('run_id', latestScan.id)
          .order('avg_confidence', { ascending: false })

        if (recsError) throw recsError

        setResults({
          scan: latestScan,
          recommendations: recs || []
        })
      }
    } catch (err) {
      console.error('Error fetching results:', err)
      setError(err.message || 'Failed to fetch results')
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
          <RecommendationCard
            key={index}
            recommendation={rec}
            rank={index + 1}
            runId={scan?.id}
            onShowDetails={setSelectedCoin}
          />
        ))}
      </div>

      {selectedCoin && (
        <BotDetailsModal
          recommendation={selectedCoin}
          onClose={() => setSelectedCoin(null)}
        />
      )}

      {activeData.length === 0 && (
        <div className="no-recommendations">
          <p>No recommendations available in this category</p>
        </div>
      )}

      {scan?.id && (
        <BotPredictionsPanel runId={scan.id} />
      )}
    </div>
  )
}

function RecommendationCard({ recommendation, rank, runId, onShowDetails }) {
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
          <span className="stat-value">
            {recommendation.bot_count > 0
              ? ((Math.max(recommendation.bot_votes_long || 0, recommendation.bot_votes_short || 0) / recommendation.bot_count) * 100).toFixed(0)
              : '0'}%
          </span>
        </div>
      </div>

      <div className="bot-votes">
        <div className="vote-bar">
          <div
            className="vote-fill long"
            style={{ width: `${((recommendation.bot_votes_long || 0) / recommendation.bot_count) * 100}%` }}
          />
        </div>
        <div className="vote-labels">
          <span className="long">{recommendation.bot_votes_long || 0} Long</span>
          <span className="short">{recommendation.bot_votes_short || 0} Short</span>
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

      <button
        className="bot-details-btn"
        onClick={() => onShowDetails(recommendation)}
      >
        <Info size={16} />
        View Bot Details ({recommendation.bot_count} bots)
      </button>
    </div>
  )
}

export default ScanResults
