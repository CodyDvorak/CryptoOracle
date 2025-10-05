import React, { useState, useEffect } from 'react'
import { supabase } from '../config/api'
import { GitCompare, TrendingUp, TrendingDown, BarChart3, CircleCheck as CheckCircle, Circle as XCircle } from 'lucide-react'
import './ScanComparison.css'

export default function ScanComparison() {
  const [scans, setScans] = useState([])
  const [selectedScans, setSelectedScans] = useState([])
  const [comparisonData, setComparisonData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchRecentScans()
  }, [])

  const fetchRecentScans = async () => {
    try {
      const { data, error } = await supabase
        .from('scan_runs')
        .select('*')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setScans(data || [])
    } catch (error) {
      console.error('Failed to fetch scans:', error)
    }
  }

  const handleScanSelect = (scanId) => {
    setSelectedScans(prev => {
      if (prev.includes(scanId)) {
        return prev.filter(id => id !== scanId)
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), scanId]
      }
      return [...prev, scanId]
    })
  }

  const compareScans = async () => {
    if (selectedScans.length < 2) return

    setLoading(true)
    try {
      const comparisons = await Promise.all(
        selectedScans.map(async (scanId) => {
          const scan = scans.find(s => s.id === scanId)

          const { data: recommendations } = await supabase
            .from('recommendations')
            .select('*')
            .eq('run_id', scanId)

          const { data: botPredictions } = await supabase
            .from('bot_predictions')
            .select('*')
            .eq('run_id', scanId)

          const longRecs = recommendations?.filter(r => r.consensus_direction === 'LONG') || []
          const shortRecs = recommendations?.filter(r => r.consensus_direction === 'SHORT') || []
          const avgConfidence = recommendations?.reduce((sum, r) => sum + r.avg_confidence, 0) / (recommendations?.length || 1)

          const commonCoins = recommendations?.map(r => r.ticker) || []

          return {
            scan,
            totalRecommendations: recommendations?.length || 0,
            longCount: longRecs.length,
            shortCount: shortRecs.length,
            avgConfidence,
            coins: commonCoins,
            regimes: botPredictions?.map(bp => bp.market_regime) || [],
            avgLeverage: recommendations?.reduce((sum, r) => sum + (r.avg_leverage || 3), 0) / (recommendations?.length || 1) || 3,
            executionTime: scan.completed_at && scan.started_at
              ? (new Date(scan.completed_at) - new Date(scan.started_at)) / 1000
              : 0
          }
        })
      )

      const allCoins = new Set()
      comparisons.forEach(c => c.coins.forEach(coin => allCoins.add(coin)))

      const coinOverlap = {}
      allCoins.forEach(coin => {
        coinOverlap[coin] = comparisons.map(c => c.coins.includes(coin))
      })

      setComparisonData({
        comparisons,
        coinOverlap,
        commonCoins: Array.from(allCoins).filter(coin =>
          comparisons.every(c => c.coins.includes(coin))
        )
      })
    } catch (error) {
      console.error('Comparison failed:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedScans.length >= 2) {
      compareScans()
    } else {
      setComparisonData(null)
    }
  }, [selectedScans])

  return (
    <div className="scan-comparison">
      <div className="comparison-header">
        <h3>
          <GitCompare size={20} />
          Scan Comparison Tool
        </h3>
        <p className="hint">Select 2-3 scans to compare their results</p>
      </div>

      <div className="scan-selector">
        {scans.slice(0, 10).map(scan => (
          <div
            key={scan.id}
            className={`scan-option ${selectedScans.includes(scan.id) ? 'selected' : ''}`}
            onClick={() => handleScanSelect(scan.id)}
          >
            <div className="scan-option-header">
              <span className="scan-type">{scan.scan_type}</span>
              {selectedScans.includes(scan.id) && <CheckCircle size={16} className="check" />}
            </div>
            <div className="scan-option-date">
              {new Date(scan.completed_at).toLocaleDateString()} at{' '}
              {new Date(scan.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="comparison-loading">
          <BarChart3 className="spin" size={32} />
          <span>Analyzing scans...</span>
        </div>
      )}

      {comparisonData && !loading && (
        <div className="comparison-results">
          <div className="comparison-table">
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  {comparisonData.comparisons.map((comp, idx) => (
                    <th key={idx}>
                      Scan {idx + 1}
                      <div className="scan-date">
                        {new Date(comp.scan.completed_at).toLocaleDateString()}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="metric-label">Scan Type</td>
                  {comparisonData.comparisons.map((comp, idx) => (
                    <td key={idx}>{comp.scan.scan_type}</td>
                  ))}
                </tr>
                <tr>
                  <td className="metric-label">Total Recommendations</td>
                  {comparisonData.comparisons.map((comp, idx) => (
                    <td key={idx} className="metric-value">{comp.totalRecommendations}</td>
                  ))}
                </tr>
                <tr>
                  <td className="metric-label">LONG Signals</td>
                  {comparisonData.comparisons.map((comp, idx) => (
                    <td key={idx} className="long-value">{comp.longCount}</td>
                  ))}
                </tr>
                <tr>
                  <td className="metric-label">SHORT Signals</td>
                  {comparisonData.comparisons.map((comp, idx) => (
                    <td key={idx} className="short-value">{comp.shortCount}</td>
                  ))}
                </tr>
                <tr>
                  <td className="metric-label">Avg Confidence</td>
                  {comparisonData.comparisons.map((comp, idx) => (
                    <td key={idx} className="metric-value">{(comp.avgConfidence * 100).toFixed(1)}%</td>
                  ))}
                </tr>
                <tr>
                  <td className="metric-label">Avg Leverage</td>
                  {comparisonData.comparisons.map((comp, idx) => (
                    <td key={idx} className="metric-value">{comp.avgLeverage.toFixed(1)}x</td>
                  ))}
                </tr>
                <tr>
                  <td className="metric-label">Execution Time</td>
                  {comparisonData.comparisons.map((comp, idx) => (
                    <td key={idx} className="metric-value">{comp.executionTime.toFixed(0)}s</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {comparisonData.commonCoins.length > 0 && (
            <div className="common-signals">
              <h4>Common Signals ({comparisonData.commonCoins.length})</h4>
              <div className="common-coins-list">
                {comparisonData.commonCoins.map(coin => (
                  <span key={coin} className="coin-badge">{coin}</span>
                ))}
              </div>
              <p className="common-hint">
                These coins appeared in all selected scans, indicating strong consistency
              </p>
            </div>
          )}

          <div className="comparison-insights">
            <h4>Key Insights</h4>
            <ul>
              {comparisonData.comparisons[0].longCount > comparisonData.comparisons[1].longCount ? (
                <li>First scan identified {comparisonData.comparisons[0].longCount - comparisonData.comparisons[1].longCount} more LONG opportunities</li>
              ) : comparisonData.comparisons[1].longCount > comparisonData.comparisons[0].longCount ? (
                <li>Second scan identified {comparisonData.comparisons[1].longCount - comparisonData.comparisons[0].longCount} more LONG opportunities</li>
              ) : null}

              <li>
                Signal overlap: {((comparisonData.commonCoins.length / Math.max(...comparisonData.comparisons.map(c => c.coins.length))) * 100).toFixed(0)}%
              </li>

              {Math.abs(comparisonData.comparisons[0].avgConfidence - comparisonData.comparisons[1].avgConfidence) > 0.1 && (
                <li>
                  Confidence variance: {Math.abs((comparisonData.comparisons[0].avgConfidence - comparisonData.comparisons[1].avgConfidence) * 100).toFixed(1)}% difference
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
