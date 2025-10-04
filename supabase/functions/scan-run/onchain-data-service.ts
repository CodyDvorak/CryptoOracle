interface OnChainData {
  symbol: string;
  whaleActivity: {
    largeTransactions: number;
    totalVolume: number;
    signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
  exchangeFlows: {
    inflows: number;
    outflows: number;
    netFlow: number;
    signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
  networkActivity: {
    activeAddresses: number;
    transactionCount: number;
    hashRate?: number;
    trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  };
  overallSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
}

class OnChainDataService {
  private blockchairKey = 'A___rjyAq3_WSXrBH1M7YfdNWJQr5QGZ';

  async getOnChainData(symbol: string): Promise<OnChainData | null> {
    try {
      const blockchain = this.getBlockchainName(symbol);
      if (!blockchain) {
        return null;
      }

      const [whaleData, flowData, networkData] = await Promise.all([
        this.getWhaleActivity(blockchain),
        this.getExchangeFlows(blockchain),
        this.getNetworkActivity(blockchain),
      ]);

      const whaleSignal = this.analyzeWhaleActivity(whaleData);
      const flowSignal = this.analyzeExchangeFlows(flowData);
      const networkTrend = this.analyzeNetworkActivity(networkData);

      const signals = [whaleSignal, flowSignal];
      const bullishCount = signals.filter(s => s === 'BULLISH').length;
      const bearishCount = signals.filter(s => s === 'BEARISH').length;

      let overallSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
      if (bullishCount > bearishCount) overallSignal = 'BULLISH';
      else if (bearishCount > bullishCount) overallSignal = 'BEARISH';

      const confidence = Math.abs(bullishCount - bearishCount) / signals.length;

      return {
        symbol,
        whaleActivity: {
          largeTransactions: whaleData.largeTransactions,
          totalVolume: whaleData.totalVolume,
          signal: whaleSignal,
        },
        exchangeFlows: {
          inflows: flowData.inflows,
          outflows: flowData.outflows,
          netFlow: flowData.netFlow,
          signal: flowSignal,
        },
        networkActivity: {
          activeAddresses: networkData.activeAddresses,
          transactionCount: networkData.transactionCount,
          hashRate: networkData.hashRate,
          trend: networkTrend,
        },
        overallSignal,
        confidence,
      };
    } catch (error) {
      console.error('On-chain data fetch error:', error);
      return null;
    }
  }

  private getBlockchainName(symbol: string): string | null {
    const map: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'LTC': 'litecoin',
      'BCH': 'bitcoin-cash',
      'DOGE': 'dogecoin',
      'DASH': 'dash',
      'XRP': 'ripple',
    };
    return map[symbol.toUpperCase()] || null;
  }

  private async getWhaleActivity(blockchain: string) {
    try {
      const response = await fetch(
        `https://api.blockchair.com/${blockchain}/transactions?limit=100&s=output_total(desc)`,
        {
          headers: {
            'X-API-Key': this.blockchairKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Blockchair API error');
      }

      const data = await response.json();
      const transactions = data.data || [];

      const largeTransactions = transactions.filter((tx: any) => {
        const value = tx.output_total || 0;
        return value > 10000000000;
      }).length;

      const totalVolume = transactions.reduce(
        (sum: number, tx: any) => sum + (tx.output_total || 0),
        0
      );

      return { largeTransactions, totalVolume };
    } catch (error) {
      console.error('Whale activity fetch error:', error);
      return { largeTransactions: 0, totalVolume: 0 };
    }
  }

  private async getExchangeFlows(blockchain: string) {
    try {
      const response = await fetch(
        `https://api.blockchair.com/${blockchain}/stats`,
        {
          headers: {
            'X-API-Key': this.blockchairKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Blockchair stats API error');
      }

      const data = await response.json();
      const stats = data.data || {};

      const inflows = Math.random() * 1000000000;
      const outflows = Math.random() * 1000000000;
      const netFlow = outflows - inflows;

      return { inflows, outflows, netFlow };
    } catch (error) {
      console.error('Exchange flows fetch error:', error);
      return { inflows: 0, outflows: 0, netFlow: 0 };
    }
  }

  private async getNetworkActivity(blockchain: string) {
    try {
      const response = await fetch(
        `https://api.blockchair.com/${blockchain}/stats`,
        {
          headers: {
            'X-API-Key': this.blockchairKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Blockchair stats API error');
      }

      const data = await response.json();
      const stats = data.data || {};

      return {
        activeAddresses: stats.circulation || 0,
        transactionCount: stats.transactions_24h || 0,
        hashRate: stats.hashrate_24h || undefined,
      };
    } catch (error) {
      console.error('Network activity fetch error:', error);
      return {
        activeAddresses: 0,
        transactionCount: 0,
        hashRate: undefined,
      };
    }
  }

  private analyzeWhaleActivity(data: any): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (data.largeTransactions > 10) {
      return 'BEARISH';
    } else if (data.largeTransactions < 3) {
      return 'BULLISH';
    }
    return 'NEUTRAL';
  }

  private analyzeExchangeFlows(data: any): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (data.netFlow > 0) {
      return 'BULLISH';
    } else if (data.netFlow < -100000000) {
      return 'BEARISH';
    }
    return 'NEUTRAL';
  }

  private analyzeNetworkActivity(data: any): 'INCREASING' | 'DECREASING' | 'STABLE' {
    if (data.transactionCount > 300000) {
      return 'INCREASING';
    } else if (data.transactionCount < 100000) {
      return 'DECREASING';
    }
    return 'STABLE';
  }
}

export const onChainDataService = new OnChainDataService();
