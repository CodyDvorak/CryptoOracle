import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import TradingViewChart from '../components/TradingViewChart';
import { API_ENDPOINTS, getHeaders } from '../config/api';
import './Charts.css';

const INTERVALS = [
  { value: '1h', label: '1H' },
  { value: '4h', label: '4H' },
  { value: '1D', label: '1D' },
  { value: '1W', label: '1W' },
];

export default function Charts() {
  const [recommendations, setRecommendations] = useState([]);
  const [selectedCoin, setSelectedCoin] = useState('BTC');
  const [selectedInterval, setSelectedInterval] = useState('4h');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestRecommendations();
  }, []);

  const fetchLatestRecommendations = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.scanLatest, {
        headers: getHeaders(),
      });
      const data = await response.json();
      setRecommendations(data.recommendations || []);
      if (data.recommendations?.length > 0) {
        setSelectedCoin(data.recommendations[0].coin_symbol);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentRecommendation = recommendations.find(
    (r) => r.coin_symbol === selectedCoin
  );

  return (
    <div className="charts-page">
      <div className="charts-header">
        <div className="header-left">
          <Activity size={32} />
          <div>
            <h1>Advanced Charts</h1>
            <p>Interactive TradingView charts with bot signals</p>
          </div>
        </div>
      </div>

      {!loading && recommendations.length === 0 && (
        <div className="no-data-message">
          <p>No recommendations available yet. Please run a scan first from the Dashboard.</p>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="charts-controls">
          <div className="coin-selector">
            <label>Select Coin:</label>
            <select
              value={selectedCoin}
              onChange={(e) => setSelectedCoin(e.target.value)}
            >
              {recommendations.map((rec) => (
                <option key={rec.coin_symbol} value={rec.coin_symbol}>
                  {rec.coin_symbol} - {rec.consensus} ({(rec.bot_confidence * 100).toFixed(0)}%)
                </option>
              ))}
            </select>
          </div>

        <div className="interval-selector">
          <label>Timeframe:</label>
          <div className="interval-buttons">
            {INTERVALS.map((interval) => (
              <button
                key={interval.value}
                className={selectedInterval === interval.value ? 'active' : ''}
                onClick={() => setSelectedInterval(interval.value)}
              >
                {interval.label}
              </button>
            ))}
          </div>
        </div>
        </div>
      )}

      {currentRecommendation && recommendations.length > 0 && (
        <div className="signal-info">
          <div className="signal-card">
            <h3>{currentRecommendation.coin_symbol} Signal Analysis</h3>
            <div className="signal-details">
              <div className="detail-item">
                <span className="label">Direction:</span>
                <span className={`value ${currentRecommendation.consensus.toLowerCase()}`}>
                  {currentRecommendation.consensus}
                </span>
              </div>
              <div className="detail-item">
                <span className="label">Confidence:</span>
                <span className="value">
                  {(currentRecommendation.bot_confidence * 100).toFixed(1)}%
                </span>
              </div>
              <div className="detail-item">
                <span className="label">Regime:</span>
                <span className={`value ${currentRecommendation.regime.toLowerCase()}`}>
                  {currentRecommendation.regime}
                </span>
              </div>
              <div className="detail-item">
                <span className="label">Current Price:</span>
                <span className="value">${currentRecommendation.current_price?.toFixed(8) || 'N/A'}</span>
              </div>
            </div>
            {currentRecommendation.ai_analysis && (
              <div className="ai-analysis">
                <h4>AI Analysis</h4>
                <p className="reasoning">{currentRecommendation.ai_analysis.reasoning}</p>
                <div className="action-plan">
                  <strong>Action Plan:</strong>
                  <p>{currentRecommendation.ai_analysis.actionPlan}</p>
                </div>
                <div className="risk-assessment">
                  <strong>Risk Assessment:</strong>
                  <p>{currentRecommendation.ai_analysis.riskAssessment}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {recommendations.length > 0 && selectedCoin && (
        <>
          <div className="chart-container">
            {loading ? (
              <div className="loading-chart">
                <Activity size={48} className="spin" />
                <p>Loading chart...</p>
              </div>
            ) : (
              <TradingViewChart
                symbol={selectedCoin}
                interval={selectedInterval}
                height={600}
              />
            )}
          </div>

          <div className="chart-legend">
        <h3>Indicators Displayed</h3>
        <div className="legend-items">
          <div className="legend-item">
            <span className="indicator-color rsi"></span>
            <span>RSI (Relative Strength Index)</span>
          </div>
          <div className="legend-item">
            <span className="indicator-color macd"></span>
            <span>MACD (Moving Average Convergence Divergence)</span>
          </div>
          <div className="legend-item">
            <span className="indicator-color bb"></span>
            <span>Bollinger Bands</span>
          </div>
        </div>
          </div>
        </>
      )}
    </div>
  );
}
