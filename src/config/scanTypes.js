// Comprehensive Scan Type Configurations
export const SCAN_TYPES = [
  {
    id: 'quick_scan',
    name: 'Quick Scan',
    description: 'Fast analysis of top 100 coins by market cap. Perfect for getting a rapid market overview with high-confidence signals only.',
    scope: 'top50',
    coinLimit: 100,
    confidenceThreshold: 0.7,
    useDeepAI: false,
    estimatedDuration: '45-60 seconds',
    icon: '⚡',
    color: '#3b82f6'
  },
  {
    id: 'deep_analysis',
    name: 'Deep Analysis',
    description: 'Comprehensive AI-powered analysis of top 50 coins using OpenAI GPT-4 for advanced pattern recognition, sentiment analysis, and market regime insights.',
    scope: 'top50',
    coinLimit: 50,
    confidenceThreshold: 0.6,
    useDeepAI: true,
    estimatedDuration: '2-3 minutes',
    icon: '🧠',
    color: '#8b5cf6'
  },
  {
    id: 'top200_scan',
    name: 'Top 200 Scan',
    description: 'Extensive market scan covering top 200 cryptocurrencies. Ideal for discovering opportunities in mid-cap altcoins with strong fundamentals.',
    scope: 'top200',
    coinLimit: 200,
    confidenceThreshold: 0.65,
    useDeepAI: false,
    estimatedDuration: '2-3 minutes',
    icon: '🎯',
    color: '#10b981'
  },
  {
    id: 'top500_scan',
    name: 'Top 500 Scan',
    description: 'Complete market coverage of top 500 coins. Best for comprehensive market analysis and finding hidden gems in small-cap projects.',
    scope: 'top500',
    coinLimit: 500,
    confidenceThreshold: 0.65,
    useDeepAI: false,
    estimatedDuration: '4-5 minutes',
    icon: '🌐',
    color: '#f59e0b'
  },
  {
    id: 'high_conviction',
    name: 'High Conviction',
    description: 'Ultra-selective scan focusing on signals with 80%+ bot consensus. Only the strongest, highest-confidence trading opportunities.',
    scope: 'top200',
    coinLimit: 200,
    confidenceThreshold: 0.8,
    useDeepAI: false,
    estimatedDuration: '2-3 minutes',
    icon: '💎',
    color: '#ef4444'
  },
  {
    id: 'trending_coins',
    name: 'Trending Markets',
    description: 'Specialized scan targeting coins in strong trending markets (ADX > 30). Optimized for momentum and trend-following strategies.',
    scope: 'top200',
    coinLimit: 200,
    confidenceThreshold: 0.65,
    useDeepAI: false,
    regimeFilter: 'trending',
    estimatedDuration: '2-3 minutes',
    icon: '📈',
    color: '#06b6d4'
  },
  {
    id: 'reversal_opportunities',
    name: 'Reversal Opportunities',
    description: 'Focuses on oversold/overbought conditions and mean-reversion setups. Perfect for contrarian traders seeking reversal plays.',
    scope: 'top200',
    coinLimit: 200,
    confidenceThreshold: 0.65,
    useDeepAI: false,
    regimeFilter: 'ranging',
    estimatedDuration: '2-3 minutes',
    icon: '🔄',
    color: '#ec4899'
  },
  {
    id: 'volatile_markets',
    name: 'Volatile Markets',
    description: 'Targets high-volatility coins (ATR > 4%). Ideal for experienced traders comfortable with larger price swings and risk.',
    scope: 'top200',
    coinLimit: 200,
    confidenceThreshold: 0.7,
    useDeepAI: false,
    regimeFilter: 'volatile',
    estimatedDuration: '2-3 minutes',
    icon: '🌊',
    color: '#f97316'
  },
  {
    id: 'whale_activity',
    name: 'Whale Activity',
    description: 'Detects large volume spikes and institutional movements. Tracks smart money and whale accumulation/distribution patterns.',
    scope: 'top200',
    coinLimit: 200,
    confidenceThreshold: 0.65,
    useDeepAI: false,
    botFilter: ['Whale Activity Tracker', 'Order Flow Analysis', 'Volume Spike', 'OBV On-Balance Volume'],
    estimatedDuration: '2-3 minutes',
    icon: '🐋',
    color: '#14b8a6'
  },
  {
    id: 'futures_signals',
    name: 'Futures Signals',
    description: 'Analyzes derivatives market data including funding rates, open interest, and long/short ratios for futures trading insights.',
    scope: 'top200',
    coinLimit: 200,
    confidenceThreshold: 0.65,
    useDeepAI: false,
    botFilter: ['Funding Rate Arbitrage', 'Open Interest Momentum', 'Long/Short Ratio Tracker', 'Options Flow Detector'],
    estimatedDuration: '2-3 minutes',
    icon: '📊',
    color: '#a855f7'
  },
  {
    id: 'breakout_hunter',
    name: 'Breakout Hunter',
    description: 'Identifies coins breaking through key resistance/support levels with strong volume confirmation. Captures explosive moves early.',
    scope: 'top200',
    coinLimit: 200,
    confidenceThreshold: 0.7,
    useDeepAI: false,
    botFilter: ['Breakout Hunter', 'Volume Breakout', 'Support/Resistance', 'Momentum Trader'],
    estimatedDuration: '2-3 minutes',
    icon: '🚀',
    color: '#eab308'
  },
  {
    id: 'ai_powered_scan',
    name: 'AI-Powered Full Scan',
    description: 'Ultimate scan combining all 59 bots with deep AI analysis via GPT-4. Provides comprehensive insights, pattern recognition, and sentiment analysis for top 100 coins.',
    scope: 'top50',
    coinLimit: 100,
    confidenceThreshold: 0.6,
    useDeepAI: true,
    estimatedDuration: '3-4 minutes',
    icon: '🤖',
    color: '#6366f1'
  },
  {
    id: 'low_cap_gems',
    name: 'Low Cap Gems',
    description: 'Targets coins ranked 201-500 with strong technical signals. Focuses on discovering undervalued small-cap opportunities with high growth potential.',
    scope: 'top500',
    coinLimit: 300,
    minRank: 201,
    confidenceThreshold: 0.7,
    useDeepAI: false,
    estimatedDuration: '3-4 minutes',
    icon: '💰',
    color: '#84cc16'
  },
  {
    id: 'elliott_wave_scan',
    name: 'Elliott Wave Scan',
    description: 'Specialized scan using Elliott Wave theory and Fibonacci analysis. Identifies wave completions and high-probability reversal zones.',
    scope: 'top200',
    coinLimit: 200,
    confidenceThreshold: 0.65,
    useDeepAI: false,
    botFilter: ['Elliott Wave Pattern', 'Fibonacci Retracement', 'Harmonic Patterns'],
    estimatedDuration: '2-3 minutes',
    icon: '〰️',
    color: '#06b6d4'
  },
  {
    id: 'custom_scan',
    name: 'Custom Scan',
    description: 'Fully customizable scan with user-defined parameters including coin selection, confidence thresholds, and specific bot combinations.',
    scope: 'custom',
    coinLimit: 'user_defined',
    confidenceThreshold: 0.6,
    useDeepAI: false,
    estimatedDuration: 'Varies',
    icon: '⚙️',
    color: '#64748b'
  }
];

export const getScanTypeById = (id) => {
  return SCAN_TYPES.find(scan => scan.id === id) || SCAN_TYPES[0];
};

export const getScanTypeConfig = (scanType) => {
  const config = getScanTypeById(scanType);

  return {
    scope: config.scope || 'top50',
    coinLimit: config.coinLimit || 100,
    confidenceThreshold: config.confidenceThreshold || 0.65,
    useDeepAI: config.useDeepAI || false,
    regimeFilter: config.regimeFilter || null,
    botFilter: config.botFilter || null,
    minRank: config.minRank || null,
  };
};
