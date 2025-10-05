interface BotPrediction {
  botName: string;
  direction: 'LONG' | 'SHORT';
  confidence: number;
  entry: number;
  takeProfit: number;
  stopLoss: number;
  leverage?: number;
}

interface MarketRegime {
  type: 'trending' | 'ranging' | 'volatile';
  strength: number;
}

interface AggregatedSignal {
  direction: 'LONG' | 'SHORT';
  confidence: number;
  consensusPercent: number;
  botCount: number;
  longBots: number;
  shortBots: number;
  avgEntry: number;
  avgTakeProfit: number;
  avgStopLoss: number;
  weightedConfidence: number;
}

export class HybridAggregationEngine {
  private confidenceThreshold = 0.6; // 6/10 minimum confidence threshold
  private botPerformanceHistory: Map<string, { correct: number; total: number }> = new Map();
  private supabase: any;
  private optimizedParameters: Map<string, any> = new Map();
  private botStatusCache: Map<string, boolean> = new Map();

  constructor(supabaseClient?: any) {
    this.supabase = supabaseClient;
  }

  async loadOptimizedParameters(regime: string) {
    if (!this.supabase) return;

    try {
      const { data } = await this.supabase
        .from('bot_parameters')
        .select('*')
        .eq('market_regime', regime)
        .eq('is_active', true);

      if (data) {
        data.forEach((param: any) => {
          this.optimizedParameters.set(`${param.bot_name}_${regime}`, param.parameters);
        });
      }
    } catch (err) {
      console.error('Failed to load optimized parameters:', err);
    }
  }

  async loadBotStatuses() {
    if (!this.supabase) return;

    try {
      const { data } = await this.supabase
        .from('bot_status_management')
        .select('bot_name, is_enabled')
        .eq('is_enabled', true);

      if (data) {
        data.forEach((status: any) => {
          this.botStatusCache.set(status.bot_name, status.is_enabled);
        });
      }
    } catch (err) {
      console.error('Failed to load bot statuses:', err);
    }
  }

  isBotEnabled(botName: string): boolean {
    // If no status in cache, assume enabled (backwards compatible)
    return this.botStatusCache.get(botName) !== false;
  }

  getOptimizedParameters(botName: string, regime: string): any {
    return this.optimizedParameters.get(`${botName}_${regime}`) || {};
  }

  detectMarketRegime(ohlcv: any): MarketRegime {
    const adx = ohlcv.indicators.adx || 20;
    const atr = ohlcv.indicators.atr || 0;
    const atrPercent = (atr / ohlcv.candles[ohlcv.candles.length - 1].close) * 100;

    if (adx > 30) {
      return {
        type: 'trending',
        strength: Math.min(adx / 50, 1.0)
      };
    } else if (atrPercent > 4) {
      return {
        type: 'volatile',
        strength: Math.min(atrPercent / 8, 1.0)
      };
    } else {
      return {
        type: 'ranging',
        strength: Math.min((30 - adx) / 30, 1.0)
      };
    }
  }

  getBotWeight(botName: string, regime: MarketRegime): number {
    // Trend-following bots (26 total) - perform best in trending markets
    const trendBots = [
      'EMA', 'SMA', 'MACD', 'ADX', 'Parabolic SAR', 'Ichimoku', 'SuperTrend',
      'Trend Strength', 'Linear Regression', 'Triple MA', 'Vortex', 'Aroon',
      'Heikin-Ashi', 'Trend Following', '4H Trend', 'Multi-Timeframe'
    ];

    // Mean-reversion/ranging bots (18 total) - perform best in ranging markets
    const rangingBots = [
      'RSI', 'Stochastic', 'Bollinger', 'CCI', 'Williams', 'Mean Reversion',
      'Support/Resistance', 'Pivot Points', 'Envelope', 'Z-Score'
    ];

    // Volatility bots (12 total) - perform best in volatile markets
    const volatilityBots = [
      'ATR', 'Bollinger', 'Volume', 'Keltner', 'Donchian', 'Volatility Breakout',
      'Consolidation'
    ];

    // Derivatives/futures bots (5 total) - consistent across regimes
    const derivativesBots = ['Funding Rate', 'Open Interest', 'Options Flow', 'Long/Short'];

    // Contrarian/reversal bots (5 total) - boost in ranging markets
    const contrarianBots = [
      'RSI Reversal', 'Bollinger Reversal', 'Stochastic Reversal',
      'Volume Spike Fade', 'Mean Reversion'
    ];

    let baseWeight = 1.0;

    // TRENDING MARKET: Boost trend bots, reduce mean-reversion bots
    if (regime.type === 'trending') {
      if (trendBots.some(b => botName.includes(b))) {
        baseWeight = 1.5 + (regime.strength * 0.2); // 1.5x-1.7x multiplier
      } else if (rangingBots.some(b => botName.includes(b))) {
        baseWeight = 0.6 - (regime.strength * 0.1); // 0.5x-0.6x multiplier
      } else if (contrarianBots.some(b => botName.includes(b))) {
        baseWeight = 0.5; // Contrarians weak in trends
      }
    }
    // RANGING MARKET: Boost mean-reversion bots, reduce trend bots
    else if (regime.type === 'ranging') {
      if (rangingBots.some(b => botName.includes(b))) {
        baseWeight = 1.5 + (regime.strength * 0.2); // 1.5x-1.7x multiplier
      } else if (trendBots.some(b => botName.includes(b))) {
        baseWeight = 0.6 - (regime.strength * 0.1); // 0.5x-0.6x multiplier
      } else if (contrarianBots.some(b => botName.includes(b))) {
        baseWeight = 1.3; // Contrarians strong in ranges
      }
    }
    // VOLATILE MARKET: Boost volatility bots
    else if (regime.type === 'volatile') {
      if (volatilityBots.some(b => botName.includes(b))) {
        baseWeight = 1.6 + (regime.strength * 0.2); // 1.6x-1.8x multiplier
      } else if (contrarianBots.some(b => botName.includes(b))) {
        baseWeight = 1.2; // Contrarians good in volatility
      } else {
        baseWeight = 0.8;
      }
    }

    // Derivatives bots get consistent boost across all regimes
    if (derivativesBots.some(b => botName.includes(b))) {
      baseWeight *= 1.2;
    }

    return baseWeight;
  }

  filterByConfidence(predictions: BotPrediction[]): BotPrediction[] {
    return predictions.filter(pred => pred.confidence >= this.confidenceThreshold);
  }

  calculateConsensus(predictions: BotPrediction[], regime: MarketRegime): AggregatedSignal | null {
    if (predictions.length === 0) return null;

    const highConfPredictions = this.filterByConfidence(predictions);

    if (highConfPredictions.length === 0) return null;

    const longPreds = highConfPredictions.filter(p => p.direction === 'LONG');
    const shortPreds = highConfPredictions.filter(p => p.direction === 'SHORT');

    let weightedLongScore = 0;
    let weightedShortScore = 0;
    let totalWeight = 0;

    for (const pred of highConfPredictions) {
      const weight = this.getBotWeight(pred.botName, regime);
      const weightedConf = pred.confidence * weight;
      totalWeight += weight;

      if (pred.direction === 'LONG') {
        weightedLongScore += weightedConf;
      } else {
        weightedShortScore += weightedConf;
      }
    }

    const direction = weightedLongScore > weightedShortScore ? 'LONG' : 'SHORT';
    const dominantPreds = direction === 'LONG' ? longPreds : shortPreds;

    if (dominantPreds.length === 0) return null;

    const consensusPercent = (dominantPreds.length / highConfPredictions.length) * 100;

    const avgConfidence = dominantPreds.reduce((sum, p) => sum + p.confidence, 0) / dominantPreds.length;
    const weightedConfidence = direction === 'LONG'
      ? weightedLongScore / totalWeight
      : weightedShortScore / totalWeight;

    let finalConfidence = avgConfidence;

    if (consensusPercent >= 80) {
      finalConfidence = Math.min(avgConfidence * 1.12, 0.95);
    } else if (consensusPercent >= 70) {
      finalConfidence = Math.min(avgConfidence * 1.06, 0.92);
    }

    // CONTRARIAN AGREEMENT AMPLIFICATION
    // When multiple contrarian bots align, it signals major reversals
    const contrarianBots = [
      'RSI Reversal', 'Mean Reversion', 'Bollinger Reversal',
      'Stochastic Reversal', 'Volume Spike Fade'
    ];
    const contrarianCount = dominantPreds.filter(p =>
      contrarianBots.some(b => p.botName.includes(b))
    ).length;

    // If 3+ contrarians agree with 70%+ consensus, boost confidence significantly
    if (contrarianCount >= 3 && consensusPercent >= 70) {
      finalConfidence = Math.min(finalConfidence * 1.08, 0.95); // 8% boost for contrarian alignment
    } else if (contrarianCount >= 2 && consensusPercent >= 75) {
      finalConfidence = Math.min(finalConfidence * 1.05, 0.93); // 5% boost for moderate contrarian agreement
    }

    const advancedBots = ['Elliott Wave', 'Order Flow', 'Whale', 'Social Sentiment', 'Options Flow'];
    const advancedCount = dominantPreds.filter(p =>
      advancedBots.some(b => p.botName.includes(b))
    ).length;

    if (advancedCount >= 2 && consensusPercent >= 75) {
      finalConfidence = Math.min(finalConfidence * 1.05, 0.94);
    }

    const avgEntry = dominantPreds.reduce((sum, p) => sum + p.entry, 0) / dominantPreds.length;
    const avgTakeProfit = dominantPreds.reduce((sum, p) => sum + p.takeProfit, 0) / dominantPreds.length;
    const avgStopLoss = dominantPreds.reduce((sum, p) => sum + p.stopLoss, 0) / dominantPreds.length;

    return {
      direction,
      confidence: finalConfidence,
      consensusPercent,
      botCount: predictions.length,
      longBots: longPreds.length,
      shortBots: shortPreds.length,
      avgEntry,
      avgTakeProfit,
      avgStopLoss,
      weightedConfidence
    };
  }

  updateBotPerformance(botName: string, wasCorrect: boolean) {
    const current = this.botPerformanceHistory.get(botName) || { correct: 0, total: 0 };
    current.total += 1;
    if (wasCorrect) current.correct += 1;
    this.botPerformanceHistory.set(botName, current);
  }

  getBotAccuracy(botName: string): number {
    const perf = this.botPerformanceHistory.get(botName);
    if (!perf || perf.total < 10) return 0.7;
    return perf.correct / perf.total;
  }

  applyAdaptiveWeighting(predictions: BotPrediction[], regime: MarketRegime): BotPrediction[] {
    return predictions.map(pred => {
      const baseWeight = this.getBotWeight(pred.botName, regime);
      const accuracy = this.getBotAccuracy(pred.botName);
      const adaptiveMultiplier = 0.5 + accuracy;
      const finalConfidence = pred.confidence * baseWeight * adaptiveMultiplier;
      return {
        ...pred,
        confidence: Math.min(finalConfidence, 1.0),
      };
    });
  }

  autoTuneThreshold(recentAccuracy: number) {
    if (recentAccuracy < 0.5) {
      this.confidenceThreshold = Math.min(this.confidenceThreshold + 0.05, 0.8);
    } else if (recentAccuracy > 0.7) {
      this.confidenceThreshold = Math.max(this.confidenceThreshold - 0.02, 0.5);
    }
  }

  async aggregate(predictions: BotPrediction[], ohlcv: any): Promise<AggregatedSignal | null> {
    const regime = this.detectMarketRegime(ohlcv);

    // Load optimized parameters and bot statuses
    await this.loadOptimizedParameters(regime.type.toUpperCase());
    await this.loadBotStatuses();

    // Filter out disabled bots
    const enabledPredictions = predictions.filter(pred => this.isBotEnabled(pred.botName));

    if (enabledPredictions.length === 0) {
      console.log('No enabled bots available for predictions');
      return null;
    }

    console.log(`Using ${enabledPredictions.length} enabled bots (filtered from ${predictions.length})`);

    const adaptivePredictions = this.applyAdaptiveWeighting(enabledPredictions, regime);
    return this.calculateConsensus(adaptivePredictions, regime);
  }
}
