// Price Data Service with multi-API support and fallback
// Priority: CoinMarketCap (paid) -> CryptoCompare (backup) -> CoinGecko (tertiary)

interface PriceDataPoint {
  timestamp: number;
  price: number;
  volume?: number;
  marketCap?: number;
}

interface CoinPriceHistory {
  symbol: string;
  prices: PriceDataPoint[];
}

export class PriceDataService {
  private cmcApiKey = Deno.env.get('COINMARKETCAP_API_KEY') || '';
  private ccApiKey = Deno.env.get('CRYPTOCOMPARE_API_KEY') || '';
  private cgApiKey = Deno.env.get('COINGECKO_API_KEY') || '';

  // Symbol mappings for different APIs
  private symbolMappings: Record<string, { cmc: string; cg: string; cc: string }> = {
    'BTC': { cmc: 'BTC', cg: 'bitcoin', cc: 'BTC' },
    'ETH': { cmc: 'ETH', cg: 'ethereum', cc: 'ETH' },
    'BNB': { cmc: 'BNB', cg: 'binancecoin', cc: 'BNB' },
    'SOL': { cmc: 'SOL', cg: 'solana', cc: 'SOL' },
    'XRP': { cmc: 'XRP', cg: 'ripple', cc: 'XRP' },
    'ADA': { cmc: 'ADA', cg: 'cardano', cc: 'ADA' },
    'DOGE': { cmc: 'DOGE', cg: 'dogecoin', cc: 'DOGE' },
    'AVAX': { cmc: 'AVAX', cg: 'avalanche-2', cc: 'AVAX' },
    'DOT': { cmc: 'DOT', cg: 'polkadot', cc: 'DOT' },
    'MATIC': { cmc: 'MATIC', cg: 'matic-network', cc: 'MATIC' },
    'LINK': { cmc: 'LINK', cg: 'chainlink', cc: 'LINK' },
    'UNI': { cmc: 'UNI', cg: 'uniswap', cc: 'UNI' },
    'LTC': { cmc: 'LTC', cg: 'litecoin', cc: 'LTC' },
    'ATOM': { cmc: 'ATOM', cg: 'cosmos', cc: 'ATOM' },
    'XLM': { cmc: 'XLM', cg: 'stellar', cc: 'XLM' },
    'TRX': { cmc: 'TRX', cg: 'tron', cc: 'TRX' },
    'NEAR': { cmc: 'NEAR', cg: 'near', cc: 'NEAR' },
    'ALGO': { cmc: 'ALGO', cg: 'algorand', cc: 'ALGO' },
    'VET': { cmc: 'VET', cg: 'vechain', cc: 'VET' },
    'FIL': { cmc: 'FIL', cg: 'filecoin', cc: 'FIL' },
  };

  async fetchHistoricalPrices(symbols: string[], days: number): Promise<CoinPriceHistory[]> {
    console.log(`Fetching ${days} days of price data for ${symbols.length} coins`);

    const results: CoinPriceHistory[] = [];

    for (const symbol of symbols) {
      try {
        let priceData: CoinPriceHistory | null = null;

        // Try CoinMarketCap first (primary, paid tier)
        priceData = await this.fetchFromCoinMarketCap(symbol, days);

        if (!priceData) {
          console.log(`CMC failed for ${symbol}, trying CryptoCompare...`);
          priceData = await this.fetchFromCryptoCompare(symbol, days);
        }

        if (!priceData) {
          console.log(`CryptoCompare failed for ${symbol}, trying CoinGecko...`);
          priceData = await this.fetchFromCoinGecko(symbol, days);
        }

        if (priceData && priceData.prices.length > 0) {
          results.push(priceData);
          console.log(`✓ ${symbol}: ${priceData.prices.length} data points`);
        } else {
          console.warn(`✗ ${symbol}: No price data available from any API`);
        }

        // Rate limiting delay
        await this.delay(250); // 4 requests per second max
      } catch (error) {
        console.error(`Error fetching ${symbol}:`, error.message);
      }
    }

    return results;
  }

  private async fetchFromCoinMarketCap(symbol: string, days: number): Promise<CoinPriceHistory | null> {
    if (!this.cmcApiKey) return null;

    try {
      const mapping = this.symbolMappings[symbol];
      if (!mapping) return null;

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      // CoinMarketCap quotes/historical endpoint
      const url = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/historical`;
      const params = new URLSearchParams({
        symbol: mapping.cmc,
        time_start: Math.floor(startDate.getTime() / 1000).toString(),
        time_end: Math.floor(endDate.getTime() / 1000).toString(),
        interval: 'daily',
        count: days.toString()
      });

      const response = await fetch(`${url}?${params}`, {
        headers: {
          'X-CMC_PRO_API_KEY': this.cmcApiKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`CMC API error for ${symbol}: ${response.status}`);
        return null;
      }

      const data = await response.json();

      if (!data.data || !data.data.quotes) {
        return null;
      }

      const prices: PriceDataPoint[] = data.data.quotes.map((quote: any) => ({
        timestamp: new Date(quote.timestamp).getTime(),
        price: quote.quote.USD.price,
        volume: quote.quote.USD.volume_24h,
        marketCap: quote.quote.USD.market_cap
      }));

      return { symbol, prices };
    } catch (error) {
      console.error(`CoinMarketCap fetch error for ${symbol}:`, error.message);
      return null;
    }
  }

  private async fetchFromCryptoCompare(symbol: string, days: number): Promise<CoinPriceHistory | null> {
    if (!this.ccApiKey) return null;

    try {
      const mapping = this.symbolMappings[symbol];
      if (!mapping) return null;

      const url = `https://min-api.cryptocompare.com/data/v2/histoday`;
      const params = new URLSearchParams({
        fsym: mapping.cc,
        tsym: 'USD',
        limit: days.toString(),
        api_key: this.ccApiKey
      });

      const response = await fetch(`${url}?${params}`);

      if (!response.ok) {
        console.warn(`CryptoCompare API error for ${symbol}: ${response.status}`);
        return null;
      }

      const data = await response.json();

      if (!data.Data || !data.Data.Data) {
        return null;
      }

      const prices: PriceDataPoint[] = data.Data.Data.map((point: any) => ({
        timestamp: point.time * 1000,
        price: point.close,
        volume: point.volumeto,
        marketCap: 0
      }));

      return { symbol, prices };
    } catch (error) {
      console.error(`CryptoCompare fetch error for ${symbol}:`, error.message);
      return null;
    }
  }

  private async fetchFromCoinGecko(symbol: string, days: number): Promise<CoinPriceHistory | null> {
    try {
      const mapping = this.symbolMappings[symbol];
      if (!mapping) return null;

      const url = `https://api.coingecko.com/api/v3/coins/${mapping.cg}/market_chart`;
      const params = new URLSearchParams({
        vs_currency: 'usd',
        days: days.toString(),
        interval: 'daily'
      });

      const headers: HeadersInit = {
        'Accept': 'application/json'
      };

      if (this.cgApiKey) {
        headers['x-cg-pro-api-key'] = this.cgApiKey;
      }

      const response = await fetch(`${url}?${params}`, { headers });

      if (!response.ok) {
        console.warn(`CoinGecko API error for ${symbol}: ${response.status}`);
        return null;
      }

      const data = await response.json();

      if (!data.prices || data.prices.length === 0) {
        return null;
      }

      const prices: PriceDataPoint[] = data.prices.map(([timestamp, price]: [number, number]) => ({
        timestamp,
        price,
        volume: 0,
        marketCap: 0
      }));

      return { symbol, prices };
    } catch (error) {
      console.error(`CoinGecko fetch error for ${symbol}:`, error.message);
      return null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Fetch enhanced market data from Messari
  async fetchMessariMarketData(symbol: string): Promise<any | null> {
    const messariApiKey = Deno.env.get('MESSARI_API_KEY');
    if (!messariApiKey) return null;

    try {
      const url = `https://data.messari.io/api/v1/assets/${symbol.toLowerCase()}/metrics/market-data`;

      const response = await fetch(url, {
        headers: {
          'x-messari-api-key': messariApiKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error(`Messari fetch error for ${symbol}:`, error.message);
      return null;
    }
  }
}
