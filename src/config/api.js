import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const API_BASE_URL = `${SUPABASE_URL}/functions/v1`;

export const API_ENDPOINTS = {
  health: `${API_BASE_URL}/health`,
  scanRun: `${API_BASE_URL}/scan-run`,
  scanStatus: `${API_BASE_URL}/scan-status`,
  scanLatest: `${API_BASE_URL}/scan-latest`,
  scanHistory: `${API_BASE_URL}/scan-history`,
  botPerformance: `${API_BASE_URL}/bot-performance`,
  botPredictions: `${API_BASE_URL}/bot-predictions`,
  botLearning: `${API_BASE_URL}/bot-learning`,
  notifications: `${API_BASE_URL}/notifications`,
  scheduledScan: `${API_BASE_URL}/scheduled-scan`,
  backtesting: `${API_BASE_URL}/backtesting`,
  customAlerts: `${API_BASE_URL}/custom-alerts`,
  marketCorrelation: `${API_BASE_URL}/market-correlation`,
  parameterOptimizer: `${API_BASE_URL}/parameter-optimizer`,
  reinforcementLearning: `${API_BASE_URL}/reinforcement-learning`,
  dynamicBotManager: `${API_BASE_URL}/dynamic-bot-manager`,
};

export const getHeaders = async (requireAuth = false) => {
  let token = SUPABASE_ANON_KEY;

  if (requireAuth) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      token = session.access_token;
    }
  }

  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
  };
};
