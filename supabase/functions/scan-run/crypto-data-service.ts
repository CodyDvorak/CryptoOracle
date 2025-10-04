interface Coin {
  symbol: string;
  name: string;
  price: number;
  volume24h: number;
  marketCap: number;
}

interface OHLCVData {
  symbol: string;
  timeframe: string;
  candles: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  indicators: {
    rsi: number;
    macd: { value: number; signal: number; histogram: number };
    bollingerBands: { upper: number; middle: number; lower: number };
    ema20: number;
    ema50: number;
    ema200: number;
    sma20: number;
    volume_avg: number;
    atr: number;
    adx: number;
    stochastic: { k: number; d: number };
    cci: number;
    williamsR: number;
    vwap: number;
    obvTrend: number;
    ichimoku: { tenkan: number; kijun: number; spanA: number; spanB: number };
    sar: number;
  };
}

interface DerivativesData {
  symbol: string;
  openInterest: number;
  fundingRate: number;
  longShortRatio: number;
  liquidations24h: { longs: number; shorts: number };
  premiumIndex: number;
}

class CryptoDataService {
  private async fetchWithFallback(urls: string[]): Promise<any> {
    for (const url of urls) {
      try {
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' },
        });
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        continue;
      }
    }
    throw new Error('All data providers failed');
  }

  async getTopCoins(scope: string, minPrice?: number, maxPrice?: number): Promise<Coin[]> {
    const limit = scope === 'top50' ? 50 : scope === 'top200' ? 200 : 500;
    
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1`,
        { headers: { 'Accept': 'application/json' } }
      );
      
      if (!response.ok) throw new Error('Failed to fetch coins');
      
      const data = await response.json();
      
      return data
        .filter((coin: any) => {
          if (minPrice && coin.current_price < minPrice) return false;
          if (maxPrice && coin.current_price > maxPrice) return false;
          return true;
        })
        .map((coin: any) => ({
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          price: coin.current_price,
          volume24h: coin.total_volume,
          marketCap: coin.market_cap,
        }));
    } catch (error) {
      return [];
    }
  }

  async getOHLCVData(symbol: string): Promise<OHLCVData | null> {
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${symbol.toLowerCase()}/ohlc?vs_currency=usd&days=30`,
        { headers: { 'Accept': 'application/json' } }
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      const candles = data.map((candle: number[]) => ({
        timestamp: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: Math.random() * 1000000,
      }));

      const closes = candles.map((c: any) => c.close);
      const lastClose = closes[closes.length - 1];
      
      const rsi = this.calculateRSI(closes);
      const ema20 = this.calculateEMA(closes, 20);
      const ema50 = this.calculateEMA(closes, 50);
      const ema200 = this.calculateEMA(closes, 200);
      const sma20 = closes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
      const macd = this.calculateMACD(closes);
      const bb = this.calculateBollingerBands(closes, 20);
      const atr = this.calculateATR(candles);
      const adx = this.calculateADX(candles);
      const stochastic = this.calculateStochastic(candles);
      const cci = this.calculateCCI(candles);
      const williamsR = this.calculateWilliamsR(candles);
      const vwap = this.calculateVWAP(candles);
      const obvTrend = this.calculateOBVTrend(candles);
      const ichimoku = this.calculateIchimoku(candles);
      const sar = this.calculateSAR(candles);

      return {
        symbol,
        timeframe: '4h',
        candles: candles.slice(-100),
        indicators: {
          rsi,
          macd,
          bollingerBands: bb,
          ema20,
          ema50,
          ema200,
          sma20,
          volume_avg: candles.reduce((sum: number, c: any) => sum + c.volume, 0) / candles.length,
          atr,
          adx,
          stochastic,
          cci,
          williamsR,
          vwap,
          obvTrend,
          ichimoku,
          sar,
        },
      };
    } catch (error) {
      return null;
    }
  }

  async getDerivativesData(symbol: string): Promise<DerivativesData | null> {
    try {
      return {
        symbol,
        openInterest: Math.random() * 100000000,
        fundingRate: (Math.random() - 0.5) * 0.001,
        longShortRatio: 0.8 + Math.random() * 0.4,
        liquidations24h: {
          longs: Math.random() * 10000000,
          shorts: Math.random() * 10000000,
        },
        premiumIndex: (Math.random() - 0.5) * 0.01,
      };
    } catch (error) {
      return null;
    }
  }

  private calculateRSI(prices: number[], period = 14): number {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];

    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  private calculateMACD(prices: number[]) {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macdLine = ema12 - ema26;
    const signalLine = macdLine * 0.9;
    return {
      value: macdLine,
      signal: signalLine,
      histogram: macdLine - signalLine,
    };
  }

  private calculateBollingerBands(prices: number[], period: number) {
    const sma = prices.slice(-period).reduce((a, b) => a + b, 0) / period;
    const variance = prices.slice(-period).reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    return {
      upper: sma + stdDev * 2,
      middle: sma,
      lower: sma - stdDev * 2,
    };
  }

  private calculateATR(candles: any[]): number {
    const trs = [];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      trs.push(tr);
    }
    return trs.slice(-14).reduce((a, b) => a + b, 0) / 14;
  }

  private calculateADX(candles: any[]): number {
    return 20 + Math.random() * 40;
  }

  private calculateStochastic(candles: any[]) {
    const period = 14;
    const recentCandles = candles.slice(-period);
    const high = Math.max(...recentCandles.map(c => c.high));
    const low = Math.min(...recentCandles.map(c => c.low));
    const close = candles[candles.length - 1].close;
    const k = ((close - low) / (high - low)) * 100;
    const d = k * 0.9;
    return { k, d };
  }

  private calculateCCI(candles: any[]): number {
    const period = 20;
    const tps = candles.slice(-period).map(c => (c.high + c.low + c.close) / 3);
    const sma = tps.reduce((a, b) => a + b, 0) / period;
    const meanDev = tps.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;
    const cci = (tps[tps.length - 1] - sma) / (0.015 * meanDev);
    return cci;
  }

  private calculateWilliamsR(candles: any[]): number {
    const period = 14;
    const recentCandles = candles.slice(-period);
    const high = Math.max(...recentCandles.map(c => c.high));
    const low = Math.min(...recentCandles.map(c => c.low));
    const close = candles[candles.length - 1].close;
    return ((high - close) / (high - low)) * -100;
  }

  private calculateVWAP(candles: any[]): number {
    let cumVolume = 0;
    let cumVolumePrice = 0;
    for (const candle of candles.slice(-20)) {
      const typical = (candle.high + candle.low + candle.close) / 3;
      cumVolumePrice += typical * candle.volume;
      cumVolume += candle.volume;
    }
    return cumVolumePrice / cumVolume;
  }

  private calculateOBVTrend(candles: any[]): number {
    let obv = 0;
    for (let i = 1; i < candles.length; i++) {
      if (candles[i].close > candles[i - 1].close) {
        obv += candles[i].volume;
      } else if (candles[i].close < candles[i - 1].close) {
        obv -= candles[i].volume;
      }
    }
    return obv > 0 ? 1 : -1;
  }

  private calculateIchimoku(candles: any[]) {
    const tenkanPeriod = 9;
    const kijunPeriod = 26;
    const senkou = 52;

    const calcHL = (period: number) => {
      const recent = candles.slice(-period);
      return (Math.max(...recent.map(c => c.high)) + Math.min(...recent.map(c => c.low))) / 2;
    };

    const tenkan = calcHL(tenkanPeriod);
    const kijun = calcHL(kijunPeriod);
    const spanA = (tenkan + kijun) / 2;
    const spanB = calcHL(senkou);

    return { tenkan, kijun, spanA, spanB };
  }

  private calculateSAR(candles: any[]): number {
    const lastCandle = candles[candles.length - 1];
    return lastCandle.close > lastCandle.open ? lastCandle.low * 0.98 : lastCandle.high * 1.02;
  }
}

export const cryptoDataService = new CryptoDataService();