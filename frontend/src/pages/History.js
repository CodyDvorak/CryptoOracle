import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { History as HistoryIcon, TrendingUp, CheckCircle, XCircle, Clock, Home, ArrowLeft, User, LogOut, Zap } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

const History = () => {
  const navigate = useNavigate();
  const { getAuthHeader, user, logout } = useAuth();
  const [history, setHistory] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [stats, setStats] = useState({
    total_scans: 0,
    total_predictions: 0,
    successful_predictions: 0,
    overall_success_rate: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API}/user/history`, {
        headers: getAuthHeader()
      });
      
      setHistory(response.data.history || []);
      setStats({
        total_scans: response.data.total_scans || 0,
        total_predictions: response.data.total_predictions || 0,
        successful_predictions: response.data.successful_predictions || 0,
        overall_success_rate: response.data.overall_success_rate || 0
      });
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Failed to load history');
      setLoading(false);
    }
  };

  const fetchRunDetails = async (runId) => {
    try {
      const response = await axios.get(`${API}/user/recommendations/${runId}`, {
        headers: getAuthHeader()
      });
      
      setSelectedRun(response.data.run);
      setRecommendations(response.data.recommendations || []);
    } catch (error) {
      console.error('Error fetching run details:', error);
      toast.error('Failed to load scan details');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--text)] flex items-center gap-2">
            <HistoryIcon className="w-8 h-8 text-[var(--primary)]" />
            Scan History
          </h1>
          <p className="text-[var(--muted)] mt-2">
            Welcome back, {user?.username}! Track your scans and bot prediction success rates.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-[var(--primary)]">{stats.total_scans}</div>
                <div className="text-sm text-[var(--muted)] mt-1">Total Scans</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-[var(--primary)]">{stats.total_predictions}</div>
                <div className="text-sm text-[var(--muted)] mt-1">Total Predictions</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-[var(--success)]">{stats.successful_predictions}</div>
                <div className="text-sm text-[var(--muted)] mt-1">Successful</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-[var(--primary)]">{stats.overall_success_rate.toFixed(1)}%</div>
                <div className="text-sm text-[var(--muted)] mt-1">Success Rate</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="scans" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="scans">Scan History</TabsTrigger>
            <TabsTrigger value="details" disabled={!selectedRun}>Scan Details</TabsTrigger>
          </TabsList>

          {/* Scans List */}
          <TabsContent value="scans">
            <Card>
              <CardHeader>
                <CardTitle>Your Scans</CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <div className="text-center py-12 text-[var(--muted)]">
                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No scans yet. Run your first scan to get started!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((scan) => (
                      <div
                        key={scan.id}
                        className="p-4 border border-[var(--card-border)] rounded-lg hover:bg-[var(--panel)] cursor-pointer transition-colors"
                        onClick={() => fetchRunDetails(scan.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="font-semibold text-[var(--text)]">
                                  {new Date(scan.started_at).toLocaleDateString()} - {new Date(scan.started_at).toLocaleTimeString()}
                                </p>
                                <p className="text-sm text-[var(--muted)] mt-1">
                                  {scan.total_coins} coins analyzed • {scan.filter_scope} scope
                                  {scan.min_price && ` • Min: $${scan.min_price}`}
                                  {scan.max_price && ` • Max: $${scan.max_price}`}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm text-[var(--muted)]">Recommendations</p>
                              <p className="font-bold text-[var(--primary)]">{scan.recommendations_count}</p>
                            </div>

                            <div className="text-right">
                              <p className="text-sm text-[var(--muted)]">Success Rate</p>
                              <p className="font-bold text-[var(--success)]">{scan.success_rate.toFixed(1)}%</p>
                            </div>

                            <TrendingUp className="w-5 h-5 text-[var(--primary)]" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Scan Details */}
          <TabsContent value="details">
            {selectedRun && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Scan Details - {new Date(selectedRun.started_at).toLocaleDateString()}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recommendations.map((rec, index) => (
                      <div
                        key={rec.id || index}
                        className="p-4 border border-[var(--card-border)] rounded-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold">{rec.coin} ({rec.ticker})</span>
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                rec.consensus_direction === 'long'
                                  ? 'bg-[var(--success)] text-black'
                                  : 'bg-[var(--danger)] text-white'
                              }`}>
                                {rec.consensus_direction?.toUpperCase()}
                              </span>

                              {rec.outcome_7d && (
                                <span className="flex items-center gap-1 text-sm">
                                  {rec.outcome_7d === 'success' ? (
                                    <CheckCircle className="w-4 h-4 text-[var(--success)]" />
                                  ) : rec.outcome_7d === 'failed' ? (
                                    <XCircle className="w-4 h-4 text-[var(--danger)]" />
                                  ) : (
                                    <Clock className="w-4 h-4 text-[var(--muted)]" />
                                  )}
                                  <span className="text-[var(--muted)]">
                                    {rec.outcome_7d === 'pending' ? 'Pending' : rec.outcome_7d}
                                  </span>
                                </span>
                              )}
                            </div>

                            <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-[var(--muted)]">Entry Price</p>
                                <p className="font-mono">${rec.avg_entry?.toFixed(8)}</p>
                              </div>
                              <div>
                                <p className="text-[var(--muted)]">Predicted 7d</p>
                                <p className="font-mono">${rec.avg_predicted_7d?.toFixed(8)}</p>
                              </div>
                              <div>
                                <p className="text-[var(--muted)]">Confidence</p>
                                <p className="font-bold text-[var(--primary)]">{rec.avg_confidence?.toFixed(1)}/10</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default History;
