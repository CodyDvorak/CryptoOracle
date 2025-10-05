import React, { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Filter, Dessert as SortDesc, Users, Clock, Target, Shield } from 'lucide-react'
import { supabase } from '../config/api'
import './BotPredictionsPanel.css'

const BOT_CATEGORIES = {
  trend: {
    name: 'Trend Following',
    bots: ['EMA', 'SMA', 'MACD', 'ADX', 'SuperTrend', 'Trend', 'Parabolic SAR', 'Ichimoku', 'Linear Regression', 'Vortex', 'Aroon', 'Heikin-Ashi']
  },
  momentum: {
    name: 'Momentum & Oscillators',
    bots: ['RSI', 'Stochastic', 'CCI', 'Williams', 'Momentum', 'Rate of Change', 'Money Flow', 'Ultimate Oscillator', 'Accumulation']
  },
  volume: {
    name: 'Volume & Liquidity',
    bots: ['Volume', 'VWAP', 'Order Flow', 'Liquidity', 'OBV']
  },
  volatility: {
    name: 'Volatility & Range',
    bots: ['ATR', 'Bollinger', 'Keltner', 'Donchian', 'Volatility', 'Envelope', 'Z-Score', 'Consolidation', 'Mean Reversion']
  },
  pattern: {
    name: 'Pattern Recognition',
    bots: ['Fibonacci', 'Harmonic', 'Chart Pattern', 'Candlestick', 'Elliott Wave', 'Wyckoff', 'Supply/Demand', 'Support/Resistance', 'Pivot']
  },
  derivatives: {
    name: 'Derivatives & Futures',
    bots: ['Funding Rate', 'Open Interest', 'Options Flow', 'Long/Short']
  },
  contrarian: {
    name: 'Contrarian/Reversal',
    bots: ['Reversal', 'Fade']
  },
  specialized: {
    name: 'Specialized',
    bots: ['Swing', 'Conservative', 'Scalping', 'Divergence', 'Smart Money', 'Fair Value']
  }
}

function BotPredictionsPanel({ runId, coinSymbol: initialCoin }) {
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCoin, setSelectedCoin] = useState(initialCoin || 'all')
  const [sortBy, setSortBy] = useState('confidence')
  const [groupBy, setGroupBy] = useState('none')
  const [filterDirection, setFilterDirection] = useState('all')
  const [availableCoins, setAvailableCoins] = useState([])

  useEffect(() => {
    fetchBotPredictions()
  }, [runId, selectedCoin])

  const fetchBotPredictions = async () => {
    if (!runId) return

    setLoading(true)
    try {
      let query = supabase
        .from('bot_predictions')
        .select('*')
        .eq('run_id', runId)
        .order('confidence_score', { ascending: false })

      if (selectedCoin && selectedCoin !== 'all') {
        query = query.eq('coin_symbol', selectedCoin)
      }

      const { data, error } = await query

      if (error) throw error

      setPredictions(data || [])

      // Extract unique coins for filter
      if (!selectedCoin || selectedCoin === 'all') {
        const coins = [...new Set((data || []).map(p => p.coin_symbol))].sort()
        setAvailableCoins(coins)
      }
    } catch (err) {
      console.error('Error fetching bot predictions:', err)
    } finally {
      setLoading(false)
    }
  }

  const getBotCategory = (botName) => {
    for (const [key, category] of Object.entries(BOT_CATEGORIES)) {
      if (category.bots.some(bot => botName.includes(bot))) {
        return key
      }
    }
    return 'specialized'
  }

  const getFilteredAndSortedPredictions = () => {
    let filtered = [...predictions]

    // Filter by direction
    if (filterDirection !== 'all') {
      filtered = filtered.filter(p => p.position_direction === filterDirection)
    }

    // Sort
    switch (sortBy) {
      case 'confidence':
        filtered.sort((a, b) => b.confidence_score - a.confidence_score)
        break
      case 'confidence_asc':
        filtered.sort((a, b) => a.confidence_score - b.confidence_score)
        break
      case 'bot_name':
        filtered.sort((a, b) => a.bot_name.localeCompare(b.bot_name))
        break
      case 'timestamp':
        filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        break
      default:
        break
    }

    return filtered
  }

  const getGroupedPredictions = () => {
    const filtered = getFilteredAndSortedPredictions()

    if (groupBy === 'none') {
      return { 'All Predictions': filtered }
    }

    if (groupBy === 'category') {
      const grouped = {}
      filtered.forEach(pred => {
        const category = getBotCategory(pred.bot_name)
        const categoryName = BOT_CATEGORIES[category].name
        if (!grouped[categoryName]) {
          grouped[categoryName] = []
        }
        grouped[categoryName].push(pred)
      })
      return grouped
    }

    if (groupBy === 'direction') {
      return {
        'LONG Predictions': filtered.filter(p => p.position_direction === 'LONG'),
        'SHORT Predictions': filtered.filter(p => p.position_direction === 'SHORT')
      }
    }

    if (groupBy === 'confidence') {
      return {
        'High Confidence (≥0.7)': filtered.filter(p => p.confidence_score >= 0.7),
        'Medium Confidence (0.5-0.7)': filtered.filter(p => p.confidence_score >= 0.5 && p.confidence_score < 0.7),
        'Low Confidence (<0.5)': filtered.filter(p => p.confidence_score < 0.5)
      }
    }

    return { 'All Predictions': filtered }
  }

  const groupedPredictions = getGroupedPredictions()

  const getStats = () => {
    const total = predictions.length
    const longCount = predictions.filter(p => p.position_direction === 'LONG').length
    const shortCount = predictions.filter(p => p.position_direction === 'SHORT').length
    const avgConfidence = predictions.length > 0
      ? predictions.reduce((sum, p) => sum + p.confidence_score, 0) / predictions.length
      : 0

    return { total, longCount, shortCount, avgConfidence }
  }

  const stats = getStats()

  if (loading) {
    return <div className="bot-predictions-loading">Loading bot predictions...</div>
  }

  return (
    <div className="bot-predictions-panel">
      <div className="panel-header">
        <h2>Individual Bot Predictions</h2>
        <p>Detailed predictions from all {stats.total} bot analyses</p>
      </div>

      <div className="predictions-stats">
        <div className="stat-item">
          <Users size={20} />
          <div>
            <span className="stat-label">Total Bots</span>
            <span className="stat-value">{stats.total}</span>
          </div>
        </div>
        <div className="stat-item long">
          <TrendingUp size={20} />
          <div>
            <span className="stat-label">Long Predictions</span>
            <span className="stat-value">{stats.longCount}</span>
          </div>
        </div>
        <div className="stat-item short">
          <TrendingDown size={20} />
          <div>
            <span className="stat-label">Short Predictions</span>
            <span className="stat-value">{stats.shortCount}</span>
          </div>
        </div>
        <div className="stat-item">
          <Target size={20} />
          <div>
            <span className="stat-label">Avg Confidence</span>
            <span className="stat-value">{(stats.avgConfidence * 10).toFixed(1)}/10</span>
          </div>
        </div>
      </div>

      <div className="predictions-controls">
        <div className="control-group">
          <label><Filter size={16} /> Coin</label>
          <select value={selectedCoin} onChange={(e) => setSelectedCoin(e.target.value)}>
            <option value="all">All Coins ({availableCoins.length})</option>
            {availableCoins.map(coin => (
              <option key={coin} value={coin}>{coin}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label><Filter size={16} /> Direction</label>
          <select value={filterDirection} onChange={(e) => setFilterDirection(e.target.value)}>
            <option value="all">All</option>
            <option value="LONG">Long Only</option>
            <option value="SHORT">Short Only</option>
          </select>
        </div>

        <div className="control-group">
          <label><SortDesc size={16} /> Sort By</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="confidence">Confidence (High→Low)</option>
            <option value="confidence_asc">Confidence (Low→High)</option>
            <option value="bot_name">Bot Name (A→Z)</option>
            <option value="timestamp">Timestamp (Recent First)</option>
          </select>
        </div>

        <div className="control-group">
          <label><Users size={16} /> Group By</label>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="none">No Grouping</option>
            <option value="category">Bot Category</option>
            <option value="direction">Direction (Long/Short)</option>
            <option value="confidence">Confidence Level</option>
          </select>
        </div>
      </div>

      <div className="predictions-list">
        {Object.entries(groupedPredictions).map(([groupName, groupPreds]) => (
          groupPreds.length > 0 && (
            <div key={groupName} className="prediction-group">
              {groupBy !== 'none' && (
                <div className="group-header">
                  <h3>{groupName}</h3>
                  <span className="group-count">{groupPreds.length} predictions</span>
                </div>
              )}
              <div className="predictions-grid">
                {groupPreds.map((prediction) => (
                  <BotPredictionCard key={prediction.id} prediction={prediction} />
                ))}
              </div>
            </div>
          )
        ))}
      </div>

      {predictions.length === 0 && (
        <div className="no-predictions">
          <p>No bot predictions found for this scan</p>
        </div>
      )}
    </div>
  )
}

function BotPredictionCard({ prediction }) {
  const isLong = prediction.position_direction === 'LONG'
  const confidencePercent = (prediction.confidence_score * 10).toFixed(1)
  const confidenceColor = prediction.confidence_score >= 0.7 ? 'high' : prediction.confidence_score >= 0.5 ? 'medium' : 'low'

  const riskReward = prediction.target_price && prediction.stop_loss
    ? Math.abs((prediction.target_price - prediction.entry_price) / (prediction.entry_price - prediction.stop_loss)).toFixed(2)
    : 'N/A'

  const potentialGain = prediction.target_price
    ? (((prediction.target_price - prediction.entry_price) / prediction.entry_price) * 100).toFixed(2)
    : 'N/A'

  const potentialLoss = prediction.stop_loss
    ? (((prediction.stop_loss - prediction.entry_price) / prediction.entry_price) * 100).toFixed(2)
    : 'N/A'

  // Historical tracking data
  const hasOutcome = prediction.outcome_status && prediction.outcome_price
  const actualChange = hasOutcome
    ? (((prediction.outcome_price - prediction.entry_price) / prediction.entry_price) * 100).toFixed(2)
    : null

  return (
    <div className={`bot-prediction-card ${isLong ? 'long' : 'short'}`}>
      <div className="card-header">
        <div className="bot-name">
          <strong>{prediction.bot_name}</strong>
        </div>
        <div className={`direction-badge ${isLong ? 'long' : 'short'}`}>
          {isLong ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          {prediction.position_direction}
        </div>
      </div>

      {prediction.coin_symbol && (
        <div className="coin-badge">
          {prediction.coin_symbol} - {prediction.coin_name}
        </div>
      )}

      <div className="confidence-bar-container">
        <div className="confidence-label">
          <span>Confidence</span>
          <span className={`confidence-value ${confidenceColor}`}>{confidencePercent}/10</span>
        </div>
        <div className="confidence-bar">
          <div
            className={`confidence-fill ${confidenceColor}`}
            style={{ width: `${prediction.confidence_score * 100}%` }}
          />
        </div>
      </div>

      <div className="prediction-prices">
        <div className="price-item">
          <span className="label">Entry</span>
          <span className="value">${prediction.entry_price?.toFixed(4)}</span>
        </div>
        <div className="price-item target">
          <span className="label">Target</span>
          <span className="value">${prediction.target_price?.toFixed(4)}</span>
          <span className="percent">+{potentialGain}%</span>
        </div>
        <div className="price-item stop">
          <span className="label">Stop Loss</span>
          <span className="value">${prediction.stop_loss?.toFixed(4)}</span>
          <span className="percent">{potentialLoss}%</span>
        </div>
      </div>

      <div className="prediction-metadata">
        {prediction.leverage && (
          <div className="meta-item">
            <Shield size={14} />
            <span>{prediction.leverage}x Leverage</span>
          </div>
        )}
        {prediction.market_regime && (
          <div className="meta-item">
            <span className="regime-badge">{prediction.market_regime}</span>
          </div>
        )}
        {riskReward !== 'N/A' && (
          <div className="meta-item">
            <Target size={14} />
            <span>R/R: 1:{riskReward}</span>
          </div>
        )}
      </div>

      {hasOutcome && (
        <div className={`prediction-outcome ${prediction.outcome_status}`}>
          <div className="outcome-header">
            <strong>Outcome:</strong>
            <span className={`outcome-badge ${prediction.outcome_status}`}>
              {prediction.outcome_status.toUpperCase()}
            </span>
          </div>
          <div className="outcome-details">
            <div className="outcome-item">
              <span className="label">Actual Price</span>
              <span className="value">${prediction.outcome_price?.toFixed(4)}</span>
            </div>
            <div className="outcome-item">
              <span className="label">Actual Change</span>
              <span className={`value ${parseFloat(actualChange) >= 0 ? 'positive' : 'negative'}`}>
                {parseFloat(actualChange) >= 0 ? '+' : ''}{actualChange}%
              </span>
            </div>
            {prediction.profit_loss_percent && (
              <div className="outcome-item">
                <span className="label">P/L</span>
                <span className={`value ${prediction.profit_loss_percent >= 0 ? 'positive' : 'negative'}`}>
                  {prediction.profit_loss_percent >= 0 ? '+' : ''}{prediction.profit_loss_percent.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
          {prediction.outcome_checked_at && (
            <div className="outcome-timestamp">
              Checked: {new Date(prediction.outcome_checked_at).toLocaleString()}
            </div>
          )}
        </div>
      )}

      <div className="prediction-timestamp">
        <Clock size={12} />
        <span>{new Date(prediction.timestamp).toLocaleString()}</span>
      </div>
    </div>
  )
}

export default BotPredictionsPanel
