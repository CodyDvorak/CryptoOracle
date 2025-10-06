import React, { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Activity, DollarSign, Users, TriangleAlert as AlertTriangle, Zap, Target, ShieldAlert, BarChart3, Newspaper, MessageCircle } from 'lucide-react'
import { supabase } from '../config/api'
import MarketCorrelation from '../components/MarketCorrelation'
import RealtimeUpdates from '../components/RealtimeUpdates'
import MarketRegimeTimeline from '../components/MarketRegimeTimeline'
import NewsSection from '../components/NewsSection'
import './Insights.css'

function Insights() {
  const [loading, setLoading] = useState(true)
  const [selectedCoin, setSelectedCoin] = useState('BTC')
  const [insights, setInsights] = useState(null)
  const [availableCoins, setAvailableCoins] = useState(['BTC', 'ETH', 'SOL'])
  const [timeRange, setTimeRange] = useState('24h')
  const [viewMode, setViewMode] = useState('all')

  const VIEW_MODES = [
    { id: 'all', name: 'All Signals', icon: '🎯', botFilter: null },
    { id: 'whale_activity', name: 'Whale Activity', icon: '🐋', botFilter: ['Whale Activity Tracker', 'Order Flow Analysis', 'Volume Spike', 'Volume Breakout'] },
    { id: 'trending_markets', name: 'Trending Markets', icon: '📈', botFilter: ['Momentum Trader', 'Trend Following', 'EMA Golden Cross', 'ADX Trend Strength'] },
    { id: 'futures_signals', name: 'Futures & Options', icon: '📊', botFilter: ['Funding Rate Arbitrage', 'Open Interest Momentum', 'Options Flow Detector'] },
    { id: 'breakout_hunter', name: 'Breakout Opportunities', icon: '🚀', botFilter: ['Breakout Hunter', 'Bollinger Breakout', 'Volume Breakout', 'Chart Patterns'] },
    { id: 'reversal_opportunities', name: 'Reversal Setups', icon: '🔄', botFilter: ['Mean Reversion', 'RSI Oversold/Overbought', 'RSI Divergence', 'Stochastic Oscillator'] },
    { id: 'volatile_markets', name: 'Volatile Markets', icon: '🌊', botFilter: ['ATR Volatility', 'Bollinger Squeeze', 'Volatility Breakout'] },
    { id: 'elliott_wave', name: 'Elliott Wave', icon: '〰️', botFilter: ['Elliott Wave Pattern', 'Fibonacci Retracement', 'Harmonic Patterns'] }
  ]

  useEffect(() => {
    fetchInsights()
  }, [selectedCoin, timeRange])

  const fetchInsights = async () => {
    setLoading(true)
    try {
      const { data: latestScan } = await supabase
        .from('scan_runs')
        .select('id')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single()

      if (latestScan) {
        const { data: recommendations } = await supabase
          .from('recommendations')
          .select('*')
          .eq('run_id', latestScan.id)
          .eq('ticker', selectedCoin)
          .maybeSingle()

        const { data: botPredictions } = await supabase
          .from('bot_predictions')
          .select('*')
          .eq('run_id', latestScan.id)
          .eq('coin_symbol', selectedCoin)

        setInsights({
          coin: selectedCoin,
          recommendation: recommendations,
          botPredictions: botPredictions || [],
          onChain: generateMockOnChainData(selectedCoin),
          sentiment: generateMockSentimentData(selectedCoin),
          options: ['BTC', 'ETH', 'SOL'].includes(selectedCoin) ? generateMockOptionsData(selectedCoin) : null
        })
      }
    } catch (err) {
      console.error('Error fetching insights:', err)
    } finally {
      setLoading(false)
    }
  }

  const generateMockOnChainData = (coin) => {
    const isWhaleActive = Math.random() > 0.5
    const netFlow = (Math.random() - 0.5) * 1000

    return {
      whaleActivity: {
        largeTransactions: Math.floor(Math.random() * 50) + 10,
        totalVolume: Math.floor(Math.random() * 10000000) + 1000000,
        signal: isWhaleActive ? (netFlow > 0 ? 'BULLISH' : 'BEARISH') : 'NEUTRAL',
        accumulationPattern: netFlow < -200
      },
      exchangeFlows: {
        inflows: Math.floor(Math.random() * 5000000),
        outflows: Math.floor(Math.random() * 5000000),
        netFlow: netFlow,
        signal: netFlow < -100 ? 'BULLISH' : (netFlow > 100 ? 'BEARISH' : 'NEUTRAL')
      },
      networkActivity: {
        activeAddresses: Math.floor(Math.random() * 1000000) + 500000,
        transactionCount: Math.floor(Math.random() * 300000) + 100000,
        trend: Math.random() > 0.5 ? 'INCREASING' : 'DECREASING'
      },
      overallSignal: ['BULLISH', 'BEARISH', 'NEUTRAL'][Math.floor(Math.random() * 3)],
      confidence: Math.random() * 0.4 + 0.5
    }
  }

  const generateMockSentimentData = (coin) => {
    const baseScore = Math.random() * 2 - 1

    return {
      sources: {
        reddit: {
          score: baseScore + (Math.random() * 0.4 - 0.2),
          volume: Math.floor(Math.random() * 1000) + 500,
          summary: 'Community sentiment detected from r/cryptocurrency and coin-specific subreddits',
          upvoteRatio: Math.random() * 0.3 + 0.6
        },
        cryptopanic: {
          score: baseScore + (Math.random() * 0.4 - 0.2),
          volume: Math.floor(Math.random() * 200) + 50,
          summary: 'News aggregation from crypto-focused sources'
        },
        news: {
          score: baseScore + (Math.random() * 0.4 - 0.2),
          volume: Math.floor(Math.random() * 100) + 20,
          summary: 'Mainstream media coverage analysis'
        }
      },
      aggregatedScore: baseScore,
      sentiment: baseScore > 0.5 ? 'VERY_BULLISH' : baseScore > 0.2 ? 'BULLISH' : baseScore > -0.2 ? 'NEUTRAL' : baseScore > -0.5 ? 'BEARISH' : 'VERY_BEARISH',
      confidence: Math.random() * 0.3 + 0.6,
      trendingTopics: ['ETF', 'regulation', 'adoption', 'whale activity'].slice(0, Math.floor(Math.random() * 3) + 1),
      breakingNews: Math.random() > 0.8
    }
  }

  const generateMockOptionsData = (coin) => {
    const putCallRatio = Math.random() * 1.5 + 0.3

    return {
      supported: true,
      putCallRatio: {
        volume: putCallRatio,
        openInterest: putCallRatio + (Math.random() * 0.2 - 0.1),
        signal: putCallRatio < 0.7 ? 'BULLISH' : putCallRatio > 1.3 ? 'BEARISH' : 'NEUTRAL'
      },
      impliedVolatility: {
        current: Math.random() * 100 + 50,
        percentile: Math.random() * 100,
        trend: ['RISING', 'FALLING', 'STABLE'][Math.floor(Math.random() * 3)]
      },
      unusualActivity: {
        detected: Math.random() > 0.7,
        largeTradeCount: Math.floor(Math.random() * 20),
        totalVolume: Math.floor(Math.random() * 1000000) + 100000,
        direction: ['CALLS', 'PUTS', 'MIXED'][Math.floor(Math.random() * 3)]
      },
      optionsFlow: {
        callVolume: Math.floor(Math.random() * 500000) + 100000,
        putVolume: Math.floor(Math.random() * 500000) + 100000,
        totalVolume: Math.floor(Math.random() * 1000000) + 200000,
        institutionalDirection: ['BULLISH', 'BEARISH', 'NEUTRAL'][Math.floor(Math.random() * 3)]
      },
      maxPain: {
        price: Math.floor(Math.random() * 10000) + 40000,
        confidence: Math.random() * 0.4 + 0.5
      },
      overallSignal: ['BULLISH', 'BEARISH', 'NEUTRAL'][Math.floor(Math.random() * 3)]
    }
  }

  if (loading) {
    return (
      <div className="insights-loading">
        <Activity className="spinner" size={48} />
        <p>Loading market insights...</p>
      </div>
    )
  }

  if (!insights) {
    return (
      <div className="insights-empty">
        <AlertTriangle size={48} />
        <p>No insights data available</p>
        <p className="hint">Run a scan to generate market insights</p>
      </div>
    )
  }

  const { onChain, sentiment, options } = insights

  const currentViewMode = VIEW_MODES.find(m => m.id === viewMode)
  const filteredBotPredictions = currentViewMode?.botFilter
    ? insights.botPredictions.filter(pred => currentViewMode.botFilter.includes(pred.bot_name))
    : insights.botPredictions

  return (
    <div className="insights-page">
      <RealtimeUpdates type="insights" />
      <div className="insights-header">
        <div>
          <h1>Market Insights</h1>
          <p>On-chain data, sentiment analysis, and options flow for informed trading decisions</p>
        </div>
        <div className="insights-controls">
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            className="view-mode-selector"
          >
            {VIEW_MODES.map(mode => (
              <option key={mode.id} value={mode.id}>
                {mode.icon} {mode.name}
              </option>
            ))}
          </select>
          <select value={selectedCoin} onChange={(e) => setSelectedCoin(e.target.value)}>
            {availableCoins.map(coin => (
              <option key={coin} value={coin}>{coin}</option>
            ))}
          </select>
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      {viewMode !== 'all' && (
        <div className="view-mode-banner">
          <div className="banner-icon">{VIEW_MODES.find(m => m.id === viewMode)?.icon}</div>
          <div className="banner-content">
            <h3>Viewing: {VIEW_MODES.find(m => m.id === viewMode)?.name}</h3>
            <p>
              Showing signals from specialized bots focused on{' '}
              {viewMode === 'whale_activity' && 'large volume movements and institutional activity'}
              {viewMode === 'trending_markets' && 'strong momentum and trending market conditions'}
              {viewMode === 'futures_signals' && 'derivatives market data and funding rates'}
              {viewMode === 'breakout_hunter' && 'breakout patterns with volume confirmation'}
              {viewMode === 'reversal_opportunities' && 'oversold/overbought reversals and mean reversion'}
              {viewMode === 'volatile_markets' && 'high volatility opportunities for experienced traders'}
              {viewMode === 'elliott_wave' && 'Elliott Wave theory and Fibonacci analysis'}
              . All 83 bots still run on every scan.
            </p>
          </div>
        </div>
      )}

      <div className="insights-summary">
        <SummaryCard
          icon={Activity}
          title="On-Chain Signal"
          value={onChain.overallSignal}
          confidence={onChain.confidence}
          color={onChain.overallSignal === 'BULLISH' ? 'green' : onChain.overallSignal === 'BEARISH' ? 'red' : 'gray'}
        />
        <SummaryCard
          icon={MessageCircle}
          title="Sentiment"
          value={sentiment.sentiment.replace('_', ' ')}
          confidence={sentiment.confidence}
          color={sentiment.aggregatedScore > 0 ? 'green' : sentiment.aggregatedScore < 0 ? 'red' : 'gray'}
        />
        {options && (
          <SummaryCard
            icon={Target}
            title="Options Flow"
            value={options.overallSignal}
            confidence={0.75}
            color={options.overallSignal === 'BULLISH' ? 'green' : options.overallSignal === 'BEARISH' ? 'red' : 'gray'}
          />
        )}
        <SummaryCard
          icon={Users}
          title="Bot Consensus"
          value={`${filteredBotPredictions.length} Bots`}
          confidence={insights.recommendation?.avg_confidence || 0.5}
          color="blue"
        />
      </div>

      <div className="insights-grid">
        <OnChainSection data={onChain} coin={selectedCoin} />
        <SentimentSection data={sentiment} coin={selectedCoin} />
        {options && <OptionsSection data={options} coin={selectedCoin} />}
        <BotInsightsSection predictions={filteredBotPredictions} coin={selectedCoin} viewMode={viewMode} />
      </div>

      <NewsSection coinSymbol={selectedCoin} />

      <MarketCorrelation />
      <MarketRegimeTimeline coin={selectedCoin} />
    </div>
  )
}

function SummaryCard({ icon: Icon, title, value, confidence, color }) {
  return (
    <div className={`summary-card ${color}`}>
      <div className="card-icon">
        <Icon size={24} />
      </div>
      <div className="card-content">
        <span className="card-title">{title}</span>
        <span className="card-value">{value}</span>
        <div className="card-confidence">
          <span>Confidence: {(confidence * 100).toFixed(0)}%</span>
          <div className="confidence-bar">
            <div className="confidence-fill" style={{ width: `${confidence * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function OnChainSection({ data, coin }) {
  const netFlowDirection = data.exchangeFlows.netFlow < 0 ? 'Outflow' : 'Inflow'
  const netFlowColor = data.exchangeFlows.netFlow < 0 ? 'green' : 'red'

  return (
    <div className="insight-section onchain-section">
      <div className="section-header">
        <Activity size={20} />
        <h2>On-Chain Analysis</h2>
        <span className={`signal-badge ${data.overallSignal.toLowerCase()}`}>{data.overallSignal}</span>
      </div>

      <div className="section-content">
        <div className="insight-card">
          <h3><Zap size={16} /> Whale Activity</h3>
          <div className="metrics">
            <div className="metric">
              <span className="label">Large Transactions (24h)</span>
              <span className="value">{data.whaleActivity.largeTransactions}</span>
            </div>
            <div className="metric">
              <span className="label">Total Volume</span>
              <span className="value">${(data.whaleActivity.totalVolume / 1000000).toFixed(2)}M</span>
            </div>
            <div className="metric">
              <span className="label">Pattern</span>
              <span className={`value ${data.whaleActivity.accumulationPattern ? 'green' : ''}`}>
                {data.whaleActivity.accumulationPattern ? 'Accumulation' : 'Distribution'}
              </span>
            </div>
          </div>
          <div className={`signal-indicator ${data.whaleActivity.signal.toLowerCase()}`}>
            {data.whaleActivity.signal === 'BULLISH' ? <TrendingUp size={16} /> : data.whaleActivity.signal === 'BEARISH' ? <TrendingDown size={16} /> : <Activity size={16} />}
            {data.whaleActivity.signal} Signal
          </div>
        </div>

        <div className="insight-card">
          <h3><DollarSign size={16} /> Exchange Flows</h3>
          <div className="metrics">
            <div className="metric">
              <span className="label">Inflows</span>
              <span className="value">${(data.exchangeFlows.inflows / 1000000).toFixed(2)}M</span>
            </div>
            <div className="metric">
              <span className="label">Outflows</span>
              <span className="value">${(data.exchangeFlows.outflows / 1000000).toFixed(2)}M</span>
            </div>
            <div className="metric">
              <span className="label">Net Flow</span>
              <span className={`value ${netFlowColor}`}>
                {data.exchangeFlows.netFlow < 0 ? '' : '+'}{(data.exchangeFlows.netFlow / 1000000).toFixed(2)}M ({netFlowDirection})
              </span>
            </div>
          </div>
          <div className="info-box">
            <ShieldAlert size={14} />
            <span>Negative net flow (outflow) is typically bullish - coins leaving exchanges</span>
          </div>
        </div>

        <div className="insight-card">
          <h3><Users size={16} /> Network Activity</h3>
          <div className="metrics">
            <div className="metric">
              <span className="label">Active Addresses</span>
              <span className="value">{(data.networkActivity.activeAddresses / 1000).toFixed(0)}K</span>
            </div>
            <div className="metric">
              <span className="label">Transactions (24h)</span>
              <span className="value">{(data.networkActivity.transactionCount / 1000).toFixed(0)}K</span>
            </div>
            <div className="metric">
              <span className="label">Trend</span>
              <span className={`value ${data.networkActivity.trend === 'INCREASING' ? 'green' : 'red'}`}>
                {data.networkActivity.trend}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SentimentSection({ data, coin }) {
  const sentimentColor = data.aggregatedScore > 0 ? 'green' : data.aggregatedScore < 0 ? 'red' : 'gray'

  return (
    <div className="insight-section sentiment-section">
      <div className="section-header">
        <MessageCircle size={20} />
        <h2>Social Sentiment</h2>
        <span className={`signal-badge ${sentimentColor}`}>{data.sentiment.replace('_', ' ')}</span>
      </div>

      <div className="section-content">
        <div className="sentiment-gauge">
          <div className="gauge-container">
            <div className="gauge-bar">
              <div
                className="gauge-indicator"
                style={{ left: `${((data.aggregatedScore + 1) / 2) * 100}%` }}
              />
            </div>
            <div className="gauge-labels">
              <span>Very Bearish</span>
              <span>Neutral</span>
              <span>Very Bullish</span>
            </div>
          </div>
          <div className="sentiment-score">
            Score: {data.aggregatedScore.toFixed(2)} / 1.00
          </div>
        </div>

        {data.breakingNews && (
          <div className="breaking-news">
            <Newspaper size={16} />
            <span>Breaking news detected - increased market attention</span>
          </div>
        )}

        {data.trendingTopics && data.trendingTopics.length > 0 && (
          <div className="trending-topics">
            <h4>Trending Topics</h4>
            <div className="topics-list">
              {data.trendingTopics.map((topic, idx) => (
                <span key={idx} className="topic-tag">{topic}</span>
              ))}
            </div>
          </div>
        )}

        <div className="sentiment-sources">
          {Object.entries(data.sources).map(([source, sourceData]) => (
            <div key={source} className="source-card">
              <h4>{source.charAt(0).toUpperCase() + source.slice(1)}</h4>
              <div className="source-metrics">
                <div className="metric">
                  <span className="label">Sentiment Score</span>
                  <span className={`value ${sourceData.score > 0 ? 'green' : sourceData.score < 0 ? 'red' : ''}`}>
                    {sourceData.score.toFixed(2)}
                  </span>
                </div>
                <div className="metric">
                  <span className="label">Volume</span>
                  <span className="value">{sourceData.volume} posts</span>
                </div>
                {sourceData.upvoteRatio && (
                  <div className="metric">
                    <span className="label">Upvote Ratio</span>
                    <span className="value">{(sourceData.upvoteRatio * 100).toFixed(0)}%</span>
                  </div>
                )}
              </div>
              <p className="source-summary">{sourceData.summary}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function OptionsSection({ data, coin }) {
  return (
    <div className="insight-section options-section">
      <div className="section-header">
        <Target size={20} />
        <h2>Options Flow Analysis</h2>
        <span className={`signal-badge ${data.overallSignal.toLowerCase()}`}>{data.overallSignal}</span>
      </div>

      <div className="section-content">
        <div className="insight-card">
          <h3><BarChart3 size={16} /> Put/Call Ratio</h3>
          <div className="metrics">
            <div className="metric">
              <span className="label">Volume Ratio</span>
              <span className="value">{data.putCallRatio.volume.toFixed(2)}</span>
            </div>
            <div className="metric">
              <span className="label">OI Ratio</span>
              <span className="value">{data.putCallRatio.openInterest.toFixed(2)}</span>
            </div>
            <div className="metric">
              <span className="label">Signal</span>
              <span className={`value ${data.putCallRatio.signal.toLowerCase() === 'bullish' ? 'green' : data.putCallRatio.signal.toLowerCase() === 'bearish' ? 'red' : ''}`}>
                {data.putCallRatio.signal}
              </span>
            </div>
          </div>
          <div className="info-box">
            <ShieldAlert size={14} />
            <span>P/C ratio &lt; 0.7 is bullish, &gt; 1.3 is bearish</span>
          </div>
        </div>

        <div className="insight-card">
          <h3><Activity size={16} /> Implied Volatility</h3>
          <div className="metrics">
            <div className="metric">
              <span className="label">Current IV</span>
              <span className="value">{data.impliedVolatility.current.toFixed(1)}%</span>
            </div>
            <div className="metric">
              <span className="label">IV Percentile</span>
              <span className="value">{data.impliedVolatility.percentile.toFixed(0)}th</span>
            </div>
            <div className="metric">
              <span className="label">Trend</span>
              <span className={`value ${data.impliedVolatility.trend === 'RISING' ? 'red' : data.impliedVolatility.trend === 'FALLING' ? 'green' : ''}`}>
                {data.impliedVolatility.trend}
              </span>
            </div>
          </div>
        </div>

        {data.unusualActivity.detected && (
          <div className="insight-card unusual-activity">
            <h3><Zap size={16} /> Unusual Activity Detected</h3>
            <div className="metrics">
              <div className="metric">
                <span className="label">Large Trades</span>
                <span className="value">{data.unusualActivity.largeTradeCount}</span>
              </div>
              <div className="metric">
                <span className="label">Direction</span>
                <span className="value">{data.unusualActivity.direction}</span>
              </div>
              <div className="metric">
                <span className="label">Volume</span>
                <span className="value">${(data.unusualActivity.totalVolume / 1000000).toFixed(2)}M</span>
              </div>
            </div>
          </div>
        )}

        <div className="insight-card">
          <h3><Target size={16} /> Options Flow</h3>
          <div className="metrics">
            <div className="metric">
              <span className="label">Call Volume</span>
              <span className="value">${(data.optionsFlow.callVolume / 1000000).toFixed(2)}M</span>
            </div>
            <div className="metric">
              <span className="label">Put Volume</span>
              <span className="value">${(data.optionsFlow.putVolume / 1000000).toFixed(2)}M</span>
            </div>
            <div className="metric">
              <span className="label">Institutional Direction</span>
              <span className={`value ${data.optionsFlow.institutionalDirection.toLowerCase() === 'bullish' ? 'green' : data.optionsFlow.institutionalDirection.toLowerCase() === 'bearish' ? 'red' : ''}`}>
                {data.optionsFlow.institutionalDirection}
              </span>
            </div>
          </div>
        </div>

        <div className="insight-card">
          <h3><DollarSign size={16} /> Max Pain</h3>
          <div className="metrics">
            <div className="metric">
              <span className="label">Max Pain Price</span>
              <span className="value">${data.maxPain.price.toLocaleString()}</span>
            </div>
            <div className="metric">
              <span className="label">Confidence</span>
              <span className="value">{(data.maxPain.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div className="info-box">
            <ShieldAlert size={14} />
            <span>Price level where most options expire worthless</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function BotInsightsSection({ predictions, coin, viewMode }) {
  const longCount = predictions.filter(p => p.position_direction === 'LONG').length
  const shortCount = predictions.filter(p => p.position_direction === 'SHORT').length
  const avgConfidence = predictions.length > 0
    ? predictions.reduce((sum, p) => sum + p.confidence_score, 0) / predictions.length
    : 0

  const consensusDirection = longCount > shortCount ? 'LONG' : 'SHORT'
  const consensusPercent = predictions.length > 0
    ? (Math.max(longCount, shortCount) / predictions.length) * 100
    : 0

  const topBots = [...predictions]
    .sort((a, b) => b.confidence_score - a.confidence_score)
    .slice(0, 10)

  if (predictions.length === 0) {
    return (
      <div className="insight-section bots-section">
        <div className="section-header">
          <Users size={20} />
          <h2>Bot Insights for {coin}</h2>
          <span className="signal-badge blue">0 Bots</span>
        </div>
        <div className="section-content">
          <div className="empty-state" style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
            <Users size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>No bot predictions found for this filter.</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Try selecting a different view mode or run a new scan.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="insight-section bots-section">
      <div className="section-header">
        <Users size={20} />
        <h2>Bot Insights for {coin}</h2>
        <span className="signal-badge blue">{predictions.length} Bots Active</span>
      </div>

      <div className="section-content">
        <div className="bot-consensus">
          <h3>Bot Consensus</h3>
          <div className="consensus-chart">
            <div className="consensus-bar">
              <div className="long-bar" style={{ width: `${(longCount / predictions.length) * 100}%` }}>
                {longCount} LONG
              </div>
              <div className="short-bar" style={{ width: `${(shortCount / predictions.length) * 100}%` }}>
                {shortCount} SHORT
              </div>
            </div>
          </div>
          <div className="consensus-summary">
            <div className="metric">
              <span className="label">Consensus Direction</span>
              <span className={`value ${consensusDirection === 'LONG' ? 'green' : 'red'}`}>
                {consensusDirection} ({consensusPercent.toFixed(1)}%)
              </span>
            </div>
            <div className="metric">
              <span className="label">Avg Confidence</span>
              <span className="value">{(avgConfidence * 10).toFixed(1)}/10</span>
            </div>
          </div>
        </div>

        <div className="top-bots">
          <h3>Top {Math.min(topBots.length, 10)} Confident Bots</h3>
          {topBots.map((bot, idx) => (
            <div key={bot.id} className="bot-item">
              <div className="bot-rank">#{idx + 1}</div>
              <div className="bot-info">
                <span className="bot-name">{bot.bot_name}</span>
                <span className={`bot-direction ${bot.position_direction.toLowerCase()}`}>
                  {bot.position_direction}
                </span>
              </div>
              <div className="bot-confidence">
                <span>{(bot.confidence_score * 10).toFixed(1)}/10</span>
                <div className="mini-confidence-bar">
                  <div
                    className="mini-confidence-fill"
                    style={{ width: `${bot.confidence_score * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Insights
