import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { Button } from './components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Switch } from './components/ui/switch';
import { Select, SelectOption } from './components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import { CoinRecommendationCard, BotStatusGrid, StatCard } from './components/DashboardComponents';
import { 
  TrendingUp, Activity, Clock, Settings, Mail, FileSpreadsheet, 
  RefreshCw, Filter, Zap, Play, CheckCircle, Trash2, Edit, Calendar
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  // State
  const [topConfidence, setTopConfidence] = useState([]);
  const [topPercent, setTopPercent] = useState([]);
  const [topDollar, setTopDollar] = useState([]);
  const [bots, setBots] = useState([]);
  const [scanStatus, setScanStatus] = useState({ is_running: false });
  const [filter, setFilter] = useState('all');
  const [minPrice, setMinPrice] = useState('');  // Minimum price filter
  const [maxPrice, setMaxPrice] = useState('');  // Maximum price filter
  const [scheduleInterval, setScheduleInterval] = useState('12h');
  const [loading, setLoading] = useState(false);
  
  // Saved schedules state
  const [savedSchedules, setSavedSchedules] = useState([]);
  
  // Integrations state
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [sheetsEnabled, setSheetsEnabled] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  
  // Schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleStartTime, setScheduleStartTime] = useState('');  // HH:MM format
  const [scheduleTimezone, setScheduleTimezone] = useState('UTC');
  const [nextRunTime, setNextRunTime] = useState(null);
  
  // Stats
  const [stats, setStats] = useState({
    activeBots: 21,
    lastScan: 'Never',
    totalCoins: 0,
    totalAvailable: 0  // Total available coins from CryptoCompare
  });

  // Fetch data on mount
  useEffect(() => {
    fetchRecommendations();
    fetchBots();
    fetchScanStatus();
    fetchIntegrations();
    fetchSchedule();
    fetchSavedSchedules();
    
    // Poll scan status every 10 seconds
    const interval = setInterval(fetchScanStatus, 10000);
    return () => clearInterval(interval);
  }, []);


  const fetchRecommendations = async () => {
    try {
      const response = await axios.get(`${API}/recommendations/top5`);
      setTopConfidence(response.data.top_confidence || []);
      setTopPercent(response.data.top_percent_movers || []);
      setTopDollar(response.data.top_dollar_movers || []);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setTopConfidence([]);
      setTopPercent([]);
      setTopDollar([]);
    }
  };

  const fetchSavedSchedules = async () => {
    try {
      const response = await axios.get(`${API}/config/schedules/all`);
      setSavedSchedules(response.data.schedules || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      setSavedSchedules([]);
    }
  };

  const deleteSchedule = async (scheduleId) => {
    try {
      await axios.delete(`${API}/config/schedule/${scheduleId}`);
      toast.success('Schedule deleted successfully!');
      await fetchSavedSchedules();
      await fetchSchedule();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast.error('Failed to delete schedule');
    }
  };

  const fetchBots = async () => {
    try {
      const response = await axios.get(`${API}/bots/status`);
      setBots(response.data.bots || []);
      setStats(prev => ({ ...prev, activeBots: response.data.total || 21 }));
    } catch (error) {
      console.error('Error fetching bots:', error);
    }
  };

  const fetchScanStatus = async () => {
    try {
      const response = await axios.get(`${API}/scan/status`);
      setScanStatus(response.data);
      if (response.data.recent_run) {
        const lastScan = new Date(response.data.recent_run.started_at).toLocaleString();
        setStats(prev => ({ 
          ...prev, 
          lastScan,
          totalCoins: response.data.coins_analyzed || 0,
          totalAvailable: response.data.total_available_coins || 0
        }));
      }
    } catch (error) {
      console.error('Error fetching scan status:', error);
    }
  };

  const fetchIntegrations = async () => {
    try {
      const response = await axios.get(`${API}/config/integrations`);
      setEmailEnabled(response.data.email_enabled || false);
      setEmailTo(response.data.email_to || '');
      setSheetsEnabled(response.data.sheets_enabled || false);
      setSheetUrl(response.data.sheet_url || '');
    } catch (error) {
      console.error('Error fetching integrations:', error);
    }
  };

  const fetchSchedule = async () => {
    try {
      const response = await axios.get(`${API}/config/schedule`);
      setScheduleEnabled(response.data.schedule_enabled || false);
      setScheduleInterval(response.data.schedule_interval || '12h');
      setScheduleStartTime(response.data.schedule_start_time || '');
      setScheduleTimezone(response.data.timezone || 'UTC');
      setNextRunTime(response.data.next_run_time);
      if (response.data.min_price) setMinPrice(response.data.min_price.toString());
      if (response.data.max_price) setMaxPrice(response.data.max_price.toString());
      if (response.data.filter_scope) setFilter(response.data.filter_scope);
    } catch (error) {
      console.error('Error fetching schedule:', error);
    }
  };

  const runScan = async () => {
    if (loading) return;
    
    setLoading(true);
    toast.info('Starting scan... This may take a few minutes.');
    
    try {
      const requestBody = { 
        scope: filter,
        min_price: minPrice ? parseFloat(minPrice) : null,
        max_price: maxPrice ? parseFloat(maxPrice) : null
      };
      await axios.post(`${API}/scan/run`, requestBody);
      toast.success('Scan started successfully!');
      
      // Poll for updates
      const pollInterval = setInterval(async () => {
        await fetchScanStatus();
        if (!scanStatus.is_running) {
          clearInterval(pollInterval);
          await fetchRecommendations();
          toast.success('Scan completed! Recommendations updated.');
          setLoading(false);
        }
      }, 5000);
      
      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setLoading(false);
      }, 300000);
      
    } catch (error) {
      console.error('Error running scan:', error);
      toast.error('Failed to start scan');
      setLoading(false);
    }
  };

  const saveIntegrations = async () => {
    try {
      await axios.put(`${API}/config/integrations`, {
        email_enabled: emailEnabled,
        email_to: emailTo,
        sheets_enabled: sheetsEnabled,
        sheet_url: sheetUrl
      });
      toast.success('Integrations saved successfully!');
    } catch (error) {
      console.error('Error saving integrations:', error);
      toast.error('Failed to save integrations');
    }
  };

  const saveSchedule = async () => {
    try {
      await axios.put(`${API}/config/schedule`, {
        schedule_enabled: scheduleEnabled,
        schedule_interval: scheduleInterval,
        schedule_start_time: scheduleStartTime || null,
        timezone: scheduleTimezone,
        filter_scope: filter,
        min_price: minPrice ? parseFloat(minPrice) : null,
        max_price: maxPrice ? parseFloat(maxPrice) : null
      });
      toast.success('Schedule saved successfully!');
      await fetchSchedule();  // Refresh to get next run time
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast.error('Failed to save schedule');
    }
  };

  return (
    <div className="App min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Toaster />
      
      {/* Top Navigation */}
      <nav className="sticky top-0 z-40 backdrop-blur-sm bg-black/40 border-b border-[var(--card-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-[var(--primary)]" />
            <h1 className="text-xl font-bold">Crypto Oracle</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Filter */}
            <Select 
              value={filter} 
              onValueChange={setFilter}
              className="w-32"
              data-testid="global-filter-select"
            >
              <SelectOption value="all">All Coins</SelectOption>
              <SelectOption value="alt">Alt Coins</SelectOption>
            </Select>
            
            {/* Price Filters */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[var(--muted)]" />
              <Input 
                type="number"
                step="0.01"
                min="0"
                placeholder="Min $"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-20 h-9 text-sm"
                data-testid="min-price-filter-input"
              />
              <span className="text-[var(--muted)] text-xs">-</span>
              <Input 
                type="number"
                step="0.01"
                min="0"
                placeholder="Max $"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-20 h-9 text-sm"
                data-testid="max-price-filter-input"
              />
            </div>
            
            {/* Interval Selector */}
            <div className="hidden sm:flex gap-1 bg-[var(--panel)] p-1 rounded-lg border border-[var(--card-border)]" data-testid="scheduler-toggle">
              {['6h', '12h', '24h'].map(interval => (
                <button
                  key={interval}
                  onClick={() => setScheduleInterval(interval)}
                  className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                    scheduleInterval === interval 
                      ? 'bg-[var(--surface)] text-[var(--text)]' 
                      : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                  data-testid={`interval-toggle-${interval}`}
                >
                  {interval.toUpperCase()}
                </button>
              ))}
            </div>
            
            {/* Run Scan Button */}
            <Button 
              onClick={runScan}
              disabled={loading || scanStatus.is_running}
              data-testid="refresh-button"
              className="gap-2"
            >
              {loading || scanStatus.is_running ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Scanning...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span className="hidden sm:inline">Run Scan</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </nav>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard 
            icon={Activity} 
            label="Active Bots" 
            value={stats.activeBots}
          />
          <StatCard 
            icon={Clock} 
            label="Last Scan" 
            value={stats.lastScan === 'Never' ? 'Never' : new Date(stats.lastScan).toLocaleTimeString()}
          />
          <StatCard 
            icon={TrendingUp} 
            label="Coins Analyzed" 
            value={stats.totalAvailable > 0 ? `${stats.totalCoins}/${stats.totalAvailable}` : stats.totalCoins}
          />
        </div>
        
        {/* Recommendations with Tabs */}
        <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[var(--primary)]" />
            Top Recommendations
          </h2>
          
          {topConfidence.length === 0 && topPercent.length === 0 && topDollar.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="max-w-md mx-auto">
                <Activity className="w-16 h-16 mx-auto mb-4 text-[var(--muted)]" />
                <h3 className="text-lg font-semibold mb-2">No Recommendations Yet</h3>
                <p className="text-[var(--muted)] mb-4">
                  Run your first scan to get AI-powered price predictions from 21 diverse bots analyzing TokenMetrics data.
                </p>
                <Button onClick={runScan} className="gap-2">
                  <Play className="w-4 h-4" />
                  Run First Scan
                </Button>
              </div>
            </Card>
          ) : (
            <Tabs defaultValue="confidence">
              <TabsList className="mb-4">
                <TabsTrigger value="confidence">
                  Top Confidence
                  {topConfidence.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-[var(--accent)] text-xs">
                      {topConfidence.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="percent">
                  % Movers
                  {topPercent.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-[var(--accent)] text-xs">
                      {topPercent.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="dollar">
                  $ Movers
                  {topDollar.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-[var(--accent)] text-xs">
                      {topDollar.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="confidence">
                <div className="mb-2 text-sm text-[var(--muted)]">
                  Highest AI confidence scores - Best overall signal quality
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                  {topConfidence.map((rec, index) => (
                    <CoinRecommendationCard 
                      key={rec.id || index}
                      recommendation={rec}
                      rank={index + 1}
                    />
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="percent">
                <div className="mb-2 text-sm text-[var(--muted)]">
                  Biggest predicted percentage moves (7-day) - Best % gainers
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                  {topPercent.map((rec, index) => (
                    <CoinRecommendationCard 
                      key={rec.id || index}
                      recommendation={rec}
                      rank={index + 1}
                    />
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="dollar">
                <div className="mb-2 text-sm text-[var(--muted)]">
                  Biggest predicted dollar moves - Highest absolute value changes
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                  {topDollar.map((rec, index) => (
                    <CoinRecommendationCard 
                      key={rec.id || index}
                      recommendation={rec}
                      rank={index + 1}
                    />
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </section>

        {/* Saved Schedules Section */}
        <section className="mt-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-[var(--primary)]" />
            Saved Schedules
          </h2>
          
          {savedSchedules.length === 0 ? (
            <Card className="p-8 text-center">
              <Clock className="w-12 h-12 mx-auto mb-3 text-[var(--muted)]" />
              <p className="text-[var(--muted)]">
                No active schedules. Configure one in the settings below.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedSchedules.map((schedule) => (
                <Card key={schedule.schedule_id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="text-lg">
                        {schedule.schedule_enabled ? (
                          <span className="text-[var(--success)]">● Active</span>
                        ) : (
                          <span className="text-[var(--muted)]">○ Disabled</span>
                        )}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setScheduleInterval(schedule.schedule_interval);
                            setScheduleStartTime(schedule.schedule_start_time || '');
                            setScheduleTimezone(schedule.timezone || 'UTC');
                            setFilter(schedule.filter_scope || 'all');
                            setMinPrice(schedule.min_price ? schedule.min_price.toString() : '');
                            setMaxPrice(schedule.max_price ? schedule.max_price.toString() : '');
                            toast.info('Schedule loaded for editing');
                          }}
                          className="gap-1"
                        >
                          <Edit className="w-3 h-3" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteSchedule(schedule.schedule_id)}
                          className="gap-1 text-[var(--danger)] hover:text-[var(--danger)]"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-[var(--muted)]">Interval:</span>
                        <span className="ml-2 font-mono font-bold text-[var(--primary)]">
                          {schedule.schedule_interval}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--muted)]">Timezone:</span>
                        <span className="ml-2 font-mono">{schedule.timezone}</span>
                      </div>
                      {schedule.schedule_start_time && (
                        <div>
                          <span className="text-[var(--muted)]">Start Time:</span>
                          <span className="ml-2 font-mono">{schedule.schedule_start_time}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-[var(--muted)]">Scope:</span>
                        <span className="ml-2 capitalize">{schedule.filter_scope}</span>
                      </div>
                      {(schedule.min_price || schedule.max_price) && (
                        <div className="col-span-2">
                          <span className="text-[var(--muted)]">Price Range:</span>
                          <span className="ml-2 font-mono">
                            ${schedule.min_price || '0'} - ${schedule.max_price || '∞'}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {schedule.next_run_time && (
                      <div className="pt-2 mt-2 border-t border-[var(--accent)]/30">
                        <div className="text-xs text-[var(--muted)]">Next Run</div>
                        <div className="text-sm font-mono text-[var(--accent)]">
                          {new Date(schedule.next_run_time).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Configuration */}
        <section className="mt-8" id="configuration">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Settings className="w-6 h-6 text-[var(--primary)]" />
            Configuration
          </h2>
            </div>
          )}
        </section>
        
        {/* Bot Status Grid */}
        <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Activity className="w-6 h-6 text-[var(--primary)]" />
            Bot Status ({bots.length})
          </h2>
          <BotStatusGrid bots={bots} />
        </section>
        
        {/* Configuration Section */}
        <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Settings className="w-6 h-6 text-[var(--primary)]" />
            Configuration
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Schedule Config */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Scan Schedule
                </CardTitle>
                <CardDescription>Configure automatic scan intervals</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Scheduler</Label>
                  <Switch 
                    checked={scheduleEnabled}
                    onCheckedChange={setScheduleEnabled}
                  />
                </div>
                
                <div>
                  <Label>Interval</Label>
                  <Select 
                    value={scheduleInterval}
                    onValueChange={setScheduleInterval}
                    className="mt-1"
                  >
                    <SelectOption value="6h">Every 6 hours</SelectOption>
                    <SelectOption value="12h">Every 12 hours</SelectOption>
                    <SelectOption value="24h">Every 24 hours</SelectOption>
                  </Select>
                </div>
                
                <div>
                  <Label>Filter Scope</Label>
                  <Select 
                    value={filter}
                    onValueChange={setFilter}
                    className="mt-1"
                  >
                    <SelectOption value="all">All Coins</SelectOption>
                    <SelectOption value="alt">Alt Coins Only</SelectOption>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Min Price ($)</Label>
                    <Input 
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="No minimum"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Max Price ($)</Label>
                    <Input 
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="No maximum"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Start Time (Optional)</Label>
                  <Input 
                    type="time"
                    placeholder="HH:MM (24-hour)"
                    value={scheduleStartTime}
                    onChange={(e) => setScheduleStartTime(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-[var(--muted)] mt-1">Leave empty for immediate start</p>
                </div>
                
                <div>
                  <Label>Timezone</Label>
                  <Select 
                    value={scheduleTimezone}
                    onValueChange={setScheduleTimezone}
                    className="mt-1"
                  >
                    <SelectOption value="UTC">UTC</SelectOption>
                    <SelectOption value="America/New_York">Eastern Time (ET)</SelectOption>
                    <SelectOption value="America/Chicago">Central Time (CT)</SelectOption>
                    <SelectOption value="America/Denver">Mountain Time (MT)</SelectOption>
                    <SelectOption value="America/Los_Angeles">Pacific Time (PT)</SelectOption>
                    <SelectOption value="Europe/London">London (GMT)</SelectOption>
                    <SelectOption value="Europe/Paris">Central Europe (CET)</SelectOption>
                    <SelectOption value="Asia/Tokyo">Tokyo (JST)</SelectOption>
                    <SelectOption value="Asia/Shanghai">Shanghai (CST)</SelectOption>
                    <SelectOption value="Asia/Dubai">Dubai (GST)</SelectOption>
                  </Select>
                </div>
                
                {scheduleEnabled && nextRunTime && (
                  <div className="p-3 rounded-lg bg-[var(--panel)] border border-[var(--accent)]/30">
                    <div className="text-xs text-[var(--muted)] mb-1">Next Scheduled Run</div>
                    <div className="text-sm font-mono text-[var(--primary)]">
                      {new Date(nextRunTime).toLocaleString()}
                    </div>
                  </div>
                )}
                
                <Button onClick={saveSchedule} className="w-full gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Save Schedule
                </Button>
              </CardContent>
            </Card>
            
            {/* Email Integration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Email Notifications
                </CardTitle>
                <CardDescription>Get Top 5 recommendations via email</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Email</Label>
                  <Switch 
                    checked={emailEnabled}
                    onCheckedChange={setEmailEnabled}
                    data-testid="email-toggle"
                  />
                </div>
                
                {emailEnabled && (
                  <div>
                    <Label>Email Address</Label>
                    <Input 
                      type="email"
                      placeholder="your@email.com"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      className="mt-1"
                      data-testid="email-address-input"
                    />
                  </div>
                )}
                
                <Button onClick={saveIntegrations} className="w-full gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Save Email Settings
                </Button>
              </CardContent>
            </Card>
            
            {/* Google Sheets Integration */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  Google Sheets Logging
                </CardTitle>
                <CardDescription>Automatically log all recommendations to Google Sheets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Sheets Logging</Label>
                  <Switch 
                    checked={sheetsEnabled}
                    onCheckedChange={setSheetsEnabled}
                    data-testid="sheets-toggle"
                  />
                </div>
                
                {sheetsEnabled && (
                  <div>
                    <Label>Google Sheet URL</Label>
                    <Input 
                      type="url"
                      placeholder="https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit"
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      className="mt-1"
                      data-testid="sheet-id-input"
                    />
                    <p className="text-xs text-[var(--muted)] mt-1">
                      Paste your Google Sheets URL. Recommendations will be appended automatically.
                    </p>
                  </div>
                )}
                
                <Button onClick={saveIntegrations} className="gap-2" data-testid="integration-save-button">
                  <CheckCircle className="w-4 h-4" />
                  Save Sheets Settings
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
        
        {/* Footer */}
        <footer className="text-center text-sm text-[var(--muted)] py-8 border-t border-[var(--card-border)] mt-12">
          <p>
            Crypto Oracle - AI-Powered Price Predictions with 21 Diverse Bots
          </p>
          <p className="mt-1 text-xs">
            Not financial advice. Always DYOR (Do Your Own Research).
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;
