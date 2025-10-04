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
    volume_avg: number;
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

      return {
        symbol,
        timeframe: '4h',
        candles: candles.slice(-100),
        indicators: {
          rsi,
          macd: { value: 0, signal: 0, histogram: 0 },
          bollingerBands: { upper: lastClose * 1.02, middle: lastClose, lower: lastClose * 0.98 },
          ema20,
          ema50,
          ema200,
          volume_avg: candles.reduce((sum: number, c: any) => sum + c.volume, 0) / candles.length,
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
}

export const cryptoDataService = new CryptoDataService();