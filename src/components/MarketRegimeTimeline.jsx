import React, { useState, useEffect } from 'react'
import { supabase } from '../config/api'
import { TrendingUp, TrendingDown, Minus, Calendar, Activity } from 'lucide-react'
import './MarketRegimeTimeline.css'

export default function MarketRegimeTimeline({ coin = 'BTC' }) {
  const [timelineData, setTimelineData] = useState([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('7d')

  useEffect(() => {
    fetchRegimeHistory()
  }, [coin, timeRange])

  const fetchRegimeHistory = async () => {
    setLoading(true)
    try {
      const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
      const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)

      const { data, error } = await supabase
        .from('bot_predictions')
        .select('coin_symbol, market_regime, created_at')
        .eq('coin_symbol', coin)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })

      if (error) throw error

      const regimeChanges = []
      let currentRegime = null
      let regimeStart = null
      let regimeCount = {}

      data?.forEach((point, idx) => {
        if (!regimeCount[point.created_at.split('T')[0]]) {
          regimeCount[point.created_at.split('T')[0]] = {}
        }

        const dateKey = point.created_at.split('T')[0]
        regimeCount[dateKey][point.market_regime] = (regimeCount[dateKey][point.market_regime] || 0) + 1
      })

      Object.keys(regimeCount).forEach(date => {
        const regimes = regimeCount[date]
        const dominantRegime = Object.keys(regimes).reduce((a, b) =>
          regimes[a] > regimes[b] ? a : b
        )

        if (currentRegime !== dominantRegime) {
          if (currentRegime) {
            regimeChanges.push({
              regime: currentRegime,
              startDate: regimeStart,
              endDate: date,
              duration: Math.ceil((new Date(date) - new Date(regimeStart)) / (1000 * 60 * 60 * 24))
            })
          }
          currentRegime = dominantRegime
          regimeStart = date
        }
      })

      if (currentRegime) {
        regimeChanges.push({
          regime: currentRegime,
          startDate: regimeStart,
          endDate: new Date().toISOString().split('T')[0],
          duration: Math.ceil((new Date() - new Date(regimeStart)) / (1000 * 60 * 60 * 24)),
          isActive: true
        })
      }

      setTimelineData(regimeChanges)
    } catch (error) {
      console.error('Failed to fetch regime history:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRegimeIcon = (regime) => {
    if (regime === 'BULL') return <TrendingUp size={16} />
    if (regime === 'BEAR') return <TrendingDown size={16} />
    return <Minus size={16} />
  }

  const getRegimeColor = (regime) => {
    if (regime === 'BULL') return 'green'
    if (regime === 'BEAR') return 'red'
    return 'gray'
  }

  if (loading) {
    return (
      <div className="regime-timeline-loading">
        <Activity className="spin" size={32} />
        <span>Loading regime history...</span>
      </div>
    )
  }

  return (
    <div className="market-regime-timeline">
      <div className="timeline-header">
        <h3>
          <Calendar size={20} />
          Market Regime Timeline - {coin}
        </h3>
        <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
        </select>
      </div>

      {timelineData.length === 0 ? (
        <div className="timeline-empty">
          <Calendar size={48} />
          <p>No regime data available for this period</p>
        </div>
      ) : (
        <>
          <div className="timeline-visual">
            {timelineData.map((period, idx) => {
              const totalDays = timelineData.reduce((sum, p) => sum + p.duration, 0)
              const widthPercent = (period.duration / totalDays) * 100

              return (
                <div
                  key={idx}
                  className={`timeline-segment ${getRegimeColor(period.regime)} ${period.isActive ? 'active' : ''}`}
                  style={{ width: `${widthPercent}%` }}
                  title={`${period.regime}: ${period.duration} days`}
                >
                  <div className="segment-label">
                    {getRegimeIcon(period.regime)}
                    {widthPercent > 15 && <span>{period.regime}</span>}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="timeline-list">
            {timelineData.map((period, idx) => (
              <div key={idx} className={`timeline-item ${getRegimeColor(period.regime)} ${period.isActive ? 'active-item' : ''}`}>
                <div className="timeline-marker">
                  <div className={`marker-dot ${getRegimeColor(period.regime)}`} />
                  {idx < timelineData.length - 1 && <div className="marker-line" />}
                </div>
                <div className="timeline-content">
                  <div className="timeline-regime">
                    {getRegimeIcon(period.regime)}
                    <span className="regime-name">{period.regime}</span>
                    {period.isActive && <span className="active-badge">Current</span>}
                  </div>
                  <div className="timeline-dates">
                    {new Date(period.startDate).toLocaleDateString()} - {new Date(period.endDate).toLocaleDateString()}
                  </div>
                  <div className="timeline-duration">
                    Duration: {period.duration} day{period.duration !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="timeline-summary">
            <h4>Period Summary</h4>
            <div className="summary-stats">
              {['BULL', 'BEAR', 'SIDEWAYS'].map(regime => {
                const periods = timelineData.filter(p => p.regime === regime)
                const totalDays = periods.reduce((sum, p) => sum + p.duration, 0)
                const percentage = (totalDays / timelineData.reduce((sum, p) => sum + p.duration, 0)) * 100

                if (totalDays === 0) return null

                return (
                  <div key={regime} className={`summary-stat ${getRegimeColor(regime)}`}>
                    <div className="stat-header">
                      {getRegimeIcon(regime)}
                      <span>{regime}</span>
                    </div>
                    <div className="stat-value">{totalDays} days</div>
                    <div className="stat-percentage">{percentage.toFixed(0)}% of period</div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
