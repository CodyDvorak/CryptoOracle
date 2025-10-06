import React, { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Target, Clock, DollarSign } from 'lucide-react'
import { supabase } from '../config/api'
import './SignalPerformanceCharts.css'

export default function SignalPerformanceCharts() {
  const [signals, setSignals] = useState([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('7d')
  const [selectedCoin, setSelectedCoin] = useState('all')

  useEffect(() => {
    fetchSignalHistory()
  }, [timeRange, selectedCoin])

  const fetchSignalHistory = async () => {
    setLoading(true)
    try {
      const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
      const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)

      let query = supabase
        .from('bot_predictions')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: false })
        .limit(100)

      if (selectedCoin !== 'all') {
        query = query.eq('coin_symbol', selectedCoin)
      }

      const { data, error } = await query

      if (error) throw error
      setSignals(data || [])
    } catch (error) {
      console.error('Failed to fetch signal history:', error)
    } finally {
      setLoading(false)
    }
  }

  const evaluatedSignals = signals.filter(s => s.outcome_status !== null)

  const successfulSignals = evaluatedSignals.filter(s =>
    s.outcome_status === 'success'
  )

  const failedSignals = evaluatedSignals.filter(s =>
    s.outcome_status === 'failed'
  )

  const accuracy = evaluatedSignals.length > 0
    ? (successfulSignals.length / evaluatedSignals.length) * 100
    : 0

  const avgTimeToTarget = evaluatedSignals
    .filter(s => s.outcome_checked_at && s.timestamp)
    .reduce((sum, s) => {
      const hours = (new Date(s.outcome_checked_at) - new Date(s.timestamp)) / (1000 * 60 * 60)
      return sum + hours
    }, 0) / evaluatedSignals.length || 0

  const avgPriceChange = evaluatedSignals
    .filter(s => s.profit_loss_percent !== null)
    .reduce((sum, s) => sum + Math.abs(s.profit_loss_percent), 0) / evaluatedSignals.length || 0

  const stopLossHitRate = evaluatedSignals
    .filter(s => s.outcome_status === 'failed')
    .length / evaluatedSignals.length * 100 || 0

  const takeProfitHitRate = evaluatedSignals
    .filter(s => s.outcome_status === 'success')
    .length / evaluatedSignals.length * 100 || 0

  const coins = [...new Set(signals.map(s => s.coin_symbol))].sort()

  if (loading) {
    return <div className="signal-charts-loading">Loading signal history...</div>
  }

  return (
    <div className="signal-performance-charts">
      <div className="charts-header">
        <h2>Signal Performance Tracking</h2>
        <div className="charts-controls">
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <select value={selectedCoin} onChange={(e) => setSelectedCoin(e.target.value)}>
            <option value="all">All Coins</option>
            {coins.map(coin => (
              <option key={coin} value={coin}>{coin}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="performance-metrics">
        <div className="metric-card">
          <div className="metric-icon success">
            <Target size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Overall Accuracy</div>
            <div className="metric-value">{accuracy.toFixed(1)}%</div>
            <div className="metric-detail">{evaluatedSignals.length} signals evaluated</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <Clock size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Avg Time to Target</div>
            <div className="metric-value">{avgTimeToTarget.toFixed(1)}h</div>
            <div className="metric-detail">Based on successful signals</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <DollarSign size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Avg Price Change</div>
            <div className="metric-value">{avgPriceChange.toFixed(2)}%</div>
            <div className="metric-detail">Absolute movement</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon warning">
            <TrendingDown size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Stop Loss Hit Rate</div>
            <div className="metric-value">{stopLossHitRate.toFixed(1)}%</div>
            <div className="metric-detail">Risk management</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon success">
            <TrendingUp size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Take Profit Hit Rate</div>
            <div className="metric-value">{takeProfitHitRate.toFixed(1)}%</div>
            <div className="metric-detail">Target achievement</div>
          </div>
        </div>
      </div>

      <div className="signal-comparison-chart">
        <h3>Signal vs Actual Price Performance</h3>
        <div className="chart-container">
          <div className="bar-chart">
            <div className="chart-bars">
              <div className="bar-group">
                <div className="bar-label">LONG Signals</div>
                <div className="bars">
                  <div
                    className="bar success"
                    style={{ width: `${(successfulSignals.filter(s => s.position_direction === 'LONG').length / evaluatedSignals.length) * 100}%` }}
                  >
                    {successfulSignals.filter(s => s.position_direction === 'LONG').length}
                  </div>
                  <div
                    className="bar failure"
                    style={{ width: `${(failedSignals.filter(s => s.position_direction === 'LONG').length / evaluatedSignals.length) * 100}%` }}
                  >
                    {failedSignals.filter(s => s.position_direction === 'LONG').length}
                  </div>
                </div>
              </div>
              <div className="bar-group">
                <div className="bar-label">SHORT Signals</div>
                <div className="bars">
                  <div
                    className="bar success"
                    style={{ width: `${(successfulSignals.filter(s => s.position_direction === 'SHORT').length / evaluatedSignals.length) * 100}%` }}
                  >
                    {successfulSignals.filter(s => s.position_direction === 'SHORT').length}
                  </div>
                  <div
                    className="bar failure"
                    style={{ width: `${(failedSignals.filter(s => s.position_direction === 'SHORT').length / evaluatedSignals.length) * 100}%` }}
                  >
                    {failedSignals.filter(s => s.position_direction === 'SHORT').length}
                  </div>
                </div>
              </div>
            </div>
            <div className="chart-legend">
              <div className="legend-item">
                <span className="legend-color success"></span>
                <span>Successful</span>
              </div>
              <div className="legend-item">
                <span className="legend-color failure"></span>
                <span>Failed</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="signal-history-table">
        <h3>Recent Signal Outcomes</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Coin</th>
                <th>Bot</th>
                <th>Direction</th>
                <th>Entry Price</th>
                <th>Target Price</th>
                <th>Actual Change</th>
                <th>Time to Outcome</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {evaluatedSignals.slice(0, 20).map((signal, idx) => {
                const hoursToOutcome = signal.outcome_checked_at && signal.timestamp
                  ? (new Date(signal.outcome_checked_at) - new Date(signal.timestamp)) / (1000 * 60 * 60)
                  : 0
                return (
                  <tr key={idx} className={signal.outcome_status === 'success' ? 'success-row' : 'failure-row'}>
                    <td>{new Date(signal.timestamp).toLocaleDateString()}</td>
                    <td className="coin-cell">{signal.coin_symbol}</td>
                    <td className="bot-cell">{signal.bot_name}</td>
                    <td>
                      <span className={`direction-badge ${signal.position_direction.toLowerCase()}`}>
                        {signal.position_direction}
                      </span>
                    </td>
                    <td>${signal.entry_price?.toFixed(4)}</td>
                    <td>${signal.target_price?.toFixed(4)}</td>
                    <td className={signal.profit_loss_percent > 0 ? 'positive' : 'negative'}>
                      {signal.profit_loss_percent?.toFixed(2)}%
                    </td>
                    <td>{hoursToOutcome.toFixed(1)}h</td>
                    <td>
                      <span className={`result-badge ${signal.outcome_status === 'success' ? 'success' : 'failure'}`}>
                        {signal.outcome_status === 'success' ? '✓ Success' : '✗ Failed'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="time-to-target-analysis">
        <h3>Time to Target Distribution</h3>
        <div className="distribution-chart">
          {(() => {
            const buckets = { '0-6h': 0, '6-12h': 0, '12-24h': 0, '24-48h': 0, '48h+': 0 }
            evaluatedSignals.forEach(s => {
              const hours = s.outcome_checked_at && s.timestamp
                ? (new Date(s.outcome_checked_at) - new Date(s.timestamp)) / (1000 * 60 * 60)
                : 0
              if (hours <= 6) buckets['0-6h']++
              else if (hours <= 12) buckets['6-12h']++
              else if (hours <= 24) buckets['12-24h']++
              else if (hours <= 48) buckets['24-48h']++
              else buckets['48h+']++
            })

            const maxCount = Math.max(...Object.values(buckets))

            return Object.entries(buckets).map(([label, count]) => (
              <div key={label} className="distribution-bar">
                <div className="distribution-label">{label}</div>
                <div className="distribution-bar-container">
                  <div
                    className="distribution-bar-fill"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  >
                    {count}
                  </div>
                </div>
              </div>
            ))
          })()}
        </div>
      </div>
    </div>
  )
}
