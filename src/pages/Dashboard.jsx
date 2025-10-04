import React, { useState, useEffect } from 'react'
import { Play, Clock, Coins, Activity, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Circle } from 'lucide-react'
import { API_ENDPOINTS, getHeaders } from '../config/api'
import BotDetailsModal from '../components/BotDetailsModal'
import './Dashboard.css'

const ALL_BOTS = [
  'RSI Oversold/Overbought',
  'RSI Divergence',
  'MACD Crossover',
  'MACD Histogram',
  'EMA Golden Cross',
  'EMA Death Cross',
  'Bollinger Squeeze',
  'Bollinger Breakout',
  'Volume Spike',
  'Volume Breakout',
  'Funding Rate Arbitrage',
  'Open Interest Momentum',
  'Momentum Trader',
  'Mean Reversion',
  'Trend Following',
  'Breakout Hunter',
  'Support/Resistance',
  'Fibonacci Retracement',
  'Elliott Wave Pattern',
  'Order Flow Analysis',
  'Whale Activity Tracker',
  'Social Sentiment Analysis',
  'Options Flow Detector',
  'Ichimoku Cloud',
  'Parabolic SAR',
  'ADX Trend Strength',
  'Stochastic Oscillator',
  'CCI Commodity Channel',
  'Williams %R',
  'ATR Volatility',
  'OBV On-Balance Volume',
  'CMF Money Flow',
  'VWAP Trader',
  'Pivot Points',
  'Harmonic Patterns',
  'Chart Patterns',
  'Candlestick Patterns',
  'Price Action',
  'Wyckoff Method',
  'Market Profile',
  'Smart Money Concepts',
  'Liquidity Zones',
  'Fair Value Gaps',
  'Market Structure',
  'Supply/Demand Zones',
  'Accumulation/Distribution',
  'Market Sentiment',
  'Fear & Greed Index',
  'Exchange Flow',
  'Network Activity',
  'Hash Rate Analysis',
  'Miner Behavior',
  'Correlation Analysis',
  'Intermarket Analysis',
  'Seasonality Patterns',
  'Long/Short Ratio Tracker',
  '4H Trend Analyzer',
  'Multi-Timeframe Confluence',
  'Volume Profile Analysis',
]

const SCAN_TYPES = [
  { id: 'quick_scan', name: 'Quick Scan', duration: '45-60 sec', coins: 100, bots: 59, description: 'Fast analysis of top 100 coins. High-confidence signals only.', aiEnabled: false },
  { id: 'deep_analysis', name: 'Deep Analysis', duration: '2-3 min', coins: 50, bots: 59, description: 'AI-powered analysis using GPT-4 for advanced insights.', aiEnabled: true },
  { id: 'top200_scan', name: 'Top 200 Scan', duration: '2-3 min', coins: 200, bots: 59, description: 'Extensive market scan covering top 200 coins.', aiEnabled: false },
  { id: 'top500_scan', name: 'Top 500 Scan', duration: '4-5 min', coins: 500, bots: 59, description: 'Complete market coverage. Find hidden gems.', aiEnabled: false },
  { id: 'high_conviction', name: 'High Conviction', duration: '2-3 min', coins: 200, bots: 59, description: '80%+ bot consensus. Ultra-selective signals.', aiEnabled: false },
  { id: 'trending_coins', name: 'Trending Markets', duration: '2-3 min', coins: 200, bots: 59, description: 'Targets strong trending markets (ADX > 30).', aiEnabled: false },
  { id: 'reversal_opportunities', name: 'Reversal Opportunities', duration: '2-3 min', coins: 200, bots: 59, description: 'Oversold/overbought conditions and mean-reversion.', aiEnabled: false },
  { id: 'volatile_markets', name: 'Volatile Markets', duration: '2-3 min', coins: 200, bots: 59, description: 'High-volatility coins (ATR > 4%). Higher risk/reward.', aiEnabled: false },
  { id: 'whale_activity', name: 'Whale Activity', duration: '2-3 min', coins: 200, bots: 59, description: 'Large volume spikes and institutional movements.', aiEnabled: false },
  { id: 'futures_signals', name: 'Futures Signals', duration: '2-3 min', coins: 200, bots: 59, description: 'Funding rates, open interest, long/short ratios.', aiEnabled: false },
  { id: 'breakout_hunter', name: 'Breakout Hunter', duration: '2-3 min', coins: 200, bots: 59, description: 'Resistance/support breaks with volume confirmation.', aiEnabled: false },
  { id: 'ai_powered_scan', name: 'AI-Powered Full Scan', duration: '3-4 min', coins: 100, bots: 59, description: 'All 59 bots + GPT-4 deep analysis. Ultimate scan.', aiEnabled: true },
  { id: 'low_cap_gems', name: 'Low Cap Gems', duration: '3-4 min', coins: 300, bots: 59, description: 'Coins ranked 201-500. Discover small-cap opportunities.', aiEnabled: false },
  { id: 'elliott_wave_scan', name: 'Elliott Wave Scan', duration: '2-3 min', coins: 200, bots: 59, description: 'Elliott Wave + Fibonacci analysis. Wave completions.', aiEnabled: false },
  { id: 'custom_scan', name: 'Custom Scan', duration: 'Varies', coins: 'Custom', bots: 59, description: 'Fully customizable parameters.', aiEnabled: false },
]

function Dashboard() {
  const [selectedScan, setSelectedScan] = useState('quick_scan')
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(null)
  const [scanStatus, setScanStatus] = useState(null)
  const [error, setError] = useState(null)
  const [recommendations, setRecommendations] = useState(null)
  const [activeRecTab, setActiveRecTab] = useState('confidence')
  const [scanStartTime, setScanStartTime] = useState(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [selectedRecommendation, setSelectedRecommendation] = useState(null)
  const [showBotDetails, setShowBotDetails] = useState(false)

  useEffect(() => {
    fetchLatestRecommendations()
    const interval = setInterval(() => {
      if (isScanning) {
        checkScanStatus()
      }
      fetchLatestRecommendations()
    }, 10000)
    return () => clearInterval(interval)
  }, [isScanning])

  useEffect(() => {
    let timer
    if (isScanning && scanStartTime) {
      timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - scanStartTime) / 1000))
      }, 1000)
    } else {
      setElapsedTime(0)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [isScanning, scanStartTime])

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
        if (!scanStartTime) {
          setScanStartTime(Date.now())
        }
      } else {
        setIsScanning(false)
        setScanProgress(null)
        setScanStartTime(null)
      }
    } catch (err) {
      console.error('Error checking scan status:', err)
    }
  }

  const fetchLatestRecommendations = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.scanLatest, {
        headers: getHeaders(),
      })
      const data = await response.json()

      if (data.recommendations && data.recommendations.length > 0) {
        setRecommendations(data.recommendations)
      }
    } catch (err) {
      console.error('Error fetching recommendations:', err)
    }
  }

  const startScan = async () => {
    setError(null)
    setIsScanning(true)
    setScanStartTime(Date.now())
    setElapsedTime(0)

    const scanConfig = SCAN_TYPES.find(s => s.id === selectedScan)
    const coinLimit = typeof scanConfig?.coins === 'number' ? scanConfig.coins : 100

    try {
      const response = await fetch(API_ENDPOINTS.scanRun, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          scanType: selectedScan,
          filterScope: 'all',
          interval: '4h',
          coinLimit: coinLimit,
          useDeepAI: scanConfig?.aiEnabled || false
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
      setScanStartTime(null)
    }
  }

  const selectedScanInfo = SCAN_TYPES.find(s => s.id === selectedScan)

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getTopRecommendations = (recs, tab) => {
    let sorted = [...recs]

    switch (tab) {
      case 'confidence':
        sorted.sort((a, b) => b.avg_confidence - a.avg_confidence)
        break
      case 'percent':
        sorted.sort((a, b) => {
          const aPercent = Math.abs(((a.avg_predicted_24h - a.current_price) / a.current_price) * 100)
          const bPercent = Math.abs(((b.avg_predicted_24h - b.current_price) / b.current_price) * 100)
          return bPercent - aPercent
        })
        break
      case 'volume':
        sorted.sort((a, b) => {
          const aVolume = Math.abs(a.avg_predicted_24h - a.current_price)
          const bVolume = Math.abs(b.avg_predicted_24h - b.current_price)
          return bVolume - aVolume
        })
        break
      default:
        break
    }

    return sorted.slice(0, 8)
  }

  const openBotDetails = (recommendation) => {
    setSelectedRecommendation(recommendation)
    setShowBotDetails(true)
  }

  const closeBotDetails = () => {
    setShowBotDetails(false)
    setSelectedRecommendation(null)
  }

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
          {isScanning ? (
            <span>
              Scan in Progress... <span className="scan-timer">{formatTime(elapsedTime)}</span>
            </span>
          ) : (
            'Start Scan'
          )}
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
            <span className="stat-value">59</span>
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

      {recommendations && recommendations.length > 0 && (
        <div className="recommendations-section">
          <div className="recommendations-header">
            <h2>Latest Recommendations</h2>
            <p>Top opportunities from the latest scan</p>
          </div>

          <div className="recommendations-tabs">
            <button
              className={`rec-tab ${activeRecTab === 'confidence' ? 'active' : ''}`}
              onClick={() => setActiveRecTab('confidence')}
            >
              Top 8 Most Confident
            </button>
            <button
              className={`rec-tab ${activeRecTab === 'percent' ? 'active' : ''}`}
              onClick={() => setActiveRecTab('percent')}
            >
              Top 8 % Movers
            </button>
            <button
              className={`rec-tab ${activeRecTab === 'volume' ? 'active' : ''}`}
              onClick={() => setActiveRecTab('volume')}
            >
              Top 8 $ Volume
            </button>
          </div>

          <div className="recommendations-grid">
            {getTopRecommendations(recommendations, activeRecTab).map((rec, index) => (
              <RecommendationCard
                key={index}
                recommendation={rec}
                rank={index + 1}
                onBotDetailsClick={openBotDetails}
              />
            ))}
          </div>
        </div>
      )}

      {showBotDetails && selectedRecommendation && (
        <BotDetailsModal
          recommendation={selectedRecommendation}
          onClose={closeBotDetails}
        />
      )}

      <div className="info-cards">
        <div className="info-card">
          <h3>How It Works</h3>
          <ul>
            <li>59 specialized trading bots analyze market data</li>
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

      <div className="bots-status-section">
        <div className="bots-status-header">
          <h2>Trading Bots Status</h2>
          <p>All 59 bots operational and ready</p>
        </div>
        <div className="bots-grid">
          {ALL_BOTS.map((botName, index) => (
            <BotStatusCard key={index} botName={botName} isActive={true} />
          ))}
        </div>
      </div>
    </div>
  )
}

function BotStatusCard({ botName, isActive }) {
  return (
    <div className={`bot-status-card ${isActive ? 'active' : 'inactive'}`}>
      <div className="bot-status-indicator">
        {isActive ? (
          <CheckCircle size={16} className="status-icon active" />
        ) : (
          <Circle size={16} className="status-icon inactive" />
        )}
      </div>
      <div className="bot-status-info">
        <span className="bot-status-name">{botName}</span>
        <span className={`bot-status-label ${isActive ? 'active' : 'inactive'}`}>
          {isActive ? 'Operational' : 'Offline'}
        </span>
      </div>
    </div>
  )
}

function RecommendationCard({ recommendation, rank, onBotDetailsClick }) {
  const isLong = recommendation.consensus_direction?.toUpperCase() === 'LONG'
  const confidenceScore = (recommendation.avg_confidence * 10).toFixed(1)

  const calculateRisk = () => {
    const stopLossDistance = Math.abs((recommendation.avg_stop_loss - recommendation.current_price) / recommendation.current_price) * 100
    const takeProfitDistance = Math.abs((recommendation.avg_take_profit - recommendation.current_price) / recommendation.current_price) * 100
    const riskRewardRatio = takeProfitDistance / stopLossDistance

    return {
      stopLossPercent: stopLossDistance.toFixed(2),
      takeProfitPercent: takeProfitDistance.toFixed(2),
      riskReward: riskRewardRatio.toFixed(2),
      positionSize: Math.min((2 / stopLossDistance) * 100, 10).toFixed(2)
    }
  }

  const risk = calculateRisk()

  const predicted24h = recommendation.avg_predicted_24h
  const predicted48h = recommendation.avg_predicted_48h
  const predicted7d = recommendation.avg_predicted_7d
  const currentPrice = recommendation.current_price

  const change24h = ((predicted24h - currentPrice) / currentPrice) * 100
  const change48h = ((predicted48h - currentPrice) / currentPrice) * 100
  const change7d = ((predicted7d - currentPrice) / currentPrice) * 100

  const getChangeColor = (change) => {
    return change >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
  }

  const confidencePercent = (recommendation.avg_confidence * 100).toFixed(0)

  return (
    <div className="rec-card">
      <div className="rec-card-header">
        <div className="rec-rank">#{rank}</div>
        <div className="rec-coin-info">
          <h3>{recommendation.ticker}</h3>
          <span className="rec-coin-name">{recommendation.coin}</span>
        </div>
        <div className={`rec-direction-badge ${isLong ? 'bull' : 'bear'}`}>
          <span className="direction-icon">{isLong ? '●' : '●'}</span>
          {isLong ? 'BULL' : 'BEAR'}
        </div>
        <div className={`rec-position-badge ${isLong ? 'long' : 'short'}`}>
          {isLong ? 'LONG' : 'SHORT'}
        </div>
      </div>

      <div className="rec-confidence-gauge">
        <svg viewBox="0 0 200 120" className="gauge-svg">
          <defs>
            <linearGradient id={`gauge-gradient-${rank}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: 'var(--accent-red)', stopOpacity: 1 }} />
              <stop offset="50%" style={{ stopColor: 'var(--accent-yellow)', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: 'var(--accent-green)', stopOpacity: 1 }} />
            </linearGradient>
          </defs>
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="var(--bg-tertiary)"
            strokeWidth="20"
            strokeLinecap="round"
          />
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={`url(#gauge-gradient-${rank})`}
            strokeWidth="20"
            strokeLinecap="round"
            strokeDasharray={`${confidencePercent * 2.51} 251`}
          />
          <text x="100" y="85" textAnchor="middle" className="gauge-value">
            {confidenceScore}/10
          </text>
          <text x="100" y="105" textAnchor="middle" className="gauge-label">
            {confidencePercent}%
          </text>
        </svg>
      </div>

      <div className="rec-current-price">
        <span className="rec-price-label">Current Price</span>
        <span className="rec-price-value">${currentPrice.toFixed(8)}</span>
      </div>

      <div className="rec-predictions">
        <div className="rec-prediction-header">AI Predicted Prices</div>
        <div className="rec-prediction-item">
          <span className="pred-timeframe">24h</span>
          <span className="pred-price" style={{ color: getChangeColor(change24h) }}>
            ${predicted24h.toFixed(8)}
          </span>
          <span className="pred-change" style={{ color: getChangeColor(change24h) }}>
            ({change24h >= 0 ? '+' : ''}{change24h.toFixed(3)}%)
          </span>
        </div>
        <div className="rec-prediction-item">
          <span className="pred-timeframe">48h</span>
          <span className="pred-price" style={{ color: getChangeColor(change48h) }}>
            ${predicted48h.toFixed(8)}
          </span>
          <span className="pred-change" style={{ color: getChangeColor(change48h) }}>
            ({change48h >= 0 ? '+' : ''}{change48h.toFixed(3)}%)
          </span>
        </div>
        <div className="rec-prediction-item">
          <span className="pred-timeframe">7d</span>
          <span className="pred-price" style={{ color: getChangeColor(change7d) }}>
            ${predicted7d.toFixed(8)}
          </span>
          <span className="pred-change" style={{ color: getChangeColor(change7d) }}>
            ({change7d >= 0 ? '+' : ''}{change7d.toFixed(3)}%)
          </span>
        </div>
      </div>

      <div className="rec-tp-sl">
        <div className="rec-tp-sl-header">Average TP/SL (from {recommendation.bot_count} bots)</div>
        <div className="rec-tp-sl-item">
          <span className="tp-sl-label">Take Profit</span>
          <span className="tp-sl-value" style={{ color: 'var(--accent-green)' }}>
            ${recommendation.avg_take_profit.toFixed(8)}
          </span>
          <span className="tp-sl-percent" style={{ color: 'var(--accent-green)' }}>
            (+{(((recommendation.avg_take_profit - currentPrice) / currentPrice) * 100).toFixed(3)}%)
          </span>
        </div>
        <div className="rec-tp-sl-item">
          <span className="tp-sl-label">Stop Loss</span>
          <span className="tp-sl-value" style={{ color: 'var(--accent-red)' }}>
            ${recommendation.avg_stop_loss.toFixed(8)}
          </span>
          <span className="tp-sl-percent" style={{ color: 'var(--accent-red)' }}>
            ({(((recommendation.avg_stop_loss - currentPrice) / currentPrice) * 100).toFixed(3)}%)
          </span>
        </div>
      </div>

      <div className="rec-risk-calculator">
        <div className="risk-header">Risk Calculator</div>
        <div className="risk-grid">
          <div className="risk-item">
            <span className="risk-label">Stop Loss Distance</span>
            <span className="risk-value" style={{ color: 'var(--accent-red)' }}>{risk.stopLossPercent}%</span>
          </div>
          <div className="risk-item">
            <span className="risk-label">Take Profit Distance</span>
            <span className="risk-value" style={{ color: 'var(--accent-green)' }}>{risk.takeProfitPercent}%</span>
          </div>
          <div className="risk-item">
            <span className="risk-label">Risk/Reward Ratio</span>
            <span className="risk-value" style={{ color: risk.riskReward >= 2 ? 'var(--accent-green)' : 'var(--accent-yellow)' }}>
              1:{risk.riskReward}
            </span>
          </div>
          <div className="risk-item">
            <span className="risk-label">Suggested Position Size</span>
            <span className="risk-value">{risk.positionSize}%</span>
          </div>
        </div>
      </div>

      <div className="rec-regime-badge">
        <span className="regime-label">Market Regime:</span>
        <span className={`regime-value regime-${recommendation.market_regime?.toLowerCase()}`}>
          {recommendation.market_regime === 'BULL' ? '🐂' : recommendation.market_regime === 'BEAR' ? '🐻' : '↔️'} {recommendation.market_regime}
        </span>
        <span className="regime-confidence">
          ({(recommendation.regime_confidence * 100).toFixed(0)}% confidence)
        </span>
      </div>

      <div className="rec-actions">
        <button className="rec-btn rec-btn-secondary">Copy Trade</button>
        <button
          className="rec-btn rec-btn-primary"
          onClick={() => onBotDetailsClick(recommendation)}
        >
          Bot Details ({recommendation.bot_count})
        </button>
      </div>
    </div>
  )
}

export default Dashboard
