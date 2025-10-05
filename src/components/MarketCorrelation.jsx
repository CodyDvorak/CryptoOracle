import React, { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, RefreshCw, Activity } from 'lucide-react'
import { API_ENDPOINTS, getHeaders } from '../config/api'
import './MarketCorrelation.css'

export default function MarketCorrelation() {
  const [correlations, setCorrelations] = useState([])
  const [snapshot, setSnapshot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [selectedTimeframe, setSelectedTimeframe] = useState('1d')

  useEffect(() => {
    fetchCorrelations()
  }, [])

  const fetchCorrelations = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_ENDPOINTS.marketCorrelation}?action=get`, {
        headers: getHeaders(),
      })
      const data = await response.json()
      setCorrelations(data.correlations || [])
      setSnapshot(data.snapshot)
    } catch (error) {
      console.error('Failed to fetch correlations:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateCorrelations = async () => {
    setCalculating(true)
    try {
      const response = await fetch(`${API_ENDPOINTS.marketCorrelation}?action=calculate`, {
        method: 'POST',
        headers: getHeaders(),
      })
      const data = await response.json()
      if (data.success) {
        await fetchCorrelations()
      }
    } catch (error) {
      console.error('Failed to calculate correlations:', error)
    } finally {
      setCalculating(false)
    }
  }

  const filteredCorrelations = correlations.filter(c => c.timeframe === selectedTimeframe)
  const strongCorrelations = filteredCorrelations.filter(c => c.strength === 'STRONG')
  const positiveCorrelations = filteredCorrelations.filter(c => c.direction === 'POSITIVE')

  if (loading) {
    return (
      <div className="market-correlation">
        <div className="correlation-loading">
          <Activity size={32} className="spinner" />
          <p>Loading market correlations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="market-correlation">
      <div className="correlation-header">
        <div>
          <h2>Market Correlation Analysis</h2>
          <p>Understand how different assets move together</p>
        </div>
        <button
          className="calculate-btn"
          onClick={calculateCorrelations}
          disabled={calculating}
        >
          {calculating ? (
            <>
              <RefreshCw size={16} className="spinner" />
              Calculating...
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              Recalculate
            </>
          )}
        </button>
      </div>

      {snapshot && (
        <div className="market-snapshot">
          <div className="snapshot-card">
            <div className="snapshot-label">BTC Dominance</div>
            <div className="snapshot-value">{snapshot.btc_dominance?.toFixed(2)}%</div>
          </div>
          <div className="snapshot-card">
            <div className="snapshot-label">Market Sentiment</div>
            <div className={`snapshot-value ${snapshot.market_sentiment?.toLowerCase()}`}>
              {snapshot.market_sentiment}
            </div>
          </div>
          <div className="snapshot-card">
            <div className="snapshot-label">Strong Correlations</div>
            <div className="snapshot-value">{strongCorrelations.length}</div>
          </div>
          <div className="snapshot-card">
            <div className="snapshot-label">Positive Correlations</div>
            <div className="snapshot-value">{positiveCorrelations.length}</div>
          </div>
        </div>
      )}

      <div className="timeframe-selector">
        <label>Timeframe:</label>
        <div className="timeframe-buttons">
          {['1h', '4h', '1d', '1w'].map(tf => (
            <button
              key={tf}
              className={selectedTimeframe === tf ? 'active' : ''}
              onClick={() => setSelectedTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="correlations-grid">
        <div className="correlation-section">
          <h3>
            <TrendingUp size={20} />
            Strong Positive Correlations
          </h3>
          <div className="correlation-list">
            {filteredCorrelations
              .filter(c => c.strength === 'STRONG' && c.direction === 'POSITIVE')
              .slice(0, 10)
              .map((corr, idx) => (
                <CorrelationCard key={idx} correlation={corr} />
              ))}
            {filteredCorrelations.filter(c => c.strength === 'STRONG' && c.direction === 'POSITIVE').length === 0 && (
              <div className="no-data">No strong positive correlations found</div>
            )}
          </div>
        </div>

        <div className="correlation-section">
          <h3>
            <TrendingDown size={20} />
            Strong Negative Correlations
          </h3>
          <div className="correlation-list">
            {filteredCorrelations
              .filter(c => c.strength === 'STRONG' && c.direction === 'NEGATIVE')
              .slice(0, 10)
              .map((corr, idx) => (
                <CorrelationCard key={idx} correlation={corr} />
              ))}
            {filteredCorrelations.filter(c => c.strength === 'STRONG' && c.direction === 'NEGATIVE').length === 0 && (
              <div className="no-data">No strong negative correlations found</div>
            )}
          </div>
        </div>
      </div>

      <div className="correlation-matrix">
        <h3>Correlation Matrix</h3>
        <div className="matrix-container">
          <CorrelationMatrix correlations={filteredCorrelations} />
        </div>
      </div>

      <div className="correlation-insights">
        <h3>Key Insights</h3>
        <div className="insights-grid">
          <div className="insight-card">
            <div className="insight-icon positive">
              <TrendingUp size={20} />
            </div>
            <div className="insight-content">
              <div className="insight-title">Most Correlated Pair</div>
              <div className="insight-value">
                {(() => {
                  const highest = filteredCorrelations
                    .filter(c => c.direction === 'POSITIVE')
                    .sort((a, b) => b.correlation_coefficient - a.correlation_coefficient)[0]
                  return highest ? `${highest.base_asset} ↔ ${highest.correlated_asset} (${(highest.correlation_coefficient * 100).toFixed(0)}%)` : 'N/A'
                })()}
              </div>
            </div>
          </div>
          <div className="insight-card">
            <div className="insight-icon negative">
              <TrendingDown size={20} />
            </div>
            <div className="insight-content">
              <div className="insight-title">Most Inverse Pair</div>
              <div className="insight-value">
                {(() => {
                  const lowest = filteredCorrelations
                    .filter(c => c.direction === 'NEGATIVE')
                    .sort((a, b) => a.correlation_coefficient - b.correlation_coefficient)[0]
                  return lowest ? `${lowest.base_asset} ↔ ${lowest.correlated_asset} (${(lowest.correlation_coefficient * 100).toFixed(0)}%)` : 'N/A'
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CorrelationCard({ correlation }) {
  const percentage = (correlation.correlation_coefficient * 100).toFixed(1)
  const isPositive = correlation.direction === 'POSITIVE'

  return (
    <div className={`correlation-card ${correlation.strength.toLowerCase()}`}>
      <div className="correlation-assets">
        <span className="asset-name">{correlation.base_asset}</span>
        <span className="correlation-arrow">{isPositive ? '↔' : '↮'}</span>
        <span className="asset-name">{correlation.correlated_asset}</span>
      </div>
      <div className="correlation-details">
        <span className={`correlation-coefficient ${isPositive ? 'positive' : 'negative'}`}>
          {percentage}%
        </span>
        <span className={`correlation-strength ${correlation.strength.toLowerCase()}`}>
          {correlation.strength}
        </span>
      </div>
    </div>
  )
}

function CorrelationMatrix({ correlations }) {
  const assets = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP']

  const getCorrelation = (base, target) => {
    if (base === target) return 1
    const corr = correlations.find(
      c => (c.base_asset === base && c.correlated_asset === target) ||
           (c.base_asset === target && c.correlated_asset === base)
    )
    return corr?.correlation_coefficient || 0
  }

  return (
    <div className="matrix-table">
      <div className="matrix-row header-row">
        <div className="matrix-cell header-cell"></div>
        {assets.map(asset => (
          <div key={asset} className="matrix-cell header-cell">{asset}</div>
        ))}
      </div>
      {assets.map(baseAsset => (
        <div key={baseAsset} className="matrix-row">
          <div className="matrix-cell header-cell">{baseAsset}</div>
          {assets.map(targetAsset => {
            const coeff = getCorrelation(baseAsset, targetAsset)
            const intensity = Math.abs(coeff)
            return (
              <div
                key={targetAsset}
                className="matrix-cell"
                style={{
                  backgroundColor: coeff >= 0
                    ? `rgba(16, 185, 129, ${intensity})`
                    : `rgba(239, 68, 68, ${intensity})`
                }}
                title={`${baseAsset} ↔ ${targetAsset}: ${(coeff * 100).toFixed(1)}%`}
              >
                {(coeff * 100).toFixed(0)}%
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
