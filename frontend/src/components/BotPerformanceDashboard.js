import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { RefreshCw, TrendingUp, TrendingDown, Target, Award, ArrowLeft, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Clock, ChartBar as BarChart3 } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';

const API = process.env.REACT_APP_BACKEND_URL || '';

const BotPerformanceDashboard = () => {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const [performances, setPerformances] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [regimePerformance, setRegimePerformance] = useState([]);
  const [degradationAlerts, setDegradationAlerts] = useState([]);
  const [dataReadiness, setDataReadiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [lastEvaluation, setLastEvaluation] = useState(null);
  const [scanRunning, setScanRunning] = useState(false);

  useEffect(() => {
    checkScanStatusAndFetch();
  }, []);

  const checkScanStatusAndFetch = async () => {
    setLoading(true);
    try {
      // First, check if a scan is running
      const statusResponse = await axios.get(`${API}/api/scan/is-running`);
      const isRunning = statusResponse.data.is_running;
      
      setScanRunning(isRunning);
      
      if (isRunning) {
        // Scan is running, show message and don't fetch analytics
        setLoading(false);
        addNotification('Bot Analytics unavailable during scan. Please wait for scan to complete.', 'info');
        return;
      }
      
      // Scan not running, fetch all data
      await fetchAllData();
    } catch (error) {
      console.error('Error checking scan status:', error);
      // If we can't check status, try fetching anyway
      addNotification('Unable to check scan status. Attempting to load analytics...', 'error');
      await fetchAllData();
    }
  };

  const fetchAllData = async () => {
    try {
      await Promise.all([
        fetchPerformances(),
        fetchSystemHealth(),
        fetchRegimePerformance(),
        fetchDegradationAlerts(),
        fetchDataReadiness()
      ]);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      addNotification('Failed to load some analytics data. Please try again later.', 'error');
      setLoading(false);
    }
  };

  const fetchPerformances = async () => {
    try {
      const response = await axios.get(`${API}/api/bots/performance`);
      setPerformances(response.data.bot_performances || []);
    } catch (error) {
      console.error('Error fetching bot performances:', error);
    }
  };

  const fetchSystemHealth = async () => {
    try {
      const response = await axios.get(`${API}/api/analytics/system-health`);
      setSystemHealth(response.data);
    } catch (error) {
      console.error('Error fetching system health:', error);
    }
  };

  const fetchRegimePerformance = async () => {
    try {
      const response = await axios.get(`${API}/api/analytics/performance-by-regime`);
      setRegimePerformance(response.data.regime_performances || []);
    } catch (error) {
      console.error('Error fetching regime performance:', error);
    }
  };

  const fetchDegradationAlerts = async () => {
    try {
      const response = await axios.get(`${API}/api/analytics/bot-degradation`);
      setDegradationAlerts(response.data.alerts || []);
    } catch (error) {
      console.error('Error fetching degradation alerts:', error);
    }
  };

  const fetchDataReadiness = async () => {
    try {
      const response = await axios.get(`${API}/api/analytics/data-readiness`);
      setDataReadiness(response.data);
    } catch (error) {
      console.error('Error fetching data readiness:', error);
    }
  };

  const triggerEvaluation = async () => {
    try {
      setEvaluating(true);
      const response = await axios.post(`${API}/api/bots/evaluate?hours_old=24`);
      setLastEvaluation(response.data.result);
      
      // Refresh all data after evaluation
      await fetchAllData();
      
      alert(`Evaluation complete! ${response.data.result.wins} wins, ${response.data.result.losses} losses`);
    } catch (error) {
      console.error('Error triggering evaluation:', error);
      alert('Error triggering evaluation');
    } finally {
      setEvaluating(false);
    }
  };

  const getPerformanceColor = (accuracy) => {
    if (accuracy >= 60) return 'text-[var(--success)]';
    if (accuracy >= 40) return 'text-[var(--muted)]';
    return 'text-[var(--danger)]';
  };

  const getWeightBadgeColor = (weight) => {
    if (weight >= 1.2) return 'bg-[var(--success)] text-black';
    if (weight <= 0.8) return 'bg-[var(--danger)] text-white';
    return 'bg-[var(--muted)] text-[var(--text)]';
  };

  const getReadinessColor = (percent) => {
    if (percent >= 80) return 'text-[var(--success)]';
    if (percent >= 30) return 'text-[var(--warning)]';
    return 'text-[var(--muted)]';
  };

  const getReadinessIcon = (status) => {
    if (status === 'ready_for_optimization') return <CheckCircle className="w-5 h-5 text-[var(--success)]" />;
    if (status === 'collecting') return <Clock className="w-5 h-5 text-[var(--warning)]" />;
    return <BarChart3 className="w-5 h-5 text-[var(--muted)]" />;
  };

  // Calculate overall stats
  const totalPredictions = performances.reduce((sum, p) => sum + p.total_predictions, 0);
  const totalSuccessful = performances.reduce((sum, p) => sum + p.successful_predictions, 0);
  const overallAccuracy = totalSuccessful > 0 ? (totalSuccessful / (totalSuccessful + performances.reduce((sum, p) => sum + p.failed_predictions, 0))) * 100 : 0;
  const avgWeight = performances.length > 0 ? performances.reduce((sum, p) => sum + p.performance_weight, 0) / performances.length : 1.0;

  // Top performers
  const topPerformers = [...performances].sort((a, b) => b.accuracy_rate - a.accuracy_rate).slice(0, 5);
  const bottomPerformers = [...performances].sort((a, b) => a.accuracy_rate - b.accuracy_rate).slice(0, 5);

  // Top performers by regime
  const topByRegime = regimePerformance
    .filter(b => b.best_regime)
    .slice(0, 10);

  // If scan is running, show unavailable message
  if (scanRunning && !loading) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="border-2 border-yellow-500 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700">
              <Clock className="w-6 h-6" />
              Analytics Temporarily Unavailable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-yellow-700 mb-4">
              Bot Analytics are currently unavailable while a scan is running. This prevents system overload and ensures your scan completes quickly.
            </p>
            <p className="text-yellow-600 mb-4">
              Please wait for the scan to complete and try again. You can check scan status on the main dashboard.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => navigate('/')} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Dashboard
              </Button>
              <Button onClick={checkScanStatusAndFetch} variant="primary">
                <RefreshCw className="w-4 h-4 mr-2" />
                Check Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-[var(--primary)]" />
          <span className="ml-3 text-[var(--muted)]">Loading analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text)]">🤖 Bot Performance Dashboard</h1>
          <p className="text-[var(--muted)] mt-1">Track and analyze bot prediction accuracy over time</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => navigate('/')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return to Scanner
          </Button>
          <Button onClick={fetchAllData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={triggerEvaluation} disabled={evaluating} variant="primary">
            <Target className={`w-4 h-4 mr-2 ${evaluating ? 'animate-spin' : ''}`} />
            {evaluating ? 'Evaluating...' : 'Evaluate Now'}
          </Button>
        </div>
      </div>

      {/* Data Readiness Indicator - Most Important Section */}
      {dataReadiness && (
        <Card className="bg-gradient-to-r from-[var(--panel)] to-[var(--background)] border-2 border-[var(--primary)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getReadinessIcon(dataReadiness.status)}
              📊 Data Collection Progress
            </CardTitle>
            <CardDescription>System is gathering data for optimization decisions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-[var(--muted)]">Months of Data</div>
                <div className="text-2xl font-bold text-[var(--text)] mt-1">
                  {dataReadiness.months_collected.toFixed(1)} / {dataReadiness.months_target}
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  {dataReadiness.months_remaining > 0 
                    ? `${dataReadiness.months_remaining.toFixed(1)} months remaining`
                    : 'Target reached!'}
                </div>
              </div>

              <div>
                <div className="text-sm text-[var(--muted)]">Evaluated Predictions</div>
                <div className="text-2xl font-bold text-[var(--text)] mt-1">
                  {dataReadiness.evaluated_predictions.toLocaleString()} / {dataReadiness.predictions_target.toLocaleString()}
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  {dataReadiness.predictions_remaining > 0
                    ? `${dataReadiness.predictions_remaining.toLocaleString()} more needed`
                    : 'Target reached!'}
                </div>
              </div>

              <div>
                <div className="text-sm text-[var(--muted)]">Readiness Status</div>
                <div className={`text-2xl font-bold mt-1 ${getReadinessColor(dataReadiness.readiness_percent)}`}>
                  {dataReadiness.readiness_percent.toFixed(1)}%
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  {dataReadiness.status === 'ready_for_optimization' && '✅ Ready for optimization'}
                  {dataReadiness.status === 'collecting' && '🟡 Collecting data'}
                  {dataReadiness.status === 'not_ready' && '⏳ Just started'}
                </div>
              </div>

              <div>
                <div className="text-sm text-[var(--muted)]">Current Accuracy</div>
                <div className={`text-2xl font-bold mt-1 ${getPerformanceColor(dataReadiness.system_accuracy)}`}>
                  {dataReadiness.system_accuracy.toFixed(1)}%
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">System-wide baseline</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="w-full bg-[var(--card-border)] rounded-full h-2.5">
                <div 
                  className="bg-[var(--primary)] h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, dataReadiness.readiness_percent)}%` }}
                ></div>
              </div>
              <div className="text-xs text-[var(--muted)] mt-2 text-center">
                {dataReadiness.readiness_percent < 30 && '📈 System is collecting baseline data...'}
                {dataReadiness.readiness_percent >= 30 && dataReadiness.readiness_percent < 80 && '📊 Good progress! Keep collecting data for accurate optimization.'}
                {dataReadiness.readiness_percent >= 80 && '✅ Sufficient data collected! Ready to implement parameter optimization if needed.'}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Health Overview */}
      {systemHealth && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📈 System Performance Overview
            </CardTitle>
            <CardDescription>Overall system health and trends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-[var(--muted)]">System Accuracy</div>
                <div className={`text-3xl font-bold mt-1 ${getPerformanceColor(systemHealth.system_accuracy)}`}>
                  {systemHealth.system_accuracy.toFixed(1)}%
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">Weighted average</div>
              </div>

              <div>
                <div className="text-sm text-[var(--muted)]">Accuracy Trend</div>
                <div className="flex items-center gap-2 mt-1">
                  {systemHealth.accuracy_trend === 'improving' && (
                    <TrendingUp className="w-8 h-8 text-[var(--success)]" />
                  )}
                  {systemHealth.accuracy_trend === 'declining' && (
                    <TrendingDown className="w-8 h-8 text-[var(--danger)]" />
                  )}
                  {systemHealth.accuracy_trend === 'stable' && (
                    <span className="text-2xl">→</span>
                  )}
                  <span className="text-xl font-bold text-[var(--text)]">
                    {systemHealth.accuracy_trend === 'improving' && '↗️ Improving'}
                    {systemHealth.accuracy_trend === 'declining' && '↘️ Declining'}
                    {systemHealth.accuracy_trend === 'stable' && '→ Stable'}
                  </span>
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  {systemHealth.trend_change_percent >= 0 ? '+' : ''}{systemHealth.trend_change_percent.toFixed(1)}% change
                </div>
              </div>

              <div>
                <div className="text-sm text-[var(--muted)]">Total Evaluated</div>
                <div className="text-3xl font-bold text-[var(--text)] mt-1">
                  {systemHealth.total_evaluated_predictions.toLocaleString()}
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">Predictions assessed</div>
              </div>

              <div>
                <div className="text-sm text-[var(--muted)]">Pending</div>
                <div className="text-3xl font-bold text-[var(--text)] mt-1">
                  {systemHealth.total_pending_predictions.toLocaleString()}
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">Awaiting evaluation</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bot Degradation Alerts */}
      {degradationAlerts.length > 0 && (
        <Card className="border-l-4 border-l-[var(--danger)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[var(--danger)]" />
              ⚠️ Attention Required
            </CardTitle>
            <CardDescription>Bots showing performance issues</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {degradationAlerts.map((alert) => (
                <div 
                  key={alert.bot_name} 
                  className={`p-4 rounded-lg border ${
                    alert.severity === 'critical' 
                      ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' 
                      : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs font-bold rounded ${
                          alert.severity === 'critical' 
                            ? 'bg-[var(--danger)] text-white' 
                            : 'bg-[var(--warning)] text-black'
                        }`}>
                          {alert.severity === 'critical' ? '🔴' : '🟡'} {alert.severity.toUpperCase()}
                        </span>
                        <span className="font-bold text-[var(--text)]">{alert.bot_name}</span>
                      </div>
                      <div className="text-sm text-[var(--muted)] mt-1">{alert.message}</div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-bold text-[var(--danger)]">
                        {alert.current_accuracy.toFixed(1)}%
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        was {alert.previous_accuracy.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Alerts - Show Success Message */}
      {degradationAlerts.length === 0 && (
        <Card className="border-l-4 border-l-[var(--success)]">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-[var(--success)]">
              <CheckCircle className="w-6 h-6" />
              <div>
                <div className="font-bold">✅ All Bots Healthy</div>
                <div className="text-sm text-[var(--muted)] mt-1">No performance degradation detected</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Market Regime Performance */}
      {regimePerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>📊 Performance by Market Condition</CardTitle>
            <CardDescription>See which bots excel in different market regimes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text)]">Bot Name</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-[var(--text)]">Bull Market</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-[var(--text)]">Bear Market</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-[var(--text)]">High Vol</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-[var(--text)]">Sideways</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-[var(--text)]">Best In</th>
                  </tr>
                </thead>
                <tbody>
                  {topByRegime.map((bot) => (
                    <tr key={bot.bot_name} className="border-b border-[var(--card-border)] hover:bg-[var(--panel)] transition-colors">
                      <td className="py-3 px-4 font-medium text-[var(--text)]">{bot.bot_name}</td>
                      <td className="py-3 px-4 text-center">
                        {bot.bull_market_accuracy !== null ? (
                          <span className={getPerformanceColor(bot.bull_market_accuracy)}>
                            {bot.bull_market_accuracy.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-[var(--muted)]">-</span>
                        )}
                        <div className="text-xs text-[var(--muted)]">
                          {bot.bull_market_predictions > 0 ? `${bot.bull_market_predictions} preds` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {bot.bear_market_accuracy !== null ? (
                          <span className={getPerformanceColor(bot.bear_market_accuracy)}>
                            {bot.bear_market_accuracy.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-[var(--muted)]">-</span>
                        )}
                        <div className="text-xs text-[var(--muted)]">
                          {bot.bear_market_predictions > 0 ? `${bot.bear_market_predictions} preds` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {bot.high_volatility_accuracy !== null ? (
                          <span className={getPerformanceColor(bot.high_volatility_accuracy)}>
                            {bot.high_volatility_accuracy.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-[var(--muted)]">-</span>
                        )}
                        <div className="text-xs text-[var(--muted)]">
                          {bot.high_volatility_predictions > 0 ? `${bot.high_volatility_predictions} preds` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {bot.sideways_accuracy !== null ? (
                          <span className={getPerformanceColor(bot.sideways_accuracy)}>
                            {bot.sideways_accuracy.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-[var(--muted)]">-</span>
                        )}
                        <div className="text-xs text-[var(--muted)]">
                          {bot.sideways_predictions > 0 ? `${bot.sideways_predictions} preds` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {bot.best_regime ? (
                          <span className="px-2 py-1 bg-[var(--success)] text-black text-xs font-bold rounded">
                            {bot.best_regime}
                          </span>
                        ) : (
                          <span className="text-[var(--muted)]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {regimePerformance.length > 10 && (
              <div className="mt-4 text-center text-sm text-[var(--muted)]">
                Showing top 10 bots. Total: {regimePerformance.length} bots analyzed.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-[var(--muted)]">Total Bots</div>
            <div className="text-3xl font-bold text-[var(--text)] mt-1">{performances.length}</div>
            <div className="text-xs text-[var(--muted)] mt-1">Active prediction bots</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-[var(--muted)]">Total Predictions</div>
            <div className="text-3xl font-bold text-[var(--text)] mt-1">{totalPredictions.toLocaleString()}</div>
            <div className="text-xs text-[var(--muted)] mt-1">Across all bots</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-[var(--muted)]">Overall Accuracy</div>
            <div className={`text-3xl font-bold mt-1 ${getPerformanceColor(overallAccuracy)}`}>
              {overallAccuracy.toFixed(1)}%
            </div>
            <div className="text-xs text-[var(--muted)] mt-1">Successful predictions</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-[var(--muted)]">Avg Weight</div>
            <div className="text-3xl font-bold text-[var(--text)] mt-1">{avgWeight.toFixed(2)}x</div>
            <div className="text-xs text-[var(--muted)] mt-1">Performance multiplier</div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-[var(--success)]" />
              Top 5 Performers
            </CardTitle>
            <CardDescription>Bots with highest accuracy rates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topPerformers.map((bot, index) => (
                <div key={bot.bot_name} className="flex items-center justify-between p-3 bg-[var(--panel)] rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--success)] text-black font-bold text-sm">
                      #{index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-[var(--text)]">{bot.bot_name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {bot.total_predictions} predictions
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-[var(--success)]">
                      {bot.accuracy_rate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {bot.avg_profit_loss >= 0 ? '+' : ''}{bot.avg_profit_loss.toFixed(1)}% P/L
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-[var(--danger)]" />
              Bottom 5 Performers
            </CardTitle>
            <CardDescription>Bots needing improvement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bottomPerformers.map((bot, index) => (
                <div key={bot.bot_name} className="flex items-center justify-between p-3 bg-[var(--panel)] rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--danger)] text-white font-bold text-sm">
                      #{performances.length - index}
                    </div>
                    <div>
                      <div className="font-medium text-[var(--text)]">{bot.bot_name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {bot.total_predictions} predictions
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-[var(--danger)]">
                      {bot.accuracy_rate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {bot.avg_profit_loss >= 0 ? '+' : ''}{bot.avg_profit_loss.toFixed(1)}% P/L
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Bots Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Bot Performances</CardTitle>
          <CardDescription>Complete performance breakdown for all {performances.length} bots</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--card-border)]">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text)]">Bot Name</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-[var(--text)]">Total</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-[var(--text)]">Wins</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-[var(--text)]">Losses</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-[var(--text)]">Pending</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-[var(--text)]">Accuracy</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-[var(--text)]">Avg P/L</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-[var(--text)]">Weight</th>
                </tr>
              </thead>
              <tbody>
                {performances.map((bot) => (
                  <tr key={bot.bot_name} className="border-b border-[var(--card-border)] hover:bg-[var(--panel)] transition-colors">
                    <td className="py-3 px-4 font-medium text-[var(--text)]">{bot.bot_name}</td>
                    <td className="py-3 px-4 text-center text-[var(--muted)]">{bot.total_predictions}</td>
                    <td className="py-3 px-4 text-center text-[var(--success)]">{bot.successful_predictions}</td>
                    <td className="py-3 px-4 text-center text-[var(--danger)]">{bot.failed_predictions}</td>
                    <td className="py-3 px-4 text-center text-[var(--muted)]">{bot.pending_predictions}</td>
                    <td className={`py-3 px-4 text-center font-bold ${getPerformanceColor(bot.accuracy_rate)}`}>
                      {bot.accuracy_rate.toFixed(1)}%
                    </td>
                    <td className={`py-3 px-4 text-center ${bot.avg_profit_loss >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                      {bot.avg_profit_loss >= 0 ? '+' : ''}{bot.avg_profit_loss.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${getWeightBadgeColor(bot.performance_weight)}`}>
                        {bot.performance_weight.toFixed(2)}x
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Info Card - Updated with new information */}
      <Card className="bg-[var(--panel)]">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-[var(--text)] mb-2">📚 How the System Works</h3>
          <div className="text-sm text-[var(--muted)] space-y-2">
            <p><strong>Data Collection (Current Phase):</strong></p>
            <p>• Every scan saves individual bot predictions with market regime classification</p>
            <p>• Daily at 2 AM UTC, system evaluates predictions 24h+ old against actual prices</p>
            <p>• System tracks bot accuracy by market condition (bull/bear/volatile/sideways)</p>
            <p>• Degradation alerts identify bots showing performance decline</p>
            
            <p className="pt-2"><strong>Dynamic Bot Weighting (Active Now):</strong></p>
            <p>• Bots with 60%+ accuracy get higher weight (1.0-1.5x)</p>
            <p>• Bots with &lt;40% accuracy get lower weight (0.5-0.8x)</p>
            <p>• System self-optimizes: better bots have more influence on recommendations</p>
            
            <p className="pt-2"><strong>Future Optimization (After 6+ Months):</strong></p>
            <p>• With enough data, can implement parameter optimization for underperforming bots</p>
            <p>• Example: Adjust RSI thresholds, MACD periods based on historical success</p>
            <p>• Data readiness indicator above shows progress toward optimization milestone</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BotPerformanceDashboard;