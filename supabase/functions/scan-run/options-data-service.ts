interface OptionsData {
  symbol: string;
  supported: boolean;
  putCallRatio: {
    volume: number;
    openInterest: number;
    signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
  impliedVolatility: {
    current: number;
    percentile: number;
    trend: 'RISING' | 'FALLING' | 'STABLE';
  };
  unusualActivity: {
    detected: boolean;
    largeTradeCount: number;
    totalVolume: number;
    direction: 'CALLS' | 'PUTS' | 'MIXED';
  };
  optionsFlow: {
    callVolume: number;
    putVolume: number;
    totalVolume: number;
    institutionalDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
  maxPain: {
    price: number;
    confidence: number;
  };
  overallSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
}

interface DeribitInstrument {
  instrument_name: string;
  kind: string;
  option_type?: string;
  strike?: number;
  expiration_timestamp?: number;
}

interface DeribitOrderBook {
  instrument_name: string;
  best_bid_price: number;
  best_ask_price: number;
  mark_iv?: number;
  open_interest: number;
  volume_24h?: number;
}

interface DeribitTrade {
  instrument_name: string;
  amount: number;
  direction: string;
  price: number;
  timestamp: number;
}

class OptionsDataService {
  private readonly SUPPORTED_SYMBOLS = ['BTC', 'ETH', 'SOL'];
  private readonly DERIBIT_BASE_URL = 'https://www.deribit.com/api/v2/public';
  private readonly OKX_BASE_URL = 'https://www.okx.com/api/v5/public';
  private readonly LARGE_TRADE_THRESHOLD = 10;
  private okxApiKey = Deno.env.get('OKX_API_KEY') || '';

  async getOptionsData(symbol: string): Promise<OptionsData | null> {
    try {
      const upperSymbol = symbol.toUpperCase();

      if (!this.SUPPORTED_SYMBOLS.includes(upperSymbol)) {
        console.log(`⚠️ Options data not available for ${upperSymbol} (only BTC, ETH, SOL supported)`);
        return {
          symbol,
          supported: false,
          putCallRatio: { volume: 0, openInterest: 0, signal: 'NEUTRAL' },
          impliedVolatility: { current: 0, percentile: 0, trend: 'STABLE' },
          unusualActivity: { detected: false, largeTradeCount: 0, totalVolume: 0, direction: 'MIXED' },
          optionsFlow: { callVolume: 0, putVolume: 0, totalVolume: 0, institutionalDirection: 'NEUTRAL' },
          maxPain: { price: 0, confidence: 0 },
          overallSignal: 'NEUTRAL',
          confidence: 0,
        };
      }

      console.log(`📊 Fetching options data for ${upperSymbol} from Deribit...`);

      let [instruments, recentTrades, currentPrice] = await Promise.all([
        this.getInstruments(upperSymbol),
        this.getRecentTrades(upperSymbol),
        this.getCurrentPrice(upperSymbol),
      ]);

      if (!instruments || instruments.length === 0) {
        console.log(`⚠️ Deribit failed for ${upperSymbol}, trying OKX...`);
        [instruments, recentTrades, currentPrice] = await Promise.all([
          this.getInstrumentsOKX(upperSymbol),
          this.getRecentTradesOKX(upperSymbol),
          this.getCurrentPriceOKX(upperSymbol),
        ]);

        if (!instruments || instruments.length === 0) {
          console.error(`❌ No options instruments found for ${upperSymbol} (Deribit & OKX failed)`);
          return null;
        }
        console.log(`✅ OKX: Options data available for ${upperSymbol}`);
      }

      const orderBooks = await this.getOrderBooks(instruments.slice(0, 20));

      const putCallRatios = this.calculatePutCallRatios(orderBooks);
      const impliedVol = this.calculateImpliedVolatility(orderBooks);
      const unusualActivity = this.detectUnusualActivity(recentTrades);
      const optionsFlow = this.calculateOptionsFlow(orderBooks, recentTrades);
      const maxPain = this.calculateMaxPain(orderBooks, currentPrice);

      const overallSignal = this.determineOverallSignal(
        putCallRatios.signal,
        optionsFlow.institutionalDirection,
        impliedVol.trend
      );

      const confidence = this.calculateConfidence(
        putCallRatios,
        unusualActivity,
        optionsFlow
      );

      console.log(`✅ Deribit: Options data for ${upperSymbol} - Signal: ${overallSignal}`);

      return {
        symbol,
        supported: true,
        putCallRatio: putCallRatios,
        impliedVolatility: impliedVol,
        unusualActivity,
        optionsFlow,
        maxPain,
        overallSignal,
        confidence,
      };
    } catch (error) {
      console.error('Options data fetch error:', error);
      return null;
    }
  }

  private async getInstruments(symbol: string): Promise<DeribitInstrument[]> {
    try {
      const response = await fetch(
        `${this.DERIBIT_BASE_URL}/get_instruments?currency=${symbol}&kind=option&expired=false`
      );

      if (!response.ok) {
        console.error(`Deribit instruments API error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      return data.result || [];
    } catch (error) {
      console.error('Deribit instruments error:', error);
      return [];
    }
  }

  private async getOrderBooks(instruments: DeribitInstrument[]): Promise<DeribitOrderBook[]> {
    try {
      const orderBooks: DeribitOrderBook[] = [];

      for (const instrument of instruments) {
        try {
          const response = await fetch(
            `${this.DERIBIT_BASE_URL}/get_order_book?instrument_name=${instrument.instrument_name}`
          );

          if (response.ok) {
            const data = await response.json();
            if (data.result) {
              orderBooks.push(data.result);
            }
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error fetching order book for ${instrument.instrument_name}:`, error);
        }
      }

      return orderBooks;
    } catch (error) {
      console.error('Order books fetch error:', error);
      return [];
    }
  }

  private async getRecentTrades(symbol: string): Promise<DeribitTrade[]> {
    try {
      const response = await fetch(
        `${this.DERIBIT_BASE_URL}/get_last_trades_by_currency?currency=${symbol}&kind=option&count=100`
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.result?.trades || [];
    } catch (error) {
      console.error('Recent trades fetch error:', error);
      return [];
    }
  }

  private async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const response = await fetch(
        `${this.DERIBIT_BASE_URL}/get_index_price?index_name=${symbol.toLowerCase()}_usd`
      );

      if (!response.ok) {
        return 0;
      }

      const data = await response.json();
      return data.result?.index_price || 0;
    } catch (error) {
      console.error('Current price fetch error:', error);
      return 0;
    }
  }

  private calculatePutCallRatios(orderBooks: DeribitOrderBook[]): {
    volume: number;
    openInterest: number;
    signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  } {
    let callVolume = 0;
    let putVolume = 0;
    let callOI = 0;
    let putOI = 0;

    orderBooks.forEach(book => {
      const isCall = book.instrument_name.includes('-C');
      const isPut = book.instrument_name.includes('-P');

      const volume = book.volume_24h || 0;
      const oi = book.open_interest || 0;

      if (isCall) {
        callVolume += volume;
        callOI += oi;
      } else if (isPut) {
        putVolume += volume;
        putOI += oi;
      }
    });

    const volumeRatio = callVolume > 0 ? putVolume / callVolume : 0;
    const oiRatio = callOI > 0 ? putOI / callOI : 0;

    let signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (volumeRatio < 0.7 && oiRatio < 0.7) {
      signal = 'BULLISH';
    } else if (volumeRatio > 1.3 && oiRatio > 1.3) {
      signal = 'BEARISH';
    }

    return {
      volume: volumeRatio,
      openInterest: oiRatio,
      signal,
    };
  }

  private calculateImpliedVolatility(orderBooks: DeribitOrderBook[]): {
    current: number;
    percentile: number;
    trend: 'RISING' | 'FALLING' | 'STABLE';
  } {
    const ivValues = orderBooks
      .filter(book => book.mark_iv !== undefined)
      .map(book => book.mark_iv!);

    if (ivValues.length === 0) {
      return { current: 0, percentile: 50, trend: 'STABLE' };
    }

    const avgIV = ivValues.reduce((a, b) => a + b, 0) / ivValues.length;

    const sortedIVs = [...ivValues].sort((a, b) => a - b);
    const percentile = (sortedIVs.indexOf(avgIV) / sortedIVs.length) * 100;

    let trend: 'RISING' | 'FALLING' | 'STABLE' = 'STABLE';
    if (percentile > 70) {
      trend = 'RISING';
    } else if (percentile < 30) {
      trend = 'FALLING';
    }

    return {
      current: avgIV,
      percentile,
      trend,
    };
  }

  private detectUnusualActivity(trades: DeribitTrade[]): {
    detected: boolean;
    largeTradeCount: number;
    totalVolume: number;
    direction: 'CALLS' | 'PUTS' | 'MIXED';
  } {
    let largeTradeCount = 0;
    let totalVolume = 0;
    let callVolume = 0;
    let putVolume = 0;

    trades.forEach(trade => {
      const amount = trade.amount;
      totalVolume += amount;

      if (amount >= this.LARGE_TRADE_THRESHOLD) {
        largeTradeCount++;

        if (trade.instrument_name.includes('-C')) {
          callVolume += amount;
        } else if (trade.instrument_name.includes('-P')) {
          putVolume += amount;
        }
      }
    });

    let direction: 'CALLS' | 'PUTS' | 'MIXED' = 'MIXED';
    if (callVolume > putVolume * 1.5) {
      direction = 'CALLS';
    } else if (putVolume > callVolume * 1.5) {
      direction = 'PUTS';
    }

    return {
      detected: largeTradeCount > 5,
      largeTradeCount,
      totalVolume,
      direction,
    };
  }

  private calculateOptionsFlow(orderBooks: DeribitOrderBook[], trades: DeribitTrade[]): {
    callVolume: number;
    putVolume: number;
    totalVolume: number;
    institutionalDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  } {
    let callVolume = 0;
    let putVolume = 0;

    orderBooks.forEach(book => {
      const volume = book.volume_24h || 0;
      if (book.instrument_name.includes('-C')) {
        callVolume += volume;
      } else if (book.instrument_name.includes('-P')) {
        putVolume += volume;
      }
    });

    const totalVolume = callVolume + putVolume;

    let institutionalDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    const ratio = totalVolume > 0 ? callVolume / totalVolume : 0.5;

    if (ratio > 0.6) {
      institutionalDirection = 'BULLISH';
    } else if (ratio < 0.4) {
      institutionalDirection = 'BEARISH';
    }

    return {
      callVolume,
      putVolume,
      totalVolume,
      institutionalDirection,
    };
  }

  private calculateMaxPain(orderBooks: DeribitOrderBook[], currentPrice: number): {
    price: number;
    confidence: number;
  } {
    if (!currentPrice || currentPrice === 0) {
      return { price: 0, confidence: 0 };
    }

    const strikeMap = new Map<number, { callOI: number; putOI: number }>();

    orderBooks.forEach(book => {
      const strike = this.extractStrike(book.instrument_name);
      if (!strike) return;

      if (!strikeMap.has(strike)) {
        strikeMap.set(strike, { callOI: 0, putOI: 0 });
      }

      const data = strikeMap.get(strike)!;
      const oi = book.open_interest || 0;

      if (book.instrument_name.includes('-C')) {
        data.callOI += oi;
      } else if (book.instrument_name.includes('-P')) {
        data.putOI += oi;
      }
    });

    let minPain = Infinity;
    let maxPainPrice = currentPrice;

    strikeMap.forEach((data, strike) => {
      let pain = 0;

      strikeMap.forEach((d, s) => {
        if (strike > s) {
          pain += d.putOI * (strike - s);
        } else if (strike < s) {
          pain += d.callOI * (s - strike);
        }
      });

      if (pain < minPain) {
        minPain = pain;
        maxPainPrice = strike;
      }
    });

    const confidence = strikeMap.size > 5 ? 0.7 : 0.3;

    return {
      price: maxPainPrice,
      confidence,
    };
  }

  private extractStrike(instrumentName: string): number | null {
    const match = instrumentName.match(/-(\d+)-[CP]$/);
    return match ? parseInt(match[1]) : null;
  }

  private determineOverallSignal(
    putCallSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
    flowDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
    ivTrend: 'RISING' | 'FALLING' | 'STABLE'
  ): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    const signals = [putCallSignal, flowDirection];

    if (ivTrend === 'RISING') {
      signals.push('BEARISH');
    } else if (ivTrend === 'FALLING') {
      signals.push('BULLISH');
    }

    const bullishCount = signals.filter(s => s === 'BULLISH').length;
    const bearishCount = signals.filter(s => s === 'BEARISH').length;

    if (bullishCount > bearishCount) return 'BULLISH';
    if (bearishCount > bullishCount) return 'BEARISH';
    return 'NEUTRAL';
  }

  private calculateConfidence(
    putCallRatios: any,
    unusualActivity: any,
    optionsFlow: any
  ): number {
    let confidence = 0.5;

    if (putCallRatios.signal !== 'NEUTRAL') {
      confidence += 0.15;
    }

    if (unusualActivity.detected) {
      confidence += 0.2;
    }

    if (optionsFlow.totalVolume > 1000) {
      confidence += 0.15;
    }

    return Math.min(confidence, 1.0);
  }

  private async getInstrumentsOKX(symbol: string): Promise<DeribitInstrument[]> {
    try {
      const instType = 'OPTION';
      const uly = `${symbol}-USD`;
      const response = await fetch(
        `${this.OKX_BASE_URL}/instruments?instType=${instType}&uly=${uly}`,
        {
          headers: this.okxApiKey ? { 'OK-ACCESS-KEY': this.okxApiKey } : {},
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      if (!data || !data.data || data.data.length === 0) {
        return [];
      }

      return data.data.map((inst: any) => ({
        instrument_name: inst.instId,
        kind: 'option',
        option_type: inst.optType,
        strike: parseFloat(inst.stk),
        expiration_timestamp: parseInt(inst.expTime),
      }));
    } catch (error) {
      console.error('OKX instruments fetch error:', error);
      return [];
    }
  }

  private async getRecentTradesOKX(symbol: string): Promise<DeribitTrade[]> {
    try {
      return [];
    } catch (error) {
      console.error('OKX trades fetch error:', error);
      return [];
    }
  }

  private async getCurrentPriceOKX(symbol: string): Promise<number> {
    try {
      const instId = `${symbol}-USD-SWAP`;
      const response = await fetch(
        `${this.OKX_BASE_URL}/mark-price?instType=SWAP&instId=${instId}`
      );

      if (!response.ok) {
        return 0;
      }

      const data = await response.json();
      if (!data || !data.data || data.data.length === 0) {
        return 0;
      }

      return parseFloat(data.data[0].markPx) || 0;
    } catch (error) {
      console.error('OKX price fetch error:', error);
      return 0;
    }
  }
}

export const optionsDataService = new OptionsDataService();
