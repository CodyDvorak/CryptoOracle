import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import CryptoChart from '../components/CryptoChart';
import { supabase } from '../config/api';
import './Charts.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Charts error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', background: '#0a0e1a', color: '#fff', padding: '2rem', textAlign: 'center' }}>
          <h1 style={{ color: '#ef4444', marginBottom: '1rem' }}>Something went wrong</h1>
          <p>{this.state.error?.message || 'An error occurred'}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const INTERVALS = [
  { value: '1h', label: '1H' },
  { value: '4h', label: '4H' },
  { value: '1D', label: '1D' },
  { value: '1W', label: '1W' },
];

function ChartsInner() {
  const [recommendations, setRecommendations] = useState([]);
  const [selectedCoin, setSelectedCoin] = useState('BTC');
  const [selectedInterval, setSelectedInterval] = useState('4h');
  const [loading, setLoading] = useState(true);
  const [timeframeData, setTimeframeData] = useState(null);
  const [botPredictions, setBotPredictions] = useState([]);
  const [pageError, setPageError] = useState(null);

  console.log('Charts render - loading:', loading, 'error:', pageError, 'recs:', recommendations.length);

  // Check if supabase is configured
  if (!supabase) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0e1a', color: '#fff', padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ color: '#ef4444', marginBottom: '1rem' }}>Configuration Error</h1>
        <p>Supabase client is not properly configured. Please check your environment variables.</p>
      </div>
    );
  }

  useEffect(() => {
    fetchLatestRecommendations().catch(err => {
      console.error('Failed to fetch recommendations:', err);
      setPageError(err.message || 'Failed to load data');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedCoin) {
      fetchTimeframeData().catch(err => console.error('Timeframe data error:', err));
      fetchBotPredictions().catch(err => console.error('Bot predictions error:', err));
    }
  }, [selectedCoin]);

  const fetchLatestRecommendations = async () => {
    try {
      const { data: latestScan, error: scanError } = await supabase
        .from('scan_runs')
        .select('id')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (scanError) throw scanError;

      if (latestScan) {
        const { data: recs, error: recsError } = await supabase
          .from('recommendations')
          .select('*')
          .eq('run_id', latestScan.id)
          .order('avg_confidence', { ascending: false });

        if (recsError) throw recsError;

        setRecommendations(recs || []);
        if (recs?.length > 0) {
          setSelectedCoin(recs[0].ticker);
        }
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setPageError(error.message || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeframeData = async () => {
    try {
      const { data: latestScan } = await supabase
        .from('scan_runs')
        .select('id')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestScan) {
        const { data } = await supabase
          .from('timeframe_analyses')
          .select('*')
          .eq('run_id', latestScan.id)
          .eq('coin_symbol', selectedCoin)
          .maybeSingle();

        setTimeframeData(data);
      }
    } catch (error) {
      console.error('Error fetching timeframe data:', error);
    }
  };

  const fetchBotPredictions = async () => {
    try {
      const { data: latestScan } = await supabase
        .from('scan_runs')
        .select('id')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestScan) {
        const { data } = await supabase
          .from('bot_predictions')
          .select('*')
          .eq('run_id', latestScan.id)
          .eq('coin_symbol', selectedCoin)
          .order('confidence_score', { ascending: false });

        setBotPredictions(data || []);
      }
    } catch (error) {
      console.error('Error fetching bot predictions:', error);
    }
  };

  const currentRecommendation = recommendations.find(
    (r) => r.ticker === selectedCoin
  );

  return (
    <div className="charts-page" style={{ minHeight: '100vh', background: '#0a0e1a', color: '#fff' }}>
      <div className="charts-header" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Activity size={32} style={{ color: '#3b82f6' }} />
          <div>
            <h1 style={{ margin: 0, marginBottom: '0.5rem', color: '#fff' }}>Advanced Charts</h1>
            <p style={{ margin: 0, color: '#9ca3af' }}>Professional candlestick charts with bot signals & technical analysis</p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="loading-chart" style={{ padding: '4rem', textAlign: 'center', color: '#fff' }}>
          <Activity size={48} className="spin" style={{ margin: '0 auto', marginBottom: '1rem' }} />
          <p style={{ fontSize: '1.1rem' }}>Loading recommendations...</p>
        </div>
      )}

      {pageError && !loading && (
        <div className="no-data-message">
          <Activity size={48} style={{ color: '#ef4444', marginBottom: '1rem' }} />
          <p style={{ color: '#ef4444' }}>Error: {pageError}</p>
          <button
            onClick={() => {
              setPageError(null);
              setLoading(true);
              fetchLatestRecommendations();
            }}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', borderRadius: '6px', background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !pageError && recommendations.length === 0 && (
        <div className="no-data-message">
          <Activity size={48} style={{ color: '#3b82f6', marginBottom: '1rem' }} />
          <p>No recommendations available yet.</p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.95rem' }}>Please run a scan from the Dashboard to see charts and analysis.</p>
        </div>
      )}

      {!loading && !pageError && recommendations.length > 0 && (
        <>
        <div className="charts-controls">
          <div className="coin-selector">
            <label>Select Coin:</label>
            <select
              value={selectedCoin}
              onChange={(e) => setSelectedCoin(e.target.value)}
            >
              {recommendations.map((rec) => (
                <option key={rec.ticker} value={rec.ticker}>
                  {rec.ticker} - {rec.consensus} ({(rec.avg_confidence * 100).toFixed(0)}%)
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

      {selectedCoin && timeframeData && (
        <MultiTimeframePanel data={timeframeData} />
      )}

      {currentRecommendation && (
        <div className="signal-info">
          <div className="signal-card">
            <h3>{currentRecommendation.ticker} Signal Analysis</h3>
            <div className="signal-details">
              <div className="detail-item">
                <span className="label">Direction:</span>
                <span className={`value ${currentRecommendation.consensus?.toLowerCase() || ''}`}>
                  {currentRecommendation.consensus || 'N/A'}
                </span>
              </div>
              <div className="detail-item">
                <span className="label">Confidence:</span>
                <span className="value">
                  {((currentRecommendation.bot_confidence || 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="detail-item">
                <span className="label">Regime:</span>
                <span className={`value ${currentRecommendation.regime?.toLowerCase() || ''}`}>
                  {currentRecommendation.regime || 'N/A'}
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

      {selectedCoin && (
        <>
          <div className="chart-container">
            <CryptoChart
              symbol={selectedCoin}
              predictions={botPredictions}
              supportResistance={currentRecommendation ? [
                { price: currentRecommendation.current_price * 1.05, type: 'resistance' },
                { price: currentRecommendation.current_price * 0.95, type: 'support' }
              ] : []}
            />
          </div>

          <div className="chart-legend">
            <h3>Chart Features</h3>
            <div className="legend-items">
              <div className="legend-item">
                <span className="indicator-dot green"></span>
                <span>Candlestick patterns with volume</span>
              </div>
              <div className="legend-item">
                <span className="indicator-dot blue"></span>
                <span>Bot prediction markers</span>
              </div>
              <div className="legend-item">
                <span className="indicator-dot red"></span>
                <span>Support & resistance levels</span>
              </div>
              <div className="legend-item">
                <span className="indicator-dot purple"></span>
                <span>Multiple timeframes (1m to 1W)</span>
              </div>
            </div>
          </div>

          {botPredictions.length > 0 && (
            <BotSignalsPanel predictions={botPredictions} />
          )}
        </>
      )}
        </>
      )}
    </div>
  );
}

function MultiTimeframePanel({ data = {} }) {
  const getRegimeIcon = (regime) => {
    if (regime === 'BULL') return <TrendingUp size={16} />;
    if (regime === 'BEAR') return <TrendingDown size={16} />;
    return <Minus size={16} />;
  };

  const getRegimeColor = (regime) => {
    if (regime === 'BULL') return 'green';
    if (regime === 'BEAR') return 'red';
    return 'gray';
  };

  if (!data?.analysis) return null;

  const { primary, secondary, daily, weekly, alignment } = data.analysis;
  const timeframes = [weekly, daily, primary, secondary].filter(Boolean);

  return (
    <div className="multi-timeframe-panel">
      <h3>Multi-Timeframe Analysis</h3>
      <div className="timeframe-bars">
        {timeframes.map((tf, idx) => (
          <div key={idx} className="timeframe-row">
            <div className="tf-label">{tf?.timeframe || 'N/A'}</div>
            <div className="tf-bar-container">
              <div
                className={`tf-bar ${getRegimeColor(tf?.regime)}`}
                style={{ width: `${(tf?.confidence || 0) * 100}%` }}
              >
                <span className="tf-regime">
                  {getRegimeIcon(tf?.regime)}
                  {tf?.regime || 'N/A'}
                </span>
              </div>
              <span className="tf-confidence">{((tf?.confidence || 0) * 100).toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>
      <div className="alignment-summary">
        <div className="alignment-score">
          <span className="label">Alignment Score:</span>
          <span className="value">{alignment.alignmentScore.toFixed(0)}%</span>
        </div>
        <div className="conflict-level">
          <span className="label">Conflict Level:</span>
          <span className={`value ${alignment.conflictLevel.toLowerCase()}`}>
            {alignment.conflictLevel}
          </span>
        </div>
        <div className="alignment-description">
          {alignment.description}
        </div>
      </div>
    </div>
  );
}

function BotSignalsPanel({ predictions = [] }) {
  const longCount = predictions.filter(p => p.position_direction === 'LONG').length;
  const shortCount = predictions.filter(p => p.position_direction === 'SHORT').length;
  const topPredictions = predictions.slice(0, 5);

  return (
    <div className="bot-signals-panel">
      <h3>Bot Predictions ({predictions.length} bots)</h3>
      <div className="consensus-bar">
        <div className="long-bar" style={{ width: `${(longCount / predictions.length) * 100}%` }}>
          {longCount} LONG
        </div>
        <div className="short-bar" style={{ width: `${(shortCount / predictions.length) * 100}%` }}>
          {shortCount} SHORT
        </div>
      </div>
      <div className="top-predictions">
        <h4>Top 5 Confident Bots</h4>
        {topPredictions.map((pred, idx) => (
          <div key={pred?.id || idx} className="prediction-item">
            <span className="rank">#{idx + 1}</span>
            <span className="bot-name">{pred?.bot_name || 'Unknown'}</span>
            <span className={`direction ${pred?.position_direction?.toLowerCase() || ''}`}>
              {pred?.position_direction || 'N/A'}
            </span>
            <span className="confidence">{((pred?.confidence_score || 0) * 10).toFixed(1)}/10</span>
          </div>
        ))}
      </div>
    </div>
  );
}


export default function Charts() {
  return (
    <ErrorBoundary>
      <ChartsInner />
    </ErrorBoundary>
  );
}
