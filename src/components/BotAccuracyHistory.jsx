import React, { useState, useEffect } from 'react'
import { supabase } from '../config/api'
import { BarChart3, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import './BotAccuracyHistory.css'

export default function BotAccuracyHistory({ botName }) {
  const [historyData, setHistoryData] = useState([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('30d')

  useEffect(() => {
    if (botName) {
      fetchAccuracyHistory()
    }
  }, [botName, timeRange])

  const fetchAccuracyHistory = async () => {
    setLoading(true)
    try {
      const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
      const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)

      const { data, error } = await supabase
        .from('bot_performance_history')
        .select('*')
        .eq('bot_name', botName)
        .gte('recorded_at', startDate.toISOString())
        .order('recorded_at', { ascending: true })

      if (error) throw error

      setHistoryData(data || [])
    } catch (error) {
      console.error('Failed to fetch accuracy history:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="accuracy-history-loading">
        <Activity className="spin" size={24} />
        <span>Loading historical data...</span>
      </div>
    )
  }

  if (!historyData || historyData.length === 0) {
    return (
      <div className="accuracy-history-empty">
        <BarChart3 size={48} />
        <p>No historical data available yet</p>
        <p className="hint">Performance history is tracked automatically</p>
      </div>
    )
  }

  const maxAccuracy = Math.max(...historyData.map(d => d.accuracy_rate))
  const minAccuracy = Math.min(...historyData.map(d => d.accuracy_rate))
  const avgAccuracy = historyData.reduce((sum, d) => sum + d.accuracy_rate, 0) / historyData.length
  const trend = historyData.length >= 2
    ? historyData[historyData.length - 1].accuracy_rate - historyData[0].accuracy_rate
    : 0

  const chartHeight = 200
  const chartWidth = 100
  const maxValue = Math.max(...historyData.map(d => d.accuracy_rate), 100)
  const minValue = Math.min(...historyData.map(d => d.accuracy_rate), 0)
  const range = maxValue - minValue || 1

  const points = historyData.map((d, i) => {
    const x = (i / (historyData.length - 1 || 1)) * chartWidth
    const y = chartHeight - ((d.accuracy_rate - minValue) / range) * chartHeight
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="bot-accuracy-history">
      <div className="history-header">
        <h3>
          <BarChart3 size={20} />
          Accuracy History
        </h3>
        <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
        </select>
      </div>

      <div className="accuracy-stats">
        <div className="stat-box">
          <span className="stat-label">Current</span>
          <span className="stat-value">{historyData[historyData.length - 1].accuracy_rate.toFixed(1)}%</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Average</span>
          <span className="stat-value">{avgAccuracy.toFixed(1)}%</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Best</span>
          <span className="stat-value success">{maxAccuracy.toFixed(1)}%</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Worst</span>
          <span className="stat-value danger">{minAccuracy.toFixed(1)}%</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Trend</span>
          <span className={`stat-value ${trend >= 0 ? 'success' : 'danger'}`}>
            {trend >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="accuracy-chart">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id={`gradient-${botName}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(59, 130, 246, 0.5)" />
              <stop offset="100%" stopColor="rgba(59, 130, 246, 0.1)" />
            </linearGradient>
          </defs>

          <polyline
            points={`0,${chartHeight} ${points} ${chartWidth},${chartHeight}`}
            fill={`url(#gradient-${botName})`}
            stroke="none"
          />

          <polyline
            points={points}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {historyData.map((d, i) => {
            const x = (i / (historyData.length - 1 || 1)) * chartWidth
            const y = chartHeight - ((d.accuracy_rate - minValue) / range) * chartHeight
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="0.8"
                fill="#3b82f6"
                className="data-point"
              >
                <title>{`${new Date(d.recorded_at).toLocaleDateString()}: ${d.accuracy_rate.toFixed(1)}%`}</title>
              </circle>
            )
          })}
        </svg>
        <div className="chart-axes">
          <span className="y-axis-label">{maxValue.toFixed(0)}%</span>
          <span className="y-axis-label bottom">{minValue.toFixed(0)}%</span>
        </div>
      </div>

      <div className="history-timeline">
        <span className="timeline-start">
          {new Date(historyData[0].recorded_at).toLocaleDateString()}
        </span>
        <span className="timeline-end">
          {new Date(historyData[historyData.length - 1].recorded_at).toLocaleDateString()}
        </span>
      </div>

      <div className="performance-breakdown">
        <h4>Performance Breakdown</h4>
        <div className="breakdown-grid">
          <div className="breakdown-item">
            <span className="label">Total Predictions</span>
            <span className="value">{historyData[historyData.length - 1].total_predictions || 0}</span>
          </div>
          <div className="breakdown-item">
            <span className="label">Correct</span>
            <span className="value success">{historyData[historyData.length - 1].correct_predictions || 0}</span>
          </div>
          <div className="breakdown-item">
            <span className="label">Incorrect</span>
            <span className="value danger">
              {(historyData[historyData.length - 1].total_predictions || 0) - (historyData[historyData.length - 1].correct_predictions || 0)}
            </span>
          </div>
          <div className="breakdown-item">
            <span className="label">Avg Confidence</span>
            <span className="value">{(historyData[historyData.length - 1].avg_confidence * 100 || 0).toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
