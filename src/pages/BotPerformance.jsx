import React, { useState, useEffect } from 'react'
import { Activity, TrendingUp, TrendingDown, Target, Award, CircleAlert as AlertCircle, BarChart3, CircleCheck as CheckCircle, Brain, Lightbulb, Sparkles } from 'lucide-react'
import { API_ENDPOINTS, getHeaders } from '../config/api'
import './BotPerformance.css'

function BotPerformance() {
  const [bots, setBots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortBy, setSortBy] = useState('accuracy')
  const [aiInsights, setAiInsights] = useState([])
  const [learningMetrics, setLearningMetrics] = useState([])
  const [analyzingAI, setAnalyzingAI] = useState(false)

  useEffect(() => {
    fetchBotPerformance()
  }, [])

  const fetchBotPerformance = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(API_ENDPOINTS.botPerformance, {
        headers: getHeaders(),
      })
      if (!response.ok) {
        throw new Error('Failed to fetch bot performance')
      }
      const data = await response.json()
      setBots(data.bots || [])
      await fetchAIInsights()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchAIInsights = async () => {
    try {
      const [insightsRes, metricsRes] = await Promise.all([
        fetch(`${API_ENDPOINTS.botLearning}/insights`, { headers: getHeaders() }),
        fetch(`${API_ENDPOINTS.botLearning}/metrics`, { headers: getHeaders() })
      ])

      if (insightsRes.ok) {
        const insightsData = await insightsRes.json()
        setAiInsights(insightsData.insights || [])
      }

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json()
        setLearningMetrics(metricsData.metrics || [])
      }
    } catch (err) {
      console.error('Failed to fetch AI insights:', err)
    }
  }

  const runAIAnalysis = async () => {
    setAnalyzingAI(true)
    try {
      const response = await fetch(API_ENDPOINTS.botLearning, {
        method: 'POST',
        headers: getHeaders(),
      })
      if (response.ok) {
        await fetchAIInsights()
      }
    } catch (err) {
      console.error('AI analysis failed:', err)
    } finally {
      setAnalyzingAI(false)
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
        return (b.accuracy_rate || 0) - (a.accuracy_rate || 0)
      case 'predictions':
        return (b.total_predictions || 0) - (a.total_predictions || 0)
      case 'name':
        return (a.bot_name || '').localeCompare(b.bot_name || '')
      default:
        return 0
    }
  })

  const topBots = sortedBots.slice(0, 5)
  const bottomBots = sortedBots.slice(-5).reverse()

  const botsWithData = bots.filter(b => (b.successful_predictions || 0) + (b.failed_predictions || 0) > 0)
  const totalPredictions = bots.reduce((sum, b) => sum + (b.total_predictions || 0), 0)
  const totalSuccessful = bots.reduce((sum, b) => sum + (b.successful_predictions || 0), 0)
  const totalFailed = bots.reduce((sum, b) => sum + (b.failed_predictions || 0), 0)
  const totalPending = bots.reduce((sum, b) => sum + (b.pending_predictions || 0), 0)
  const avgAccuracy = botsWithData.length > 0
    ? botsWithData.reduce((sum, b) => sum + (b.accuracy_rate || 0), 0) / botsWithData.length
    : 0
  const avgWinLoss = botsWithData.length > 0
    ? botsWithData.reduce((sum, b) => sum + (b.win_loss_ratio || 0), 0) / botsWithData.length
    : 0

  const highPerformers = bots.filter(b => (b.accuracy_rate || 0) >= 60).length
  const needsAttention = bots.filter(b => {
    const completed = (b.successful_predictions || 0) + (b.failed_predictions || 0)
    return completed > 0 && (b.accuracy_rate || 0) < 40
  }).length

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

      <div className="performance-overview">
        <div className="overview-header">
          <BarChart3 size={24} />
          <h2>System Performance Overview</h2>
        </div>
        <p className="overview-subtitle">Overall system health and trends</p>

        <div className="overview-grid">
          <div className="overview-card">
            <div className="overview-label">System Accuracy</div>
            <div className={`overview-value ${avgAccuracy >= 50 ? 'high' : avgAccuracy >= 40 ? 'medium' : 'low'}`}>
              {avgAccuracy.toFixed(1)}%
            </div>
            <div className="overview-detail">Weighted average</div>
          </div>

          <div className="overview-card">
            <div className="overview-label">Win/Loss Ratio</div>
            <div className={`overview-value ${avgWinLoss >= 1.5 ? 'high' : avgWinLoss >= 1 ? 'medium' : 'low'}`}>
              {avgWinLoss.toFixed(2)}x
            </div>
            <div className="overview-detail">Average across bots</div>
          </div>

          <div className="overview-card">
            <div className="overview-label">Total Evaluated</div>
            <div className="overview-value">{totalSuccessful + totalFailed}</div>
            <div className="overview-detail">Predictions assessed</div>
          </div>

          <div className="overview-card">
            <div className="overview-label">Pending</div>
            <div className="overview-value pending">{totalPending}</div>
            <div className="overview-detail">Awaiting evaluation</div>
          </div>
        </div>

        <div className="overview-insights">
          <div className="insight-row">
            <CheckCircle className="insight-icon success" size={20} />
            <div>
              <strong>{highPerformers} high-performing bots</strong>
              <span> (≥60% accuracy) leading the system</span>
            </div>
          </div>
          {needsAttention > 0 && (
            <div className="insight-row warning">
              <AlertCircle className="insight-icon" size={20} />
              <div>
                <strong>{needsAttention} bots need attention</strong>
                <span> (&lt;40% accuracy) - consider parameter adjustment</span>
              </div>
            </div>
          )}
          <div className="insight-row">
            <Activity className="insight-icon" size={20} />
            <div>
              <strong>{bots.length} total bots</strong>
              <span> actively tracking across {totalPredictions} predictions</span>
            </div>
          </div>
        </div>
      </div>

      <div className="performers-section">
        <div className="top-performers">
          <div className="performers-header">
            <Award size={20} />
            <h2>Top 5 Performers</h2>
          </div>
          <div className="performers-grid">
            {topBots.map((bot, index) => (
              <div key={bot.bot_name} className="performer-card top">
                <div className="performer-rank top">#{index + 1}</div>
                <TrendingUp className="performer-icon" size={28} />
                <h3>{bot.bot_name}</h3>
                <div className="performer-stat">
                  <span className="stat-big">{bot.accuracy_rate?.toFixed(1)}%</span>
                  <span className="stat-label">Accuracy</span>
                </div>
                <div className="performer-meta">
                  <span>{bot.total_predictions} predictions</span>
                  {bot.win_loss_ratio && <span>{bot.win_loss_ratio.toFixed(2)}x W/L</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bottom-performers">
          <div className="performers-header">
            <AlertCircle size={20} />
            <h2>Needs Improvement</h2>
          </div>
          <div className="performers-grid">
            {bottomBots.filter(b => (b.successful_predictions || 0) + (b.failed_predictions || 0) > 0).map((bot, index) => (
              <div key={bot.bot_name} className="performer-card bottom">
                <div className="performer-rank bottom">#{sortedBots.length - index}</div>
                <TrendingDown className="performer-icon" size={28} />
                <h3>{bot.bot_name}</h3>
                <div className="performer-stat">
                  <span className="stat-big">{bot.accuracy_rate?.toFixed(1)}%</span>
                  <span className="stat-label">Accuracy</span>
                </div>
                <div className="performer-meta">
                  <span>{bot.total_predictions} predictions</span>
                  {bot.win_loss_ratio && <span>{bot.win_loss_ratio.toFixed(2)}x W/L</span>}
                </div>
                <div className="improvement-hint">
                  {bot.accuracy_rate < 30 ? 'Critical - Review strategy' :
                   bot.accuracy_rate < 40 ? 'Adjust parameters' :
                   'Monitor closely'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {aiInsights.length > 0 && (
        <div className="ai-insights-section">
          <div className="ai-insights-header">
            <Brain size={24} />
            <div>
              <h2>AI Learning Insights</h2>
              <p className="ai-subtitle">Automated analysis and recommendations</p>
            </div>
            <button className="ai-analyze-btn" onClick={runAIAnalysis} disabled={analyzingAI}>
              {analyzingAI ? <Activity className="spinner" size={16} /> : <Sparkles size={16} />}
              {analyzingAI ? 'Analyzing...' : 'Run AI Analysis'}
            </button>
          </div>

          <div className="insights-grid">
            {aiInsights.slice(0, 6).map((insight, index) => (
              <div key={index} className={`insight-card ${insight.insight_type}`}>
                <div className="insight-header">
                  {insight.insight_type === 'strength' && <Award size={20} />}
                  {insight.insight_type === 'weakness' && <AlertCircle size={20} />}
                  {insight.insight_type === 'trend' && <TrendingUp size={20} />}
                  {insight.insight_type === 'recommendation' && <Lightbulb size={20} />}
                  <span className="insight-type">{insight.insight_type}</span>
                  <span className="insight-confidence">{insight.confidence_score?.toFixed(0)}%</span>
                </div>
                <h4>{insight.bot_name}</h4>
                <p className="insight-text">{insight.insight_text}</p>
                <div className="insight-timestamp">
                  {new Date(insight.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
  const accuracy = (bot.accuracy_rate || 0) / 100
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
          <span className="stat-label">Successful</span>
          <span className="stat-value correct">{bot.successful_predictions || 0}</span>
        </div>
        <div className="bot-stat">
          <span className="stat-label">Failed</span>
          <span className="stat-value incorrect">{bot.failed_predictions || 0}</span>
        </div>
        <div className="bot-stat">
          <span className="stat-label">Pending</span>
          <span className="stat-value">{bot.pending_predictions || 0}</span>
        </div>
      </div>

      <div className="bot-metrics">
        {bot.win_loss_ratio !== undefined && (
          <div className="bot-metric">
            <span className="metric-label">Win/Loss Ratio</span>
            <span className={`metric-value ${bot.win_loss_ratio >= 1.5 ? 'high' : bot.win_loss_ratio >= 1 ? 'medium' : 'low'}`}>
              {bot.win_loss_ratio.toFixed(2)}x
            </span>
          </div>
        )}
        {bot.avg_profit_loss !== undefined && (
          <div className="bot-metric">
            <span className="metric-label">Avg P/L</span>
            <span className={`metric-value ${bot.avg_profit_loss >= 0 ? 'correct' : 'incorrect'}`}>
              {bot.avg_profit_loss >= 0 ? '+' : ''}{bot.avg_profit_loss.toFixed(2)}%
            </span>
          </div>
        )}
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
