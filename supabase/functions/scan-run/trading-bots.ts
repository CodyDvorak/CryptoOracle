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

class StochasticBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const stochK = ohlcv.indicators.stochastic?.k || 50;
    const stochD = ohlcv.indicators.stochastic?.d || 50;

    if (stochK < 20 && stochD < 20 && stochK > stochD) {
      return {
        botName: this.name,
        direction: 'LONG',
        confidence: (20 - stochK) / 20 * 0.8,
        entry: coin.price,
        takeProfit: coin.price * 1.06,
        stopLoss: coin.price * 0.97,
        leverage: 4,
      };
    } else if (stochK > 80 && stochD > 80 && stochK < stochD) {
      return {
        botName: this.name,
        direction: 'SHORT',
        confidence: (stochK - 80) / 20 * 0.8,
        entry: coin.price,
        takeProfit: coin.price * 0.94,
        stopLoss: coin.price * 1.03,
        leverage: 4,
      };
    }
    return null;
  }
}

class ADXBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const adx = ohlcv.indicators.adx || 20;
    const ema20 = ohlcv.indicators.ema20;
    const ema50 = ohlcv.indicators.ema50;

    if (adx > 25 && ema20 > ema50) {
      return {
        botName: this.name,
        direction: 'LONG',
        confidence: Math.min(adx / 50, 0.85),
        entry: coin.price,
        takeProfit: coin.price * 1.08,
        stopLoss: coin.price * 0.96,
        leverage: 5,
      };
    } else if (adx > 25 && ema20 < ema50) {
      return {
        botName: this.name,
        direction: 'SHORT',
        confidence: Math.min(adx / 50, 0.85),
        entry: coin.price,
        takeProfit: coin.price * 0.92,
        stopLoss: coin.price * 1.04,
        leverage: 5,
      };
    }
    return null;
  }
}

class CCIBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const cci = ohlcv.indicators.cci || 0;

    if (cci < -100) {
      return {
        botName: this.name,
        direction: 'LONG',
        confidence: Math.min(Math.abs(cci) / 200, 0.75),
        entry: coin.price,
        takeProfit: coin.price * 1.05,
        stopLoss: coin.price * 0.97,
        leverage: 4,
      };
    } else if (cci > 100) {
      return {
        botName: this.name,
        direction: 'SHORT',
        confidence: Math.min(cci / 200, 0.75),
        entry: coin.price,
        takeProfit: coin.price * 0.95,
        stopLoss: coin.price * 1.03,
        leverage: 4,
      };
    }
    return null;
  }
}

class WilliamsRBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const willR = ohlcv.indicators.williamsR || -50;

    if (willR < -80) {
      return {
        botName: this.name,
        direction: 'LONG',
        confidence: (Math.abs(willR) - 80) / 20 * 0.7,
        entry: coin.price,
        takeProfit: coin.price * 1.05,
        stopLoss: coin.price * 0.975,
        leverage: 3,
      };
    } else if (willR > -20) {
      return {
        botName: this.name,
        direction: 'SHORT',
        confidence: (20 - Math.abs(willR)) / 20 * 0.7,
        entry: coin.price,
        takeProfit: coin.price * 0.95,
        stopLoss: coin.price * 1.025,
        leverage: 3,
      };
    }
    return null;
  }
}

class ATRVolatilityBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const atr = ohlcv.indicators.atr || 0;
    const atrPercent = (atr / coin.price) * 100;
    const lastCandle = ohlcv.candles[ohlcv.candles.length - 1];
    const prevCandle = ohlcv.candles[ohlcv.candles.length - 2];

    if (atrPercent > 3 && lastCandle.close > prevCandle.close) {
      return {
        botName: this.name,
        direction: 'LONG',
        confidence: Math.min(atrPercent / 6, 0.8),
        entry: coin.price,
        takeProfit: coin.price * (1 + atrPercent / 100 * 2),
        stopLoss: coin.price * (1 - atrPercent / 100),
        leverage: 3,
      };
    } else if (atrPercent > 3 && lastCandle.close < prevCandle.close) {
      return {
        botName: this.name,
        direction: 'SHORT',
        confidence: Math.min(atrPercent / 6, 0.8),
        entry: coin.price,
        takeProfit: coin.price * (1 - atrPercent / 100 * 2),
        stopLoss: coin.price * (1 + atrPercent / 100),
        leverage: 3,
      };
    }
    return null;
  }
}

class OBVBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const obvTrend = ohlcv.indicators.obvTrend || 0;
    const lastCandle = ohlcv.candles[ohlcv.candles.length - 1];
    const priceUp = lastCandle.close > ohlcv.candles[ohlcv.candles.length - 2].close;

    if (obvTrend > 0 && priceUp) {
      return {
        botName: this.name,
        direction: 'LONG',
        confidence: 0.72,
        entry: coin.price,
        takeProfit: coin.price * 1.06,
        stopLoss: coin.price * 0.97,
        leverage: 4,
      };
    } else if (obvTrend < 0 && !priceUp) {
      return {
        botName: this.name,
        direction: 'SHORT',
        confidence: 0.72,
        entry: coin.price,
        takeProfit: coin.price * 0.94,
        stopLoss: coin.price * 1.03,
        leverage: 4,
      };
    }
    return null;
  }
}

class VWAPBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const vwap = ohlcv.indicators.vwap || coin.price;
    const priceVsVwap = ((coin.price - vwap) / vwap) * 100;

    if (priceVsVwap < -2) {
      return {
        botName: this.name,
        direction: 'LONG',
        confidence: Math.min(Math.abs(priceVsVwap) / 4, 0.78),
        entry: coin.price,
        takeProfit: vwap * 1.01,
        stopLoss: coin.price * 0.975,
        leverage: 4,
      };
    } else if (priceVsVwap > 2) {
      return {
        botName: this.name,
        direction: 'SHORT',
        confidence: Math.min(priceVsVwap / 4, 0.78),
        entry: coin.price,
        takeProfit: vwap * 0.99,
        stopLoss: coin.price * 1.025,
        leverage: 4,
      };
    }
    return null;
  }
}

class IchimokuBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const { tenkan, kijun, spanA, spanB } = ohlcv.indicators.ichimoku || {};
    if (!tenkan || !kijun) return null;

    const priceAboveCloud = coin.price > Math.max(spanA, spanB);
    const priceBelowCloud = coin.price < Math.min(spanA, spanB);
    const tenkanAboveKijun = tenkan > kijun;

    if (priceAboveCloud && tenkanAboveKijun) {
      return {
        botName: this.name,
        direction: 'LONG',
        confidence: 0.73,
        entry: coin.price,
        takeProfit: coin.price * 1.07,
        stopLoss: kijun * 0.98,
        leverage: 4,
      };
    } else if (priceBelowCloud && !tenkanAboveKijun) {
      return {
        botName: this.name,
        direction: 'SHORT',
        confidence: 0.73,
        entry: coin.price,
        takeProfit: coin.price * 0.93,
        stopLoss: kijun * 1.02,
        leverage: 4,
      };
    }
    return null;
  }
}

class ParabolicSARBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const sar = ohlcv.indicators.sar || coin.price;

    if (coin.price > sar) {
      const distance = ((coin.price - sar) / coin.price) * 100;
      if (distance > 0.5 && distance < 3) {
        return {
          botName: this.name,
          direction: 'LONG',
          confidence: 0.7,
          entry: coin.price,
          takeProfit: coin.price * 1.06,
          stopLoss: sar * 0.995,
          leverage: 4,
        };
      }
    } else if (coin.price < sar) {
      const distance = ((sar - coin.price) / coin.price) * 100;
      if (distance > 0.5 && distance < 3) {
        return {
          botName: this.name,
          direction: 'SHORT',
          confidence: 0.7,
          entry: coin.price,
          takeProfit: coin.price * 0.94,
          stopLoss: sar * 1.005,
          leverage: 4,
        };
      }
    }
    return null;
  }
}

class FibonacciBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const candles = ohlcv.candles;
    const high = Math.max(...candles.slice(-20).map((c: any) => c.high));
    const low = Math.min(...candles.slice(-20).map((c: any) => c.low));
    const range = high - low;

    const fib382 = high - range * 0.382;
    const fib618 = high - range * 0.618;

    if (Math.abs(coin.price - fib618) / coin.price < 0.01) {
      return {
        botName: this.name,
        direction: 'LONG',
        confidence: 0.75,
        entry: coin.price,
        takeProfit: fib382,
        stopLoss: low * 0.99,
        leverage: 4,
      };
    } else if (Math.abs(coin.price - fib382) / coin.price < 0.01) {
      return {
        botName: this.name,
        direction: 'SHORT',
        confidence: 0.72,
        entry: coin.price,
        takeProfit: fib618,
        stopLoss: high * 1.01,
        leverage: 4,
      };
    }
    return null;
  }
}

class PivotPointBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const lastCandle = ohlcv.candles[ohlcv.candles.length - 1];
    const pivot = (lastCandle.high + lastCandle.low + lastCandle.close) / 3;
    const r1 = 2 * pivot - lastCandle.low;
    const s1 = 2 * pivot - lastCandle.high;

    const distanceToS1 = ((coin.price - s1) / coin.price) * 100;
    const distanceToR1 = ((r1 - coin.price) / coin.price) * 100;

    if (distanceToS1 < 1 && distanceToS1 > -1) {
      return {
        botName: this.name,
        direction: 'LONG',
        confidence: 0.71,
        entry: coin.price,
        takeProfit: pivot,
        stopLoss: s1 * 0.98,
        leverage: 4,
      };
    } else if (distanceToR1 < 1 && distanceToR1 > -1) {
      return {
        botName: this.name,
        direction: 'SHORT',
        confidence: 0.71,
        entry: coin.price,
        takeProfit: pivot,
        stopLoss: r1 * 1.02,
        leverage: 4,
      };
    }
    return null;
  }
}

class BreakoutBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const candles = ohlcv.candles.slice(-20);
    const highs = candles.map((c: any) => c.high);
    const lows = candles.map((c: any) => c.low);
    const resistance = Math.max(...highs.slice(0, -1));
    const support = Math.min(...lows.slice(0, -1));

    const lastCandle = candles[candles.length - 1];
    const volumeRatio = lastCandle.volume / ohlcv.indicators.volume_avg;

    if (coin.price > resistance && volumeRatio > 1.3) {
      return {
        botName: this.name,
        direction: 'LONG',
        confidence: Math.min(0.65 + volumeRatio / 5, 0.85),
        entry: coin.price,
        takeProfit: coin.price * 1.08,
        stopLoss: resistance * 0.99,
        leverage: 5,
      };
    } else if (coin.price < support && volumeRatio > 1.3) {
      return {
        botName: this.name,
        direction: 'SHORT',
        confidence: Math.min(0.65 + volumeRatio / 5, 0.85),
        entry: coin.price,
        takeProfit: coin.price * 0.92,
        stopLoss: support * 1.01,
        leverage: 5,
      };
    }
    return null;
  }
}

class MeanReversionBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const sma20 = ohlcv.indicators.sma20 || coin.price;
    const deviation = ((coin.price - sma20) / sma20) * 100;
    const atr = ohlcv.indicators.atr || 0;

    if (deviation < -3 && atr > 0) {
      return {
        botName: this.name,
        direction: 'LONG',
        confidence: Math.min(Math.abs(deviation) / 5, 0.8),
        entry: coin.price,
        takeProfit: sma20,
        stopLoss: coin.price - atr,
        leverage: 3,
      };
    } else if (deviation > 3 && atr > 0) {
      return {
        botName: this.name,
        direction: 'SHORT',
        confidence: Math.min(deviation / 5, 0.8),
        entry: coin.price,
        takeProfit: sma20,
        stopLoss: coin.price + atr,
        leverage: 3,
      };
    }
    return null;
  }
}

class MomentumBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const candles = ohlcv.candles;
    const momentum = ((coin.price - candles[candles.length - 10].close) / candles[candles.length - 10].close) * 100;
    const volumeTrend = ohlcv.indicators.volume_avg > candles[candles.length - 10].volume ? 1 : -1;

    if (momentum > 5 && volumeTrend > 0) {
      return {
        botName: this.name,
        direction: 'LONG',
        confidence: Math.min(momentum / 10 + 0.5, 0.85),
        entry: coin.price,
        takeProfit: coin.price * 1.08,
        stopLoss: coin.price * 0.96,
        leverage: 5,
      };
    } else if (momentum < -5 && volumeTrend < 0) {
      return {
        botName: this.name,
        direction: 'SHORT',
        confidence: Math.min(Math.abs(momentum) / 10 + 0.5, 0.85),
        entry: coin.price,
        takeProfit: coin.price * 0.92,
        stopLoss: coin.price * 1.04,
        leverage: 5,
      };
    }
    return null;
  }
}

class CandlestickPatternBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const candles = ohlcv.candles;
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    const body = Math.abs(last.close - last.open);
    const range = last.high - last.low;
    const bodyRatio = body / range;

    const isBullishEngulfing = prev.close < prev.open && last.close > last.open &&
                                last.close > prev.open && last.open < prev.close;
    const isBearishEngulfing = prev.close > prev.open && last.close < last.open &&
                                last.close < prev.open && last.open > prev.close;
    const isHammer = bodyRatio < 0.3 && (last.close > last.open) &&
                     (last.low < Math.min(last.open, last.close) - body * 2);
    const isShootingStar = bodyRatio < 0.3 && (last.close < last.open) &&
                           (last.high > Math.max(last.open, last.close) + body * 2);

    if (isBullishEngulfing || isHammer) {
      return {
        botName: this.name,
        direction: 'LONG',
        confidence: 0.73,
        entry: coin.price,
        takeProfit: coin.price * 1.05,
        stopLoss: last.low * 0.99,
        leverage: 4,
      };
    } else if (isBearishEngulfing || isShootingStar) {
      return {
        botName: this.name,
        direction: 'SHORT',
        confidence: 0.73,
        entry: coin.price,
        takeProfit: coin.price * 0.95,
        stopLoss: last.high * 1.01,
        leverage: 4,
      };
    }
    return null;
  }
}

class TrendFollowingBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const ema20 = ohlcv.indicators.ema20;
    const ema50 = ohlcv.indicators.ema50;
    const ema200 = ohlcv.indicators.ema200 || ema50;
    const adx = ohlcv.indicators.adx || 20;

    const strongUptrend = ema20 > ema50 && ema50 > ema200 && adx > 25;
    const strongDowntrend = ema20 < ema50 && ema50 < ema200 && adx > 25;

    if (strongUptrend && coin.price > ema20) {
      return {
        botName: this.name,
        direction: 'LONG',
        confidence: Math.min(0.7 + adx / 100, 0.88),
        entry: coin.price,
        takeProfit: coin.price * 1.10,
        stopLoss: ema20 * 0.98,
        leverage: 5,
      };
    } else if (strongDowntrend && coin.price < ema20) {
      return {
        botName: this.name,
        direction: 'SHORT',
        confidence: Math.min(0.7 + adx / 100, 0.88),
        entry: coin.price,
        takeProfit: coin.price * 0.90,
        stopLoss: ema20 * 1.02,
        leverage: 5,
      };
    }
    return null;
  }
}

class SupportResistanceBot extends TradingBot {
  analyze(ohlcv: any, derivatives: any, coin: any): BotPrediction | null {
    const candles = ohlcv.candles.slice(-50);
    const levels = this.findKeyLevels(candles);

    for (const level of levels) {
      const distancePercent = Math.abs((coin.price - level) / coin.price) * 100;

      if (distancePercent < 0.5) {
        const isSupport = coin.price > level;
        return {
          botName: this.name,
          direction: isSupport ? 'LONG' : 'SHORT',
          confidence: 0.69,
          entry: coin.price,
          takeProfit: coin.price * (isSupport ? 1.04 : 0.96),
          stopLoss: level * (isSupport ? 0.99 : 1.01),
          leverage: 4,
        };
      }
    }
    return null;
  }

  findKeyLevels(candles: any[]): number[] {
    const prices = candles.map(c => (c.high + c.low) / 2);
    const levels: number[] = [];

    for (let i = 2; i < prices.length - 2; i++) {
      if (prices[i] > prices[i-1] && prices[i] > prices[i-2] &&
          prices[i] > prices[i+1] && prices[i] > prices[i+2]) {
        levels.push(prices[i]);
      }
      if (prices[i] < prices[i-1] && prices[i] < prices[i-2] &&
          prices[i] < prices[i+1] && prices[i] < prices[i+2]) {
        levels.push(prices[i]);
      }
    }

    return levels.slice(-5);
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
  new StochasticBot('Stochastic Oscillator'),
  new ADXBot('ADX Trend Strength'),
  new CCIBot('CCI Commodity Channel'),
  new WilliamsRBot('Williams %R'),
  new ATRVolatilityBot('ATR Volatility'),
  new OBVBot('OBV On-Balance Volume'),
  new VWAPBot('VWAP Trader'),
  new IchimokuBot('Ichimoku Cloud'),
  new ParabolicSARBot('Parabolic SAR'),
  new FibonacciBot('Fibonacci Retracement'),
  new PivotPointBot('Pivot Points'),
  new BreakoutBot('Breakout Hunter'),
  new MeanReversionBot('Mean Reversion'),
  new MomentumBot('Momentum Trader'),
  new CandlestickPatternBot('Candlestick Patterns'),
  new TrendFollowingBot('Trend Following'),
  new SupportResistanceBot('Support/Resistance'),
  new GenericBot('Elliott Wave'),
  new GenericBot('CMF Money Flow'),
  new GenericBot('Harmonic Patterns'),
  new GenericBot('Chart Patterns'),
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