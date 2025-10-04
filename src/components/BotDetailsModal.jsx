import React, { useState, useEffect } from 'react'
import { X, TrendingUp, TrendingDown, Target, Activity, CircleAlert as AlertCircle } from 'lucide-react'
import { API_ENDPOINTS, getHeaders } from '../config/api'
import './BotDetailsModal.css'

export default function BotDetailsModal({ coin, runId, onClose }) {
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBotPredictions()
  }, [coin, runId])

  const fetchBotPredictions = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `${API_ENDPOINTS.botPredictions}?runId=${runId}&coinSymbol=${coin.ticker}`,
        { headers: getHeaders() }
      )
      const data = await response.json()
      setPredictions(data.predictions || [])
    } catch (error) {
      console.error('Error fetching bot predictions:', error)
    } finally {
      setLoading(false)
    }
  }

  const longPredictions = predictions.filter(p => p.position_direction === 'LONG')
  const shortPredictions = predictions.filter(p => p.position_direction === 'SHORT')
  const avgConfidenceLong = longPredictions.length > 0
    ? longPredictions.reduce((sum, p) => sum + p.confidence_score, 0) / longPredictions.length
    : 0
  const avgConfidenceShort = shortPredictions.length > 0
    ? shortPredictions.reduce((sum, p) => sum + p.confidence_score, 0) / shortPredictions.length
    : 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{coin.coin} Bot Analysis</h2>
            <p className="modal-subtitle">
              {predictions.length} bots analyzed • Current price: ${coin.current_price?.toLocaleString()}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="modal-loading">
            <Activity className="spinner" size={32} />
            <p>Loading bot predictions...</p>
          </div>
        ) : (
          <>
            <div className="prediction-summary">
              <div className="summary-card long">
                <TrendingUp size={24} />
                <div className="summary-content">
                  <div className="summary-label">Long Predictions</div>
                  <div className="summary-value">{longPredictions.length}</div>
                  <div className="summary-detail">
                    Avg Confidence: {(avgConfidenceLong * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="summary-card short">
                <TrendingDown size={24} />
                <div className="summary-content">
                  <div className="summary-label">Short Predictions</div>
                  <div className="summary-value">{shortPredictions.length}</div>
                  <div className="summary-detail">
                    Avg Confidence: {(avgConfidenceShort * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="summary-card consensus">
                <Target size={24} />
                <div className="summary-content">
                  <div className="summary-label">Consensus</div>
                  <div className="summary-value">
                    {longPredictions.length > shortPredictions.length ? 'LONG' : 'SHORT'}
                  </div>
                  <div className="summary-detail">
                    {Math.round((Math.max(longPredictions.length, shortPredictions.length) / predictions.length) * 100)}% agreement
                  </div>
                </div>
              </div>
            </div>

            <div className="predictions-list">
              <h3>Individual Bot Predictions</h3>
              <div className="predictions-grid">
                {predictions.map((prediction, index) => (
                  <div
                    key={index}
                    className={`prediction-card ${prediction.position_direction.toLowerCase()}`}
                  >
                    <div className="prediction-header">
                      <h4>{prediction.bot_name}</h4>
                      <span className={`direction-badge ${prediction.position_direction.toLowerCase()}`}>
                        {prediction.position_direction}
                      </span>
                    </div>

                    <div className="prediction-metrics">
                      <div className="metric">
                        <span className="metric-label">Confidence</span>
                        <span className="metric-value">
                          {(prediction.confidence_score * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">Entry</span>
                        <span className="metric-value">
                          ${prediction.entry_price?.toLocaleString()}
                        </span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">Target</span>
                        <span className="metric-value success">
                          ${prediction.target_price?.toLocaleString()}
                        </span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">Stop Loss</span>
                        <span className="metric-value danger">
                          ${prediction.stop_loss?.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="prediction-footer">
                      <span className="leverage">
                        {prediction.leverage}x leverage
                      </span>
                      <span className="regime">
                        {prediction.market_regime}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
