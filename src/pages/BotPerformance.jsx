import React, { useState, useEffect } from 'react'
import { Activity, TrendingUp, TrendingDown, Target, Award, CircleAlert as AlertCircle, BarChart3, CircleCheck as CheckCircle, Brain, Lightbulb, Sparkles, Filter, Calendar, Play } from 'lucide-react'
import { API_ENDPOINTS, getHeaders } from '../config/api'
import SignalPerformanceCharts from '../components/SignalPerformanceCharts'
import RealtimeUpdates from '../components/RealtimeUpdates'
import './BotPerformance.css'

function BotPerformance() {
  const [bots, setBots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortBy, setSortBy] = useState('accuracy')
  const [aiInsights, setAiInsights] = useState([])
  const [learningMetrics, setLearningMetrics] = useState([])
  const [analyzingAI, setAnalyzingAI] = useState(false)

  const [filters, setFilters] = useState({
    regime: 'all',
    timeframe: 'all',
    coin: 'all'
  })
  const [coins, setCoins] = useState([])
  const [backtestResults, setBacktestResults] = useState([])
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })
  const [showBacktest, setShowBacktest] = useState(false)

  const [botStatuses, setBotStatuses] = useState([])
  const [optimizing, setOptimizing] = useState(false)
  const [training, setTraining] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [showAdaptivePanel, setShowAdaptivePanel] = useState(false)

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

  useEffect(() => {
    fetchAvailableCoins()
  }, [])

  const fetchAvailableCoins = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.scanLatest, {
        headers: getHeaders(),
      })
      const data = await response.json()
      if (data.recommendations) {
        const uniqueCoins = [...new Set(data.recommendations.map(r => r.ticker || r.coin_symbol))]
        setCoins(uniqueCoins)
      }
    } catch (err) {
      console.error('Failed to fetch coins:', err)
    }
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const applyFilters = (botList) => {
    return botList.filter(bot => {
      if (filters.regime !== 'all' && bot.best_regime !== filters.regime) {
        return false
      }
      if (filters.timeframe !== 'all' && bot.best_timeframe !== filters.timeframe) {
        return false
      }
      if (filters.coin !== 'all' && bot.best_coin !== filters.coin) {
        return false
      }
      return true
    })
  }

  const runBacktest = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_ENDPOINTS.backtesting}?action=run_backtest`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          action: 'run_backtest',
          config: {
            startDate: dateRange.start,
            endDate: dateRange.end,
            botNames: filters.regime !== 'all' ? bots.filter(b => b.best_regime === filters.regime).map(b => b.bot_name) : undefined,
            coinSymbols: filters.coin !== 'all' ? [filters.coin] : undefined
          }
        })
      })
      const data = await response.json()
      setBacktestResults(data.results || [])
      setShowBacktest(true)
    } catch (err) {
      console.error('Backtest failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const runParameterOptimization = async () => {
    setOptimizing(true)
    try {
      const response = await fetch(`${API_ENDPOINTS.parameterOptimizer}?action=optimize`, {
        method: 'POST',
        headers: getHeaders(),
      })
      const data = await response.json()
      if (data.success) {
        alert(`Optimized ${data.results?.length || 0} bot configurations`)
        fetchBotPerformance()
      }
    } catch (err) {
      console.error('Parameter optimization failed:', err)
      alert('Parameter optimization failed')
    } finally {
      setOptimizing(false)
    }
  }

  const runReinforcementLearning = async () => {
    setTraining(true)
    try {
      const response = await fetch(`${API_ENDPOINTS.reinforcementLearning}?action=train`, {
        method: 'POST',
        headers: getHeaders(),
      })
      const data = await response.json()
      if (data.success) {
        alert(`Trained ${data.bots_trained || 0} bots on historical data`)
      }
    } catch (err) {
      console.error('Reinforcement learning failed:', err)
      alert('Training failed')
    } finally {
      setTraining(false)
    }
  }

  const evaluateBotStatuses = async () => {
    setEvaluating(true)
    try {
      const response = await fetch(`${API_ENDPOINTS.dynamicBotManager}?action=evaluate`, {
        method: 'POST',
        headers: getHeaders(),
      })
      const data = await response.json()
      if (data.success) {
        alert(`Evaluated ${data.bots_evaluated || 0} bots\nEnabled: ${data.bots_enabled || 0}\nDisabled: ${data.bots_disabled || 0}`)
        fetchBotStatuses()
      }
    } catch (err) {
      console.error('Bot evaluation failed:', err)
      alert('Evaluation failed')
    } finally {
      setEvaluating(false)
    }
  }

  const fetchBotStatuses = async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.dynamicBotManager}?action=status`, {
        headers: getHeaders(),
      })
      const data = await response.json()
      if (data.success) {
        setBotStatuses(data.statuses || [])
      }
    } catch (err) {
      console.error('Failed to fetch bot statuses:', err)
    }
  }

  useEffect(() => {
    fetchBotStatuses()
  }, [])

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

  const filteredBots = applyFilters(bots)

  const sortedBots = [...filteredBots].sort((a, b) => {
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
      <RealtimeUpdates type="bot-performance" />
      <div className="bot-header">
        <div>
          <h1>Bot Performance</h1>
          <p>Track accuracy and performance of 54 trading bots</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="refresh-btn" onClick={fetchBotPerformance}>
            Refresh
          </button>
          <button className="refresh-btn" onClick={() => setShowAdaptivePanel(!showAdaptivePanel)}>
            <Brain size={18} /> Adaptive AI
          </button>
        </div>
      </div>

      {showAdaptivePanel && (
        <div className="adaptive-intelligence-panel" style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '24px',
          borderRadius: '12px',
          marginBottom: '24px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Sparkles size={28} />
            <div>
              <h2 style={{ margin: 0, fontSize: '22px' }}>Adaptive Intelligence System</h2>
              <p style={{ margin: '4px 0 0 0', opacity: 0.9 }}>
                Auto-optimize parameters, train reinforcement learning models, and manage bot statuses
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '16px', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Target size={18} /> Parameter Optimization
              </h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '13px', opacity: 0.9 }}>
                Auto-tune RSI periods, MACD settings, and other bot parameters based on backtest performance
              </p>
              <button
                onClick={runParameterOptimization}
                disabled={optimizing}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: optimizing ? '#999' : '#fff',
                  color: '#667eea',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: optimizing ? 'not-allowed' : 'pointer'
                }}
              >
                {optimizing ? 'Optimizing...' : 'Optimize Parameters'}
              </button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '16px', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Brain size={18} /> Reinforcement Learning
              </h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '13px', opacity: 0.9 }}>
                Train bots on historical outcomes using Q-learning to improve prediction accuracy
              </p>
              <button
                onClick={runReinforcementLearning}
                disabled={training}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: training ? '#999' : '#fff',
                  color: '#667eea',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: training ? 'not-allowed' : 'pointer'
                }}
              >
                {training ? 'Training...' : 'Train Models'}
              </button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '16px', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} /> Dynamic Bot Manager
              </h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '13px', opacity: 0.9 }}>
                Auto-enable bots at 60%+ accuracy, disable at 35%, with 7-day cooldown period
              </p>
              <button
                onClick={evaluateBotStatuses}
                disabled={evaluating}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: evaluating ? '#999' : '#fff',
                  color: '#667eea',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: evaluating ? 'not-allowed' : 'pointer'
                }}
              >
                {evaluating ? 'Evaluating...' : 'Evaluate Bots'}
              </button>
            </div>
          </div>

          {botStatuses.length > 0 && (
            <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.1)', padding: '16px', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Bot Status Summary</h3>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                    {botStatuses.filter(b => b.is_enabled).length}
                  </div>
                  <div style={{ fontSize: '13px', opacity: 0.9 }}>Enabled Bots</div>
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                    {botStatuses.filter(b => !b.is_enabled).length}
                  </div>
                  <div style={{ fontSize: '13px', opacity: 0.9 }}>Disabled Bots</div>
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                    {botStatuses.filter(b => b.cooldown_until && new Date(b.cooldown_until) > new Date()).length}
                  </div>
                  <div style={{ fontSize: '13px', opacity: 0.9 }}>In Cooldown</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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

      <div className="filters-and-tools">
        <div className="filters-bar">
          <div className="filters-header">
            <Filter size={20} />
            <h3>Filters</h3>
          </div>
          <div className="filter-controls">
            <div className="filter-group">
              <label>Regime</label>
              <select
                value={filters.regime}
                onChange={(e) => handleFilterChange('regime', e.target.value)}
              >
                <option value="all">All Regimes</option>
                <option value="BULL">Bull Market</option>
                <option value="BEAR">Bear Market</option>
                <option value="SIDEWAYS">Sideways</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Timeframe</label>
              <select
                value={filters.timeframe}
                onChange={(e) => handleFilterChange('timeframe', e.target.value)}
              >
                <option value="all">All Timeframes</option>
                <option value="1h">1 Hour</option>
                <option value="4h">4 Hours</option>
                <option value="1d">1 Day</option>
                <option value="1w">1 Week</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Coin</label>
              <select
                value={filters.coin}
                onChange={(e) => handleFilterChange('coin', e.target.value)}
              >
                <option value="all">All Coins</option>
                {coins.map(coin => (
                  <option key={coin} value={coin}>{coin}</option>
                ))}
              </select>
            </div>
            <div className="filter-stats">
              <span>Showing {filteredBots.length} of {bots.length} bots</span>
            </div>
          </div>
        </div>

        <div className="backtesting-section">
          <div className="backtest-header">
            <Calendar size={20} />
            <h3>Backtesting</h3>
          </div>
          <div className="backtest-controls">
            <div className="date-inputs">
              <div className="date-group">
                <label>Start Date</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                />
              </div>
              <div className="date-group">
                <label>End Date</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                />
              </div>
            </div>
            <button
              className="run-backtest-btn"
              onClick={runBacktest}
              disabled={loading}
            >
              <Play size={16} />
              Run Backtest
            </button>
          </div>

          {showBacktest && backtestResults.length > 0 && (
            <div className="backtest-results">
              <h4>Backtest Results</h4>
              <div className="results-grid">
                {backtestResults.slice(0, 10).map((result, idx) => (
                  <div key={idx} className="result-card">
                    <div className="result-bot">{result.bot_name}</div>
                    <div className="result-metrics">
                      <span className={result.success ? 'success' : 'failure'}>
                        {result.success ? '✓' : '✗'} {result.accuracy?.toFixed(1)}%
                      </span>
                      <span>{result.total_tested} tests</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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

      <SignalPerformanceCharts />
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
