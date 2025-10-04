import React, { useState, useEffect } from 'react'
import { Activity, TrendingUp, Target, Award, AlertCircle } from 'lucide-react'
import './BotPerformance.css'

function BotPerformance() {
  const [bots, setBots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortBy, setSortBy] = useState('accuracy')

  useEffect(() => {
    fetchBotPerformance()
  }, [])

  const fetchBotPerformance = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/bots/performance')
      if (!response.ok) {
        throw new Error('Failed to fetch bot performance')
      }
      const data = await response.json()
      setBots(data.bots || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bot-loading">
        <Activity className="spinner" size={48} />
        <p>Loading bot performance data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bot-error">
        <AlertCircle size={48} />
        <p>{error}</p>
        <button onClick={fetchBotPerformance}>Retry</button>
      </div>
    )
  }

  const sortedBots = [...bots].sort((a, b) => {
    switch (sortBy) {
      case 'accuracy':
        return (b.accuracy || 0) - (a.accuracy || 0)
      case 'predictions':
        return (b.total_predictions || 0) - (a.total_predictions || 0)
      case 'name':
        return (a.bot_name || '').localeCompare(b.bot_name || '')
      default:
        return 0
    }
  })

  const topBots = sortedBots.slice(0, 5)

  return (
    <div className="bot-performance">
      <div className="bot-header">
        <div>
          <h1>Bot Performance</h1>
          <p>Track accuracy and performance of 54 trading bots</p>
        </div>
        <button className="refresh-btn" onClick={fetchBotPerformance}>
          Refresh
        </button>
      </div>

      <div className="top-performers">
        <h2>Top 5 Performers</h2>
        <div className="performers-grid">
          {topBots.map((bot, index) => (
            <div key={bot.bot_name} className="performer-card">
              <div className="performer-rank">#{index + 1}</div>
              <Award className="performer-icon" size={32} />
              <h3>{bot.bot_name}</h3>
              <div className="performer-stat">
                <Target size={20} />
                <span>{(bot.accuracy * 100).toFixed(1)}% Accuracy</span>
              </div>
              <div className="performer-predictions">
                {bot.total_predictions} predictions
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bot-controls">
        <div className="sort-control">
          <label>Sort by:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="accuracy">Accuracy</option>
            <option value="predictions">Total Predictions</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      <div className="bots-list">
        {sortedBots.map((bot) => (
          <BotCard key={bot.bot_name} bot={bot} />
        ))}
      </div>

      {bots.length === 0 && (
        <div className="no-bots">
          <p>No bot performance data available</p>
          <p className="hint">Run a scan to generate performance metrics</p>
        </div>
      )}
    </div>
  )
}

function BotCard({ bot }) {
  const accuracy = bot.accuracy || 0
  const accuracyColor = accuracy >= 0.7 ? 'high' : accuracy >= 0.5 ? 'medium' : 'low'

  return (
    <div className="bot-card">
      <div className="bot-card-header">
        <div className="bot-info">
          <h3>{bot.bot_name}</h3>
          {bot.strategy && <span className="bot-strategy">{bot.strategy}</span>}
        </div>
        <div className={`accuracy-badge ${accuracyColor}`}>
          {(accuracy * 100).toFixed(1)}%
        </div>
      </div>

      <div className="bot-stats">
        <div className="bot-stat">
          <span className="stat-label">Total Predictions</span>
          <span className="stat-value">{bot.total_predictions || 0}</span>
        </div>
        <div className="bot-stat">
          <span className="stat-label">Correct</span>
          <span className="stat-value correct">{bot.correct_predictions || 0}</span>
        </div>
        <div className="bot-stat">
          <span className="stat-label">Incorrect</span>
          <span className="stat-value incorrect">{bot.incorrect_predictions || 0}</span>
        </div>
      </div>

      {bot.avg_confidence && (
        <div className="bot-confidence">
          <span>Avg Confidence:</span>
          <div className="confidence-bar">
            <div
              className="confidence-fill"
              style={{ width: `${bot.avg_confidence * 10}%` }}
            />
          </div>
          <span>{bot.avg_confidence.toFixed(1)}/10</span>
        </div>
      )}

      {bot.market_regime_performance && (
        <div className="regime-performance">
          <span className="regime-label">Market Regime Performance:</span>
          <div className="regime-stats">
            {Object.entries(bot.market_regime_performance).map(([regime, perf]) => (
              <div key={regime} className="regime-stat">
                <span className={`regime-badge ${regime.toLowerCase()}`}>{regime}</span>
                <span>{(perf.accuracy * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default BotPerformance
