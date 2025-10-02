import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { RefreshCw, TrendingUp, TrendingDown, Target, Award, ArrowLeft } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const BotPerformanceDashboard = () => {
  const navigate = useNavigate();
  const [performances, setPerformances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [lastEvaluation, setLastEvaluation] = useState(null);

  useEffect(() => {
    fetchPerformances();
  }, []);

  const fetchPerformances = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/bots/performance`);
      setPerformances(response.data.bot_performances || []);
    } catch (error) {
      console.error('Error fetching bot performances:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerEvaluation = async () => {
    try {
      setEvaluating(true);
      const response = await axios.post(`${API}/api/bots/evaluate?hours_old=24`);
      setLastEvaluation(response.data.result);
      
      // Refresh performances after evaluation
      await fetchPerformances();
      
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

  // Calculate overall stats
  const totalPredictions = performances.reduce((sum, p) => sum + p.total_predictions, 0);
  const totalSuccessful = performances.reduce((sum, p) => sum + p.successful_predictions, 0);
  const overallAccuracy = totalSuccessful > 0 ? (totalSuccessful / (totalSuccessful + performances.reduce((sum, p) => sum + p.failed_predictions, 0))) * 100 : 0;
  const avgWeight = performances.length > 0 ? performances.reduce((sum, p) => sum + p.performance_weight, 0) / performances.length : 1.0;

  // Top performers
  const topPerformers = [...performances].sort((a, b) => b.accuracy_rate - a.accuracy_rate).slice(0, 5);
  const bottomPerformers = [...performances].sort((a, b) => a.accuracy_rate - b.accuracy_rate).slice(0, 5);

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-[var(--primary)]" />
          <span className="ml-3 text-[var(--muted)]">Loading bot performances...</span>
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
          <Button onClick={fetchPerformances} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={triggerEvaluation} disabled={evaluating} variant="primary">
            <Target className={`w-4 h-4 mr-2 ${evaluating ? 'animate-spin' : ''}`} />
            {evaluating ? 'Evaluating...' : 'Evaluate Now'}
          </Button>
        </div>
      </div>

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

      {/* Info Card */}
      <Card className="bg-[var(--panel)]">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-[var(--text)] mb-2">How Bot Learning Works</h3>
          <div className="text-sm text-[var(--muted)] space-y-2">
            <p>• Every scan saves individual bot predictions with entry/target prices</p>
            <p>• Daily at 2 AM UTC, system evaluates predictions 24h+ old</p>
            <p>• Bots with 60%+ accuracy get higher weight (1.0-1.5x)</p>
            <p>• Bots with &lt;40% accuracy get lower weight (0.5-0.8x)</p>
            <p>• System self-optimizes: better bots have more influence on recommendations</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BotPerformanceDashboard;
