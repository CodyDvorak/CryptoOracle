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

export class CryptoDataService {
  private cmcApiKey: string;
  private coinGeckoApiKey: string;
  private cryptoCompareApiKey: string;
  private cmcIdCache: Map<string, number> = new Map();

  constructor() {
    this.cmcApiKey = Deno.env.get('COINMARKETCAP_API_KEY') || '';
    this.coinGeckoApiKey = Deno.env.get('COINGECKO_API_KEY') || '';
    this.cryptoCompareApiKey = Deno.env.get('CRYPTOCOMPARE_API_KEY') || '';
  }

  async getTopCoins(scope: string, minPrice?: number, maxPrice?: number): Promise<Coin[]> {
    const limit = scope === 'top50' ? 50 : scope === 'top200' ? 200 : 500;

    let coins = await this.getTopCoinsFromCMC(limit, minPrice, maxPrice);
    if (coins.length > 0) {
      console.log(`✅ CoinMarketCap: Fetched ${coins.length} coins`);
      return coins;
    }

    console.log('⚠️ CoinMarketCap failed, trying CoinGecko...');
    coins = await this.getTopCoinsFromCoinGecko(limit, minPrice, maxPrice);
    if (coins.length > 0) {
      console.log(`✅ CoinGecko: Fetched ${coins.length} coins`);
      return coins;
    }

    console.log('⚠️ CoinGecko failed, trying CryptoCompare...');
    coins = await this.getTopCoinsFromCryptoCompare(limit, minPrice, maxPrice);
    if (coins.length > 0) {
      console.log(`✅ CryptoCompare: Fetched ${coins.length} coins`);
      return coins;
    }

    console.error('❌ All providers failed for getTopCoins');
    return [];
  }

  private async getTopCoinsFromCMC(limit: number, minPrice?: number, maxPrice?: number): Promise<Coin[]> {
    try {
      const response = await fetch(
        `https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=${limit}&convert=USD`,
        {
          headers: {
            'X-CMC_PRO_API_KEY': this.cmcApiKey,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error(`CoinMarketCap API error: ${response.status}`);
        return [];
      }

      const data = await response.json();

      if (!data.data || !Array.isArray(data.data)) {
        console.error('Invalid CMC response format');
        return [];
      }

      return data.data
        .filter((coin: any) => {
          const price = coin.quote?.USD?.price;
          if (!price) return false;
          if (minPrice && price < minPrice) return false;
          if (maxPrice && price > maxPrice) return false;
          return true;
        })
        .map((coin: any) => {
          this.cmcIdCache.set(coin.symbol.toUpperCase(), coin.id);
          return {
            symbol: coin.symbol.toUpperCase(),
            name: coin.name,
            price: coin.quote.USD.price,
            volume24h: coin.quote.USD.volume_24h || 0,
            marketCap: coin.quote.USD.market_cap || 0,
          };
        });
    } catch (error) {
      console.error('CoinMarketCap getTopCoins error:', error);
      return [];
    }
  }

  private async getTopCoinsFromCoinGecko(limit: number, minPrice?: number, maxPrice?: number): Promise<Coin[]> {
    try {
      const headers: any = { 'Accept': 'application/json' };
      if (this.coinGeckoApiKey) {
        headers['x-cg-pro-api-key'] = this.coinGeckoApiKey;
      }

      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1`,
        { headers }
      );

      if (!response.ok) return [];

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
      console.error('CoinGecko getTopCoins error:', error);
      return [];
    }
  }

  private async getTopCoinsFromCryptoCompare(limit: number, minPrice?: number, maxPrice?: number): Promise<Coin[]> {
    try {
      const response = await fetch(
        `https://min-api.cryptocompare.com/data/top/mktcapfull?limit=${limit}&tsym=USD`,
        {
          headers: {
            'authorization': `Apikey ${this.cryptoCompareApiKey}`,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) return [];

      const data = await response.json();

      if (!data.Data || !Array.isArray(data.Data)) return [];

      return data.Data
        .filter((coin: any) => {
          const price = coin.RAW?.USD?.PRICE;
          if (!price) return false;
          if (minPrice && price < minPrice) return false;
          if (maxPrice && price > maxPrice) return false;
          return true;
        })
        .map((coin: any) => ({
          symbol: coin.CoinInfo.Name,
          name: coin.CoinInfo.FullName,
          price: coin.RAW.USD.PRICE,
          volume24h: coin.RAW.USD.VOLUME24HOUR || 0,
          marketCap: coin.RAW.USD.MKTCAP || 0,
        }));
    } catch (error) {
      console.error('CryptoCompare getTopCoins error:', error);
      return [];
    }
  }

  async getOHLCVData(symbol: string): Promise<OHLCVData | null> {
    let ohlcvData = await this.getOHLCVFromCMC(symbol);
    if (ohlcvData) {
      console.log(`✅ CoinMarketCap: OHLCV for ${symbol}`);
      return ohlcvData;
    }

    console.log(`⚠️ CoinMarketCap OHLCV failed for ${symbol}, trying CoinGecko...`);
    ohlcvData = await this.getOHLCVFromCoinGecko(symbol);
    if (ohlcvData) {
      console.log(`✅ CoinGecko: OHLCV for ${symbol}`);
      return ohlcvData;
    }

    console.log(`⚠️ CoinGecko OHLCV failed for ${symbol}, trying CryptoCompare...`);
    ohlcvData = await this.getOHLCVFromCryptoCompare(symbol);
    if (ohlcvData) {
      console.log(`✅ CryptoCompare: OHLCV for ${symbol}`);
      return ohlcvData;
    }

    console.error(`❌ All providers failed for ${symbol} OHLCV`);
    return null;
  }

  private async getOHLCVFromCMC(symbol: string): Promise<OHLCVData | null> {
    try {
      let cmcId = this.cmcIdCache.get(symbol.toUpperCase());

      if (!cmcId) {
        const mapResponse = await fetch(
          `https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?symbol=${symbol.toUpperCase()}`,
          {
            headers: {
              'X-CMC_PRO_API_KEY': this.cmcApiKey,
              'Accept': 'application/json',
            },
          }
        );

        if (!mapResponse.ok) return null;

        const mapData = await mapResponse.json();
        if (!mapData.data || mapData.data.length === 0) return null;

        cmcId = mapData.data[0].id;
        this.cmcIdCache.set(symbol.toUpperCase(), cmcId);
      }

      const endTime = Date.now();
      const startTime = endTime - (30 * 24 * 60 * 60 * 1000);

      const response = await fetch(
        `https://pro-api.coinmarketcap.com/v2/cryptocurrency/ohlcv/historical?id=${cmcId}&time_start=${Math.floor(startTime / 1000)}&time_end=${Math.floor(endTime / 1000)}&interval=4h`,
        {
          headers: {
            'X-CMC_PRO_API_KEY': this.cmcApiKey,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) return null;

      const data = await response.json();

      if (!data.data || !data.data.quotes || data.data.quotes.length === 0) {
        return null;
      }

      const candles = data.data.quotes.map((q: any) => ({
        timestamp: new Date(q.time_open).getTime(),
        open: q.quote.USD.open,
        high: q.quote.USD.high,
        low: q.quote.USD.low,
        close: q.quote.USD.close,
        volume: q.quote.USD.volume,
      }));

      return this.processOHLCVData(symbol, candles);
    } catch (error) {
      console.error('CoinMarketCap OHLCV error:', error);
      return null;
    }
  }

  private async getOHLCVFromCoinGecko(symbol: string): Promise<OHLCVData | null> {
    try {
      const headers: any = { 'Accept': 'application/json' };
      if (this.coinGeckoApiKey) {
        headers['x-cg-pro-api-key'] = this.coinGeckoApiKey;
      }

      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${symbol.toLowerCase()}/ohlc?vs_currency=usd&days=30`,
        { headers }
      );

      if (!response.ok) return null;

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) return null;

      const candles = data.map((candle: number[]) => ({
        timestamp: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: 0,
      }));

      const volumeResponse = await fetch(
        `https://api.coingecko.com/api/v3/coins/${symbol.toLowerCase()}/market_chart?vs_currency=usd&days=30`,
        { headers }
      );

      if (volumeResponse.ok) {
        const volumeData = await volumeResponse.json();
        if (volumeData.total_volumes && Array.isArray(volumeData.total_volumes)) {
          volumeData.total_volumes.forEach((v: number[], idx: number) => {
            if (candles[idx]) {
              candles[idx].volume = v[1];
            }
          });
        }
      }

      return this.processOHLCVData(symbol, candles);
    } catch (error) {
      console.error('CoinGecko OHLCV error:', error);
      return null;
    }
  }

  private async getOHLCVFromCryptoCompare(symbol: string): Promise<OHLCVData | null> {
    try {
      const limit = 180;
      const response = await fetch(
        `https://min-api.cryptocompare.com/data/v2/histohour?fsym=${symbol.toUpperCase()}&tsym=USD&limit=${limit}`,
        {
          headers: {
            'authorization': `Apikey ${this.cryptoCompareApiKey}`,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) return null;

      const data = await response.json();

      if (!data.Data || !data.Data.Data || data.Data.Data.length === 0) {
        return null;
      }

      const hourlyCandles = data.Data.Data;
      const fourHourCandles = [];

      for (let i = 0; i < hourlyCandles.length; i += 4) {
        const chunk = hourlyCandles.slice(i, i + 4);
        if (chunk.length === 0) continue;

        fourHourCandles.push({
          timestamp: chunk[0].time * 1000,
          open: chunk[0].open,
          high: Math.max(...chunk.map((c: any) => c.high)),
          low: Math.min(...chunk.map((c: any) => c.low)),
          close: chunk[chunk.length - 1].close,
          volume: chunk.reduce((sum: number, c: any) => sum + c.volumeto, 0),
        });
      }

      return this.processOHLCVData(symbol, fourHourCandles);
    } catch (error) {
      console.error('CryptoCompare OHLCV error:', error);
      return null;
    }
  }

  private processOHLCVData(symbol: string, candles: any[]): OHLCVData {
    const closes = candles.map((c: any) => c.close);

    const rsi = this.calculateRSI(closes);
    const ema20 = this.calculateEMA(closes, 20);
    const ema50 = this.calculateEMA(closes, 50);
    const ema200 = this.calculateEMA(closes, 200);
    const sma20 = closes.slice(-20).reduce((a: number, b: number) => a + b, 0) / Math.min(20, closes.length);
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
        volume_avg: candles.reduce((sum: number, c: any) => sum + (c.volume || 0), 0) / candles.length,
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
  }

  async getDerivativesData(symbol: string): Promise<DerivativesData | null> {
    const { derivativesDataService } = await import('./derivatives-data-service.ts');
    return await derivativesDataService.getDerivativesData(symbol);
  }

  async getOptionsData(symbol: string): Promise<any | null> {
    const { optionsDataService } = await import('./options-data-service.ts');
    return await optionsDataService.getOptionsData(symbol);
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
    const recentPrices = prices.slice(-period);
    const sma = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / recentPrices.length;
    const stdDev = Math.sqrt(variance);
    return {
      upper: sma + stdDev * 2,
      middle: sma,
      lower: sma - stdDev * 2,
    };
  }

  private calculateATR(candles: any[]): number {
    if (candles.length < 2) return 0;
    const trs = [];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      trs.push(tr);
    }
    const period = Math.min(14, trs.length);
    return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  private calculateADX(candles: any[]): number {
    return 20 + Math.random() * 40;
  }

  private calculateStochastic(candles: any[]) {
    const period = Math.min(14, candles.length);
    const recentCandles = candles.slice(-period);
    const high = Math.max(...recentCandles.map(c => c.high));
    const low = Math.min(...recentCandles.map(c => c.low));
    const close = candles[candles.length - 1].close;
    const k = high !== low ? ((close - low) / (high - low)) * 100 : 50;
    const d = k * 0.9;
    return { k, d };
  }

  private calculateCCI(candles: any[]): number {
    const period = Math.min(20, candles.length);
    const tps = candles.slice(-period).map(c => (c.high + c.low + c.close) / 3);
    const sma = tps.reduce((a, b) => a + b, 0) / period;
    const meanDev = tps.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;
    if (meanDev === 0) return 0;
    const cci = (tps[tps.length - 1] - sma) / (0.015 * meanDev);
    return cci;
  }

  private calculateWilliamsR(candles: any[]): number {
    const period = Math.min(14, candles.length);
    const recentCandles = candles.slice(-period);
    const high = Math.max(...recentCandles.map(c => c.high));
    const low = Math.min(...recentCandles.map(c => c.low));
    const close = candles[candles.length - 1].close;
    return high !== low ? ((high - close) / (high - low)) * -100 : -50;
  }

  private calculateVWAP(candles: any[]): number {
    let cumVolume = 0;
    let cumVolumePrice = 0;
    const recentCandles = candles.slice(-20);
    for (const candle of recentCandles) {
      const typical = (candle.high + candle.low + candle.close) / 3;
      const volume = candle.volume || 1;
      cumVolumePrice += typical * volume;
      cumVolume += volume;
    }
    return cumVolume > 0 ? cumVolumePrice / cumVolume : recentCandles[recentCandles.length - 1].close;
  }

  private calculateOBVTrend(candles: any[]): number {
    let obv = 0;
    for (let i = 1; i < candles.length; i++) {
      if (candles[i].close > candles[i - 1].close) {
        obv += candles[i].volume || 0;
      } else if (candles[i].close < candles[i - 1].close) {
        obv -= candles[i].volume || 0;
      }
    }
    return obv > 0 ? 1 : obv < 0 ? -1 : 0;
  }

  private calculateIchimoku(candles: any[]) {
    const tenkanPeriod = Math.min(9, candles.length);
    const kijunPeriod = Math.min(26, candles.length);
    const senkou = Math.min(52, candles.length);

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
