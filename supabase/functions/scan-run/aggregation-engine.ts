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
  private confidenceThreshold = 0.6;

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
    const trendBots = ['EMA', 'MACD', 'ADX', 'Parabolic SAR', 'Ichimoku'];
    const rangingBots = ['RSI', 'Stochastic', 'Bollinger', 'CCI', 'Williams'];
    const volatilityBots = ['ATR', 'Bollinger', 'Volume'];
    const derivativesBots = ['Funding Rate', 'Open Interest'];

    let baseWeight = 1.0;

    if (regime.type === 'trending') {
      if (trendBots.some(b => botName.includes(b))) {
        baseWeight = 1.3 + (regime.strength * 0.3);
      } else if (rangingBots.some(b => botName.includes(b))) {
        baseWeight = 0.7 - (regime.strength * 0.2);
      }
    } else if (regime.type === 'ranging') {
      if (rangingBots.some(b => botName.includes(b))) {
        baseWeight = 1.3 + (regime.strength * 0.3);
      } else if (trendBots.some(b => botName.includes(b))) {
        baseWeight = 0.7 - (regime.strength * 0.2);
      }
    } else if (regime.type === 'volatile') {
      if (volatilityBots.some(b => botName.includes(b))) {
        baseWeight = 1.4 + (regime.strength * 0.2);
      } else {
        baseWeight = 0.8;
      }
    }

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
      finalConfidence = Math.min(avgConfidence * 1.15, 1.0);
    } else if (consensusPercent >= 70) {
      finalConfidence = Math.min(avgConfidence * 1.08, 1.0);
    }

    const contrarian Bots = ['RSI', 'Stochastic', 'CCI', 'Williams', 'Bollinger'];
    const contrarianCount = dominantPreds.filter(p =>
      contrarianBots.some(b => p.botName.includes(b))
    ).length;

    if (contrarianCount >= 3 && consensusPercent >= 70) {
      finalConfidence = Math.min(finalConfidence * 1.12, 1.0);
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

  aggregate(predictions: BotPrediction[], ohlcv: any): AggregatedSignal | null {
    const regime = this.detectMarketRegime(ohlcv);
    return this.calculateConsensus(predictions, regime);
  }
}
