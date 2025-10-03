import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { History as HistoryIcon, TrendingUp, CheckCircle, XCircle, Clock, Home, ArrowLeft, User, LogOut, Zap, RefreshCw } from 'lucide-react';
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
    <div className="min-h-screen bg-[var(--background)]">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-40 backdrop-blur-sm bg-black/40 border-b border-[var(--card-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo - clickable to go home */}
            <button 
              onClick={() => navigate('/')}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <Zap className="w-6 h-6 text-[var(--primary)]" />
              <h1 className="text-xl font-bold">Crypto Oracle</h1>
            </button>
            
            <div className="hidden sm:flex items-center gap-2 text-sm text-[var(--muted)]">
              <span>/</span>
              <HistoryIcon className="w-4 h-4" />
              <span>History</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Back to Scanner */}
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="gap-2"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Scanner</span>
            </Button>
            
            {/* User Menu */}
            <div className="relative group">
              <Button variant="outline" className="gap-2">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">{user?.username}</span>
              </Button>
              
              <div className="absolute right-0 mt-2 w-48 bg-[var(--surface)] border border-[var(--card-border)] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="p-2">
                  <div className="px-3 py-2 text-sm text-[var(--muted)] border-b border-[var(--card-border)]">
                    {user?.email}
                  </div>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--panel)] rounded mt-1"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--text)] flex items-center gap-2">
            <HistoryIcon className="w-8 h-8 text-[var(--primary)]" />
            Scan History
          </h1>
          <p className="text-[var(--muted)] mt-2">
            View your past scans and bot recommendations.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                <div className="text-sm text-[var(--muted)] mt-1">Total Recommendations</div>
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
                        className="p-4 border-2 border-[var(--card-border)] rounded-lg hover:border-[var(--primary)] hover:bg-[var(--panel)] cursor-pointer transition-all"
                        onClick={() => {
                          fetchRunDetails(scan.id);
                          // Switch to details tab
                          const detailsTab = document.querySelector('[value="details"]');
                          if (detailsTab) detailsTab.click();
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="font-semibold text-[var(--text)] flex items-center gap-2">
                                  {(() => {
                                    const timestamp = scan.started_at.endsWith('Z') ? scan.started_at : scan.started_at + 'Z';
                                    const date = new Date(timestamp);
                                    return `${date.toLocaleDateString()} - ${date.toLocaleTimeString()}`;
                                  })()}
                                  <span className="text-xs px-2 py-1 bg-[var(--primary)]/20 text-[var(--primary)] rounded">
                                    Click to view
                                  </span>
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
                        className="p-4 border border-[var(--card-border)] rounded-lg bg-[var(--surface)]"
                      >
                        <div className="mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold">{rec.coin} ({rec.ticker})</span>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              rec.consensus_direction === 'long'
                                ? 'bg-[var(--success)] text-black'
                                : 'bg-[var(--danger)] text-white'
                            }`}>
                              {rec.consensus_direction?.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
                              <div>
                                <p className="text-[var(--muted)] text-xs">Entry Price</p>
                                <p className="font-mono font-semibold">${rec.avg_entry?.toFixed(8)}</p>
                              </div>
                              
                              <div>
                                <p className="text-[var(--success)] text-xs">Take Profit (TP)</p>
                                <p className="font-mono font-semibold text-[var(--success)]">${rec.avg_take_profit?.toFixed(8)}</p>
                              </div>
                              
                              <div>
                                <p className="text-[var(--danger)] text-xs">Stop Loss (SL)</p>
                                <p className="font-mono font-semibold text-[var(--danger)]">${rec.avg_stop_loss?.toFixed(8)}</p>
                              </div>
                              
                              <div>
                                <p className="text-[var(--muted)] text-xs">Predicted 7d</p>
                                <p className="font-mono font-semibold">${rec.avg_predicted_7d?.toFixed(8)}</p>
                              </div>
                              
                              <div>
                                <p className="text-[var(--muted)] text-xs">Confidence</p>
                                <p className="font-bold text-[var(--primary)]">{rec.avg_confidence?.toFixed(1)}/10</p>
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
