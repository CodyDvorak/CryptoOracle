import React, { useState, useEffect } from 'react'
import { Play, Clock, Coins, Activity, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Circle } from 'lucide-react'
import { API_ENDPOINTS, getHeaders } from '../config/api'
import BotDetailsModal from '../components/BotDetailsModal'
import { supabase } from '../config/api'
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
  'SMA Cross',
  'EMA Ribbon',
  'EMA Cross',
  'SuperTrend',
  'Trend Strength',
  'Linear Regression',
  'Triple MA',
  'Vortex Indicator',
  'Aroon Indicator',
  'Heikin-Ashi',
  'Rate of Change',
  'Money Flow Index',
  'Ultimate Oscillator',
  'Keltner Channel',
  'Donchian Channel',
  'Moving Average Envelope',
  'Volatility Breakout',
  'Z-Score Mean Reversion',
  'Consolidation Breakout',
  'Swing Trading',
  'Conservative',
  'Scalping',
  'Divergence Detection',
  'RSI Reversal',
  'Bollinger Reversal',
  'Stochastic Reversal',
  'Volume Price Trend',
  'Volume Spike Fade',
]

const SCAN_TYPES = [
  { id: 'quick_scan', name: 'Quick Scan', duration: '7-8 min', coins: 100, bots: 87, description: 'Real-time TA analysis of top 100 coins using 87 specialized bots. Market regime classification with confidence gating.', aiEnabled: false },
  { id: 'deep_analysis', name: 'Deep Analysis', duration: '4-5 min', coins: 50, bots: 87, description: 'Comprehensive OHLCV + derivatives analysis with regime-aware bot weighting across all 87 bots.', aiEnabled: true },
  { id: 'top200_scan', name: 'Top 200 Scan', duration: '14-16 min', coins: 200, bots: 87, description: 'Extensive market scan with real API data across CMC, CoinGecko, CryptoCompare analyzed by 87 bots.', aiEnabled: false },
  { id: 'top500_scan', name: 'Top 500 Scan', duration: '35-40 min', coins: 500, bots: 87, description: 'Complete market coverage with all 87 bots. Multi-provider fallback ensures data quality.', aiEnabled: false },
  { id: 'high_conviction', name: 'High Conviction', duration: '14-16 min', coins: 200, bots: 87, description: '80%+ bot consensus detection across 87 bots. Strong agreement signals only.', aiEnabled: false },
  { id: 'trending_coins', name: 'Trending Markets', duration: '14-16 min', coins: 200, bots: 87, description: 'BULL regime detection (ADX > 25, golden alignment, momentum confirmation) using 26 trend-following bots.', aiEnabled: false },
  { id: 'reversal_opportunities', name: 'Reversal Opportunities', duration: '14-16 min', coins: 200, bots: 87, description: 'Mean-reversion strategies in SIDEWAYS regimes. RSI divergence + Bollinger squeeze + contrarian bots.', aiEnabled: false },
  { id: 'volatile_markets', name: 'Volatile Markets', duration: '14-16 min', coins: 200, bots: 87, description: 'High ATR (>4%) analyzed by 12 volatility bots. Expanded Bollinger Bands + Keltner Channels.', aiEnabled: false },
  { id: 'whale_activity', name: 'Whale Activity', duration: '14-16 min', coins: 200, bots: 87, description: 'Volume spike detection (>2.5x average) with 10 volume-based bots. Large price impact tracking.', aiEnabled: false },
  { id: 'futures_signals', name: 'Futures Signals', duration: '14-16 min', coins: 200, bots: 87, description: 'Real derivatives data: OKX funding rates, Binance OI, long/short ratios analyzed by 5 derivatives bots.', aiEnabled: false },
  { id: 'breakout_hunter', name: 'Breakout Hunter', duration: '14-16 min', coins: 200, bots: 87, description: 'Support/resistance breaks with volume confirmation using Donchian Channel + pattern recognition bots.', aiEnabled: false },
  { id: 'ai_powered_scan', name: 'AI-Powered Full Scan', duration: '8-10 min', coins: 100, bots: 87, description: 'All 87 bots + TokenMetrics AI + market regime classification + multi-layer consensus.', aiEnabled: true },
  { id: 'low_cap_gems', name: 'Low Cap Gems', duration: '22-25 min', coins: 300, bots: 87, description: 'Coins ranked 201-500 analyzed by all 87 bots with regime detection and on-chain metrics.', aiEnabled: false },
  { id: 'elliott_wave_scan', name: 'Elliott Wave Scan', duration: '14-16 min', coins: 200, bots: 87, description: 'Fibonacci retracement + Elliott Wave + Harmonic patterns analyzed by 10 pattern recognition bots.', aiEnabled: false },
  { id: 'custom_scan', name: 'Custom Scan', duration: 'Varies', coins: 'Custom', bots: 87, description: 'Fully customizable with all 87 bots and regime-aware weighting across all categories.', aiEnabled: false },
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

    const recommendationsChannel = supabase
      .channel('recommendations-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'recommendations'
        },
        (payload) => {
          console.log('New recommendation:', payload.new)
          setRecommendations(prev => [payload.new, ...prev].slice(0, 50))
        }
      )
      .subscribe()

    const scanRunsChannel = supabase
      .channel('scan-runs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scan_runs'
        },
        (payload) => {
          console.log('Scan status update:', payload)
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const scan = payload.new
            if (scan.status === 'running') {
              setIsScanning(true)
              setScanProgress(scan.progress)
              setScanStatus(scan.scan_type)
              if (!scanStartTime) {
                setScanStartTime(Date.now())
              }
            } else if (scan.status === 'completed' || scan.status === 'failed') {
              setIsScanning(false)
              setScanProgress(null)
              setScanStartTime(null)
              setTimeout(() => {
                fetchLatestRecommendations()
              }, 1000)
            }
          }
        }
      )
      .subscribe()

    const interval = setInterval(() => {
      if (isScanning) {
        checkScanStatus()
      }
    }, 5000)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(recommendationsChannel)
      supabase.removeChannel(scanRunsChannel)
    }
  }, [isScanning, scanStartTime])

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
        if (isScanning) {
          console.log('Scan completed, fetching recommendations...')
          setIsScanning(false)
          setScanProgress(null)
          setScanStartTime(null)
          setTimeout(() => {
            fetchLatestRecommendations()
          }, 1000)
        }
      }
    } catch (err) {
      console.error('Error checking scan status:', err)
    }
  }

  const fetchLatestRecommendations = async () => {
    try {
      console.log('Fetching latest recommendations...')
      const response = await fetch(API_ENDPOINTS.scanLatest, {
        headers: getHeaders(),
      })
      const data = await response.json()

      console.log('Recommendations response:', data)

      if (data.recommendations) {
        if (data.recommendations.length > 0) {
          console.log(`Found ${data.recommendations.length} recommendations`)
          setRecommendations(data.recommendations)
        } else {
          console.log('Scan completed but no recommendations found')
          setRecommendations([])
        }
      }
    } catch (err) {
      console.error('Error fetching recommendations:', err)
      setError('Failed to fetch recommendations: ' + err.message)
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
          useDeepAI: scanConfig?.aiEnabled || false,
          confidenceThreshold: 0.60
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
            <li><strong>Data Collection:</strong> Real-time OHLCV data from CMC, CoinGecko, CryptoCompare with multi-provider fallback</li>
            <li><strong>Derivatives Integration:</strong> Live funding rates, open interest, and long/short ratios from OKX and Binance</li>
            <li><strong>On-Chain Analysis:</strong> Whale movements, exchange flows, network activity, and smart money tracking</li>
            <li><strong>87 Specialized Bots:</strong> 26 trend-following, 18 momentum, 10 volume, 12 volatility, 10 pattern recognition, 5 derivatives, and 6 specialized strategy bots</li>
            <li><strong>Bot Voting System:</strong> Every bot votes LONG/SHORT with confidence score (1-10) based on its strategy</li>
            <li><strong>Market Regime Detection:</strong> Classifies market as BULL (trending up), BEAR (trending down), or SIDEWAYS</li>
            <li><strong>Regime-Aware Weighting:</strong> Momentum bots weighted higher in trends, mean-reversion bots in ranging markets</li>
            <li><strong>Multi-Timeframe Analysis:</strong> 4H, 1D, and 1W timeframes analyzed for confluence and alignment</li>
            <li><strong>Consensus Generation:</strong> Aggregates all bot votes with regime-aware weighting to generate final recommendation</li>
            <li><strong>AI Refinement (Optional):</strong> GPT-4 analyzes patterns, sentiment, and provides enhanced insights</li>
            <li><strong>Risk Calculation:</strong> Automatic TP/SL levels, risk/reward ratios, and position sizing suggestions</li>
            <li><strong>Confidence Gating:</strong> Only high-confidence signals (threshold varies by scan type) are returned</li>
          </ul>
        </div>

        <div className="info-card">
          <h3>Scan Types</h3>
          <ul>
            <li><strong>Quick Scan:</strong> 7-8 min, 100 coins - Real-time TA analysis with market regime classification</li>
            <li><strong>Deep Analysis:</strong> 4-5 min, 50 coins - Comprehensive OHLCV + derivatives with AI refinement</li>
            <li><strong>Top 200/500 Scan:</strong> 14-40 min - Extended market coverage across multiple data providers</li>
            <li><strong>High Conviction:</strong> 14-16 min - 80%+ bot consensus signals only</li>
            <li><strong>Trending Markets:</strong> 14-16 min - BULL regime detection with momentum confirmation</li>
            <li><strong>Reversal Opportunities:</strong> 14-16 min - Mean-reversion setups in SIDEWAYS regimes</li>
            <li><strong>Volatile Markets:</strong> 14-16 min - High ATR (&gt;4%) coins with expanded Bollinger Bands</li>
            <li><strong>Whale Activity:</strong> 14-16 min - Volume spike detection and large order flow tracking</li>
            <li><strong>Futures Signals:</strong> 14-16 min - Real derivatives data: funding rates, OI, long/short ratios</li>
            <li><strong>Breakout Hunter:</strong> 14-16 min - Support/resistance breaks with volume confirmation</li>
            <li><strong>AI-Powered Full Scan:</strong> 8-10 min - All 87 bots + TokenMetrics AI + multi-layer consensus</li>
            <li><strong>Low Cap Gems:</strong> 22-25 min - Coins ranked 201-500 with strong technical signals</li>
            <li><strong>Elliott Wave Scan:</strong> 14-16 min - Fibonacci levels + wave pattern detection</li>
            <li><strong>Custom Scan:</strong> Varies - Fully customizable parameters and bot selection</li>
          </ul>
        </div>
      </div>

      <div className="bots-status-section">
        <div className="bots-status-header">
          <h2>Trading Bots Status</h2>
          <p>All 87 bots operational and ready</p>
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
