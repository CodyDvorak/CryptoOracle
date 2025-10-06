import React, { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, TrendingDown, Activity, Calendar, Download, Filter } from 'lucide-react'
import { supabase } from '../config/api'
import './Analytics.css'

function Analytics() {
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('30d')
  const [error, setError] = useState(null)
  const [analytics, setAnalytics] = useState({
    timeSeriesData: [],
    botCorrelations: [],
    performanceAttribution: [],
    comparativeAnalysis: []
  })

  useEffect(() => {
    fetchAnalytics().catch(err => {
      console.error('Analytics fetch error:', err)
      setError(err.message)
      setLoading(false)
    })
  }, [timeRange])

  const fetchAnalytics = async () => {
    setLoading(true)
    setError(null)
    try {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90

      // Get time series data
      const { data: predictions } = await supabase
        .from('bot_predictions')
        .select('*')
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true })

      // Get bot performance
      const { data: botPerf } = await supabase
        .from('bot_performance')
        .select('*')
        .order('accuracy_rate', { ascending: false })

      // Get scan runs
      const { data: scans } = await supabase
        .from('scan_runs')
        .select('*')
        .eq('status', 'completed')
        .gte('completed_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('completed_at', { ascending: true })

      setAnalytics({
        timeSeriesData: processTimeSeriesData(predictions || []),
        botCorrelations: calculateBotCorrelations(predictions || []),
        performanceAttribution: attributePerformance(botPerf || []),
        comparativeAnalysis: comparePerformance(scans || [], predictions || [])
      })
    } catch (err) {
      console.error('Error fetching analytics:', err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const processTimeSeriesData = (predictions) => {
    const dailyData = {}

    predictions.forEach(pred => {
      const date = pred.created_at.split('T')[0]
      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          total: 0,
          successful: 0,
          failed: 0,
          pending: 0,
          avgConfidence: 0,
          confidenceSum: 0
        }
      }

      dailyData[date].total++
      if (pred.outcome_status === 'success') dailyData[date].successful++
      else if (pred.outcome_status === 'failed') dailyData[date].failed++
      else dailyData[date].pending++

      dailyData[date].confidenceSum += pred.confidence_score || 0
    })

    return Object.values(dailyData).map(day => ({
      ...day,
      avgConfidence: day.total > 0 ? day.confidenceSum / day.total : 0,
      accuracy: day.successful + day.failed > 0 ? day.successful / (day.successful + day.failed) : 0
    }))
  }

  const calculateBotCorrelations = (predictions) => {
    const botPairs = new Map()
    const botPredsByDate = {}

    predictions.forEach(pred => {
      const key = `${pred.coin_symbol}_${pred.created_at.split('T')[0]}`
      if (!botPredsByDate[key]) botPredsByDate[key] = []
      botPredsByDate[key].push(pred)
    })

    Object.values(botPredsByDate).forEach(preds => {
      for (let i = 0; i < preds.length; i++) {
        for (let j = i + 1; j < preds.length; j++) {
          const bot1 = preds[i].bot_name
          const bot2 = preds[j].bot_name
          const pairKey = [bot1, bot2].sort().join('_')

          if (!botPairs.has(pairKey)) {
            botPairs.set(pairKey, { bot1, bot2, agreements: 0, disagreements: 0 })
          }

          const pair = botPairs.get(pairKey)
          if (preds[i].direction === preds[j].direction) {
            pair.agreements++
          } else {
            pair.disagreements++
          }
        }
      }
    })

    return Array.from(botPairs.values())
      .map(pair => ({
        ...pair,
        correlation: pair.agreements / (pair.agreements + pair.disagreements)
      }))
      .filter(pair => pair.agreements + pair.disagreements >= 10)
      .sort((a, b) => b.correlation - a.correlation)
      .slice(0, 20)
  }

  const attributePerformance = (botPerf) => {
    const totalPredictions = botPerf.reduce((sum, bot) => sum + bot.total_predictions, 0)

    return botPerf.slice(0, 10).map(bot => ({
      botName: bot.bot_name,
      contribution: (bot.total_predictions / totalPredictions) * 100,
      accuracy: bot.accuracy_rate,
      impact: (bot.total_predictions / totalPredictions) * bot.accuracy_rate * 100
    }))
  }

  const comparePerformance = (scans, predictions) => {
    const scanPerformance = {}

    scans.forEach(scan => {
      const scanPreds = predictions.filter(p => p.run_id === scan.id)
      const completed = scanPreds.filter(p => p.outcome_status !== null)
      const successful = scanPreds.filter(p => p.outcome_status === 'success')

      scanPerformance[scan.scan_type] = scanPerformance[scan.scan_type] || {
        scanType: scan.scan_type,
        totalScans: 0,
        avgAccuracy: 0,
        accuracySum: 0,
        totalPredictions: 0
      }

      scanPerformance[scan.scan_type].totalScans++
      scanPerformance[scan.scan_type].totalPredictions += scanPreds.length

      if (completed.length > 0) {
        const accuracy = successful.length / completed.length
        scanPerformance[scan.scan_type].accuracySum += accuracy
      }
    })

    return Object.values(scanPerformance).map(perf => ({
      ...perf,
      avgAccuracy: perf.totalScans > 0 ? (perf.accuracySum / perf.totalScans) * 100 : 0
    }))
  }

  const exportToCSV = () => {
    // Simple CSV export
    const csv = analytics.timeSeriesData.map(row =>
      `${row.date},${row.total},${row.successful},${row.failed},${(row.accuracy * 100).toFixed(2)}`
    ).join('\n')

    const blob = new Blob([`Date,Total,Successful,Failed,Accuracy\n${csv}`], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics_${timeRange}.csv`
    a.click()
  }

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="loading">Loading analytics...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="analytics-page">
        <div className="analytics-header">
          <h1><BarChart3 size={28} /> Advanced Analytics</h1>
        </div>
        <div className="error-message">
          <p>Error loading analytics: {error}</p>
          <button onClick={() => fetchAnalytics()}>Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <h1><BarChart3 size={28} /> Advanced Analytics</h1>
        <div className="header-controls">
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="time-range-select">
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <button onClick={exportToCSV} className="export-btn">
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="analytics-card">
          <h2><Activity size={20} /> Time Series Analysis</h2>
          <div className="time-series-chart">
            {analytics.timeSeriesData.length > 0 ? (
              <div className="chart-area">
                {analytics.timeSeriesData.map((day, i) => (
                  <div key={i} className="chart-bar">
                    <div
                      className="bar-fill success"
                      style={{ height: `${day.accuracy * 100}%` }}
                      title={`${day.date}: ${(day.accuracy * 100).toFixed(1)}% accuracy`}
                    />
                    <span className="bar-label">{day.date.split('-')[2]}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No data available for this time range</p>
            )}
          </div>
          <div className="chart-stats">
            <div className="stat">
              <span className="stat-label">Avg Accuracy</span>
              <span className="stat-value">
                {(analytics.timeSeriesData.reduce((sum, d) => sum + d.accuracy, 0) / (analytics.timeSeriesData.length || 1) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Total Predictions</span>
              <span className="stat-value">
                {analytics.timeSeriesData.reduce((sum, d) => sum + d.total, 0)}
              </span>
            </div>
          </div>
        </div>

        <div className="analytics-card">
          <h2><TrendingUp size={20} /> Bot Correlation Analysis</h2>
          <div className="correlations-list">
            {analytics.botCorrelations.slice(0, 10).map((pair, i) => (
              <div key={i} className="correlation-item">
                <div className="correlation-bots">
                  <span className="bot-name">{pair.bot1}</span>
                  <span className="correlation-arrow">↔</span>
                  <span className="bot-name">{pair.bot2}</span>
                </div>
                <div className="correlation-bar">
                  <div
                    className="correlation-fill"
                    style={{ width: `${pair.correlation * 100}%` }}
                  />
                  <span className="correlation-value">{(pair.correlation * 100).toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="analytics-card">
          <h2><Award size={20} /> Performance Attribution</h2>
          <div className="attribution-list">
            {analytics.performanceAttribution.map((bot, i) => (
              <div key={i} className="attribution-item">
                <div className="attribution-header">
                  <span className="bot-name">{bot.botName}</span>
                  <span className="impact-score">{bot.impact.toFixed(1)} impact</span>
                </div>
                <div className="attribution-bars">
                  <div className="attribution-bar">
                    <span className="bar-label">Contribution</span>
                    <div className="bar">
                      <div className="bar-fill" style={{ width: `${bot.contribution}%` }} />
                    </div>
                    <span className="bar-value">{bot.contribution.toFixed(1)}%</span>
                  </div>
                  <div className="attribution-bar">
                    <span className="bar-label">Accuracy</span>
                    <div className="bar">
                      <div className="bar-fill success" style={{ width: `${bot.accuracy}%` }} />
                    </div>
                    <span className="bar-value">{bot.accuracy.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="analytics-card">
          <h2><BarChart3 size={20} /> Comparative Analysis</h2>
          <div className="comparison-table">
            <table>
              <thead>
                <tr>
                  <th>Scan Type</th>
                  <th>Total Scans</th>
                  <th>Predictions</th>
                  <th>Avg Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {analytics.comparativeAnalysis.map((comp, i) => (
                  <tr key={i}>
                    <td className="scan-type">{comp.scanType}</td>
                    <td>{comp.totalScans}</td>
                    <td>{comp.totalPredictions}</td>
                    <td className={comp.avgAccuracy >= 70 ? 'success' : comp.avgAccuracy >= 60 ? 'warning' : 'danger'}>
                      {comp.avgAccuracy.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Analytics
