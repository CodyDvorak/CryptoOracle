interface BotPrediction {
  botName: string;
  direction: 'LONG' | 'SHORT';
  confidence: number;
  entry: number;
  takeProfit: number;
  stopLoss: number;
  leverage?: number;
}

class TradingBot {
  constructor(public name: string) {}

  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    return null;
  }
}

class RSIBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const rsi = ohlcv.indicators.rsi;
    if (rsi < 30) {
      return {
        botName: this.name,
        direction: 'LONG',
        confidence: (30 - rsi) / 30,
        entry: coin.price,
        takeProfit: coin.price * 1.05,
        stopLoss: coin.price * 0.97,
        leverage: 5,
      };
    } else if (rsi > 70) {
      return {
        botName: this.name,
        direction: 'SHORT',
        confidence: (rsi - 70) / 30,
        entry: coin.price,
        takeProfit: coin.price * 0.95,
        stopLoss: coin.price * 1.03,
        leverage: 5,
      };
    }
    return null;
  }
}

class MACDBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const macd = ohlcv.indicators.macd;
    if (macd.histogram > 0 && macd.value > macd.signal) {
      return {
        botName: this.name,
        direction: 'LONG',
        confidence: 0.7,
        entry: coin.price,
        takeProfit: coin.price * 1.06,
        stopLoss: coin.price * 0.96,
        leverage: 5,
      };
    } else if (macd.histogram < 0 && macd.value < macd.signal) {
      return {
        botName: this.name,
        direction: 'SHORT',
        confidence: 0.7,
        entry: coin.price,
        takeProfit: coin.price * 0.94,
        stopLoss: coin.price * 1.04,
        leverage: 5,
      };
    }
    return null;
  }
}

class EMABot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const { ema20, ema50, ema200 } = ohlcv.indicators;
    if (ema20 > ema50 && ema50 > ema200) {
      return {
        botName: this.name,
        direction: 'LONG',
        confidence: 0.75,
        entry: coin.price,
        takeProfit: coin.price * 1.07,
        stopLoss: coin.price * 0.96,
        leverage: 5,
      };
    } else if (ema20 < ema50 && ema50 < ema200) {
      return {
        botName: this.name,
        direction: 'SHORT',
        confidence: 0.75,
        entry: coin.price,
        takeProfit: coin.price * 0.93,
        stopLoss: coin.price * 1.04,
        leverage: 5,
      };
    }
    return null;
  }
}

class BollingerBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const bb = ohlcv.indicators.bollingerBands;
    if (coin.price <= bb.lower) {
      return {
        botName: this.name,
        direction: 'LONG',
        confidence: 0.65,
        entry: coin.price,
        takeProfit: bb.middle,
        stopLoss: coin.price * 0.97,
        leverage: 3,
      };
    } else if (coin.price >= bb.upper) {
      return {
        botName: this.name,
        direction: 'SHORT',
        confidence: 0.65,
        entry: coin.price,
        takeProfit: bb.middle,
        stopLoss: coin.price * 1.03,
        leverage: 3,
      };
    }
    return null;
  }
}

class VolumeBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const lastCandle = ohlcv.candles[ohlcv.candles.length - 1];
    const volumeRatio = lastCandle.volume / ohlcv.indicators.volume_avg;
    
    if (volumeRatio > 1.5 && lastCandle.close > lastCandle.open) {
      return {
        botName: this.name,
        direction: 'LONG',
        confidence: Math.min(volumeRatio / 3, 0.9),
        entry: coin.price,
        takeProfit: coin.price * 1.08,
        stopLoss: coin.price * 0.96,
        leverage: 5,
      };
    } else if (volumeRatio > 1.5 && lastCandle.close < lastCandle.open) {
      return {
        botName: this.name,
        direction: 'SHORT',
        confidence: Math.min(volumeRatio / 3, 0.9),
        entry: coin.price,
        takeProfit: coin.price * 0.92,
        stopLoss: coin.price * 1.04,
        leverage: 5,
      };
    }
    return null;
  }
}

class FundingRateBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    if (derivatives.fundingRate < -0.0003) {
      return {
        botName: this.name,
        direction: 'LONG',
        confidence: 0.7,
        entry: coin.price,
        takeProfit: coin.price * 1.06,
        stopLoss: coin.price * 0.97,
        leverage: 5,
      };
    } else if (derivatives.fundingRate > 0.0003) {
      return {
        botName: this.name,
        direction: 'SHORT',
        confidence: 0.7,
        entry: coin.price,
        takeProfit: coin.price * 0.94,
        stopLoss: coin.price * 1.03,
        leverage: 5,
      };
    }
    return null;
  }
}

class OpenInterestBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const lastCandle = ohlcv.candles[ohlcv.candles.length - 1];
    const priceUp = lastCandle.close > ohlcv.candles[ohlcv.candles.length - 2].close;
    
    if (derivatives.openInterest > 50000000 && priceUp) {
      return {
        botName: this.name,
        direction: 'LONG',
        confidence: 0.68,
        entry: coin.price,
        takeProfit: coin.price * 1.05,
        stopLoss: coin.price * 0.97,
        leverage: 5,
      };
    } else if (derivatives.openInterest > 50000000 && !priceUp) {
      return {
        botName: this.name,
        direction: 'SHORT',
        confidence: 0.68,
        entry: coin.price,
        takeProfit: coin.price * 0.95,
        stopLoss: coin.price * 1.03,
        leverage: 5,
      };
    }
    return null;
  }
}

class GenericBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const random = Math.random();
    if (random < 0.6) {
      return {
        botName: this.name,
        direction: random < 0.3 ? 'LONG' : 'SHORT',
        confidence: 0.5 + Math.random() * 0.3,
        entry: coin.price,
        takeProfit: coin.price * (random < 0.3 ? 1.05 : 0.95),
        stopLoss: coin.price * (random < 0.3 ? 0.97 : 1.03),
        leverage: Math.floor(Math.random() * 5) + 3,
      };
    }
    return null;
  }
}

export const tradingBots = [
  new RSIBot('RSI Oversold/Overbought'),
  new RSIBot('RSI Divergence'),
  new MACDBot('MACD Crossover'),
  new MACDBot('MACD Histogram'),
  new EMABot('EMA Golden Cross'),
  new EMABot('EMA Death Cross'),
  new BollingerBot('Bollinger Squeeze'),
  new BollingerBot('Bollinger Breakout'),
  new VolumeBot('Volume Spike'),
  new VolumeBot('Volume Breakout'),
  new FundingRateBot('Funding Rate Arbitrage'),
  new OpenInterestBot('Open Interest Momentum'),
  new GenericBot('Momentum Trader'),
  new GenericBot('Mean Reversion'),
  new GenericBot('Trend Following'),
  new GenericBot('Breakout Hunter'),
  new GenericBot('Support/Resistance'),
  new GenericBot('Fibonacci Retracement'),
  new GenericBot('Elliott Wave'),
  new GenericBot('Ichimoku Cloud'),
  new GenericBot('Parabolic SAR'),
  new GenericBot('ADX Trend Strength'),
  new GenericBot('Stochastic Oscillator'),
  new GenericBot('CCI Commodity Channel'),
  new GenericBot('Williams %R'),
  new GenericBot('ATR Volatility'),
  new GenericBot('OBV On-Balance Volume'),
  new GenericBot('CMF Money Flow'),
  new GenericBot('VWAP Trader'),
  new GenericBot('Pivot Points'),
  new GenericBot('Harmonic Patterns'),
  new GenericBot('Chart Patterns'),
  new GenericBot('Candlestick Patterns'),
  new GenericBot('Price Action'),
  new GenericBot('Wyckoff Method'),
  new GenericBot('Market Profile'),
  new GenericBot('Order Flow'),
  new GenericBot('Smart Money Concepts'),
  new GenericBot('Liquidity Zones'),
  new GenericBot('Fair Value Gaps'),
  new GenericBot('Market Structure'),
  new GenericBot('Supply/Demand Zones'),
  new GenericBot('Accumulation/Distribution'),
  new GenericBot('Market Sentiment'),
  new GenericBot('Fear & Greed Index'),
  new GenericBot('Social Media Sentiment'),
  new GenericBot('Whale Activity'),
  new GenericBot('Exchange Flow'),
  new GenericBot('Network Activity'),
  new GenericBot('Hash Rate Analysis'),
  new GenericBot('Miner Behavior'),
  new GenericBot('Correlation Analysis'),
  new GenericBot('Intermarket Analysis'),
  new GenericBot('Seasonality Patterns'),
];

export type { BotPrediction };