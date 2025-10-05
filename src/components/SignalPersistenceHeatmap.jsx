import React, { useState, useEffect } from 'react'
import { supabase } from '../config/api'
import { Grid3x3, Activity } from 'lucide-react'
import './SignalPersistenceHeatmap.css'

export default function SignalPersistenceHeatmap() {
  const [heatmapData, setHeatmapData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('7d')

  useEffect(() => {
    fetchSignalPersistence()
  }, [timeRange])

  const fetchSignalPersistence = async () => {
    setLoading(true)
    try {
      const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
      const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)

      const { data: scans, error } = await supabase
        .from('scan_runs')
        .select('id, completed_at')
        .eq('status', 'completed')
        .gte('completed_at', startDate.toISOString())
        .order('completed_at', { ascending: true})
        .limit(20)

      if (error) throw error

      const coinAppearances = {}
      const regimeBreakdown = {}
      const scanDates = []

      for (const scan of scans) {
        const { data: recommendations } = await supabase
          .from('recommendations')
          .select('ticker, consensus_direction, market_regime')
          .eq('run_id', scan.id)

        const dateKey = new Date(scan.completed_at).toLocaleDateString()
        scanDates.push(dateKey)

        recommendations?.forEach(rec => {
          const coin = rec.ticker

          if (!coinAppearances[coin]) {
            coinAppearances[coin] = {
              total: 0,
              long: 0,
              short: 0,
              scans: {},
              regimes: {}
            }
          }

          coinAppearances[coin].total++
          coinAppearances[coin].scans[dateKey] = rec.consensus_direction

          if (rec.consensus_direction === 'LONG') {
            coinAppearances[coin].long++
          } else {
            coinAppearances[coin].short++
          }

          if (!regimeBreakdown[coin]) {
            regimeBreakdown[coin] = {}
          }

          regimeBreakdown[coin][rec.market_regime] =
            (regimeBreakdown[coin][rec.market_regime] || 0) + 1
        })
      }

      const topCoins = Object.entries(coinAppearances)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 15)
        .map(([coin, data]) => ({
          coin,
          ...data,
          persistence: (data.total / scans.length) * 100,
          consistency: Math.max(data.long, data.short) / data.total
        }))

      const uniqueDates = [...new Set(scanDates)].sort()

      setHeatmapData({
        coins: topCoins,
        dates: uniqueDates,
        regimeBreakdown
      })
    } catch (error) {
      console.error('Failed to fetch signal persistence:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="heatmap-loading">
        <Activity className="spin" size={32} />
        <span>Analyzing signal persistence...</span>
      </div>
    )
  }

  if (!heatmapData || heatmapData.coins.length === 0) {
    return (
      <div className="heatmap-empty">
        <Grid3x3 size={48} />
        <p>No signal data available for heatmap</p>
      </div>
    )
  }

  const maxPersistence = Math.max(...heatmapData.coins.map(c => c.persistence))

  return (
    <div className="signal-persistence-heatmap">
      <div className="heatmap-header">
        <h3>
          <Grid3x3 size={20} />
          Signal Persistence Heatmap
        </h3>
        <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
        </select>
      </div>

      <p className="heatmap-description">
        Coins that appear frequently across multiple scans show stronger signal persistence
      </p>

      <div className="heatmap-grid">
        <div className="grid-header">
          <div className="coin-column-header">Coin</div>
          {heatmapData.dates.map((date, idx) => (
            <div key={idx} className="date-header">{new Date(date).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}</div>
          ))}
          <div className="stats-header">Persistence</div>
        </div>

        {heatmapData.coins.map((coinData, idx) => (
          <div key={coinData.coin} className="heatmap-row">
            <div className="coin-cell">
              <span className="coin-name">{coinData.coin}</span>
              <span className="coin-count">({coinData.total})</span>
            </div>

            {heatmapData.dates.map((date, dateIdx) => {
              const direction = coinData.scans[date]
              return (
                <div
                  key={dateIdx}
                  className={`signal-cell ${direction ? direction.toLowerCase() : 'empty'}`}
                  title={direction ? `${coinData.coin} - ${direction} on ${date}` : 'No signal'}
                >
                  {direction && <span className="signal-indicator">{direction === 'LONG' ? '▲' : '▼'}</span>}
                </div>
              )
            })}

            <div className="persistence-cell">
              <div className="persistence-bar-container">
                <div
                  className="persistence-bar"
                  style={{ width: `${(coinData.persistence / maxPersistence) * 100}%` }}
                />
              </div>
              <span className="persistence-value">{coinData.persistence.toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="heatmap-legend">
        <div className="legend-item">
          <div className="legend-indicator long">▲</div>
          <span>LONG Signal</span>
        </div>
        <div className="legend-item">
          <div className="legend-indicator short">▼</div>
          <span>SHORT Signal</span>
        </div>
        <div className="legend-item">
          <div className="legend-indicator empty" />
          <span>No Signal</span>
        </div>
      </div>

      <div className="persistence-insights">
        <h4>Top Persistent Signals</h4>
        <div className="insights-grid">
          {heatmapData.coins.slice(0, 5).map(coinData => (
            <div key={coinData.coin} className="insight-card">
              <div className="insight-header">
                <span className="insight-coin">{coinData.coin}</span>
                <span className={`insight-direction ${coinData.long > coinData.short ? 'long' : 'short'}`}>
                  {coinData.long > coinData.short ? 'LONG' : 'SHORT'}
                </span>
              </div>
              <div className="insight-stats">
                <div className="insight-stat">
                  <span className="stat-label">Appearances</span>
                  <span className="stat-value">{coinData.total}</span>
                </div>
                <div className="insight-stat">
                  <span className="stat-label">Persistence</span>
                  <span className="stat-value">{coinData.persistence.toFixed(0)}%</span>
                </div>
                <div className="insight-stat">
                  <span className="stat-label">Consistency</span>
                  <span className="stat-value">{(coinData.consistency * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="insights-note">
          Higher persistence and consistency indicate stronger, more reliable signals
        </p>
      </div>
    </div>
  )
}
