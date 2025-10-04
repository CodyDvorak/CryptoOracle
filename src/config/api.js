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
};

export const getHeaders = () => ({
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'apikey': SUPABASE_ANON_KEY,
});
