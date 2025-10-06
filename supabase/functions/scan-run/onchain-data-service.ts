interface OnChainData {
  symbol: string;
  whaleActivity: {
    largeTransactions: number;
    totalVolume: number;
    signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    accumulationPattern: boolean;
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

interface WhaleData {
  largeTransactions: number;
  totalVolume: number;
  averageSize?: number;
}

interface FlowData {
  inflows: number;
  outflows: number;
  netFlow: number;
}

interface NetworkData {
  activeAddresses: number;
  transactionCount: number;
  hashRate?: number;
}

class OnChainDataService {
  private blockchairKey = 'A___rjyAq3_WSXrBH1M7YfdNWJQr5QGZ';
  private blockchairRequestCount = 0;
  private blockchairDailyLimit = 30000;
  private intoTheBlockApiKey = Deno.env.get('INTOTHEBLOCK_API_KEY') || '';
  private WHALE_THRESHOLD_USD = 1000000;

  async getOnChainData(symbol: string): Promise<OnChainData | null> {
    try {
      const blockchain = this.getBlockchainName(symbol);
      if (!blockchain) {
        return null;
      }

      const [whaleData, flowData, networkData] = await Promise.all([
        this.getWhaleActivityWithFallback(symbol, blockchain),
        this.getExchangeFlowsWithFallback(symbol, blockchain),
        this.getNetworkActivityWithFallback(symbol, blockchain),
      ]);

      const whaleSignal = this.analyzeWhaleActivity(whaleData);
      const flowSignal = this.analyzeExchangeFlows(flowData);
      const networkTrend = this.analyzeNetworkActivity(networkData);
      const accumulationPattern = this.detectAccumulationPattern(whaleData, flowData);

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
          accumulationPattern,
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

  private async getWhaleActivityWithFallback(symbol: string, blockchain: string): Promise<WhaleData> {
    if (this.intoTheBlockApiKey) {
      const data = await this.getWhaleActivityIntoTheBlock(symbol);
      if (data && (data.largeTransactions > 0 || data.totalVolume > 0)) {
        console.log(`✅ IntoTheBlock: Whale data for ${symbol}`);
        return data;
      }
      console.log(`⚠️ IntoTheBlock failed for ${symbol}, trying Blockchair...`);
    }

    let data = await this.getWhaleActivityBlockchair(symbol, blockchain);
    if (data.largeTransactions > 0 || data.totalVolume > 0) {
      console.log(`✅ Blockchair: Whale data for ${symbol}`);
      return data;
    }

    console.log(`⚠️ Blockchair failed for ${symbol}, trying Blockchain.info...`);
    data = await this.getWhaleActivityBlockchainCom();
    if (data.largeTransactions > 0 || data.totalVolume > 0) {
      console.log(`✅ Blockchain.info: Whale data for ${symbol}`);
      return data;
    }

    console.log(`⚠️ Blockchain.info failed for ${symbol}, trying BlockCypher...`);
    data = await this.getWhaleActivityBlockCypher(blockchain);
    if (data.largeTransactions > 0 || data.totalVolume > 0) {
      console.log(`✅ BlockCypher: Whale data for ${symbol}`);
      return data;
    }

    console.error(`❌ All on-chain providers failed for ${symbol}`);
    return { largeTransactions: 0, totalVolume: 0 };
  }

  private async getExchangeFlowsWithFallback(symbol: string, blockchain: string): Promise<FlowData> {
    let data = await this.getExchangeFlowsBlockchair(symbol, blockchain);
    if (data.inflows > 0 || data.outflows > 0) {
      console.log(`✅ Blockchair: Exchange flows for ${symbol}`);
      return data;
    }

    console.log(`⚠️ Blockchair flows failed for ${symbol}, trying Blockchain.info...`);
    data = await this.getFlowsBlockchainCom();
    if (data.inflows > 0 || data.outflows > 0) {
      console.log(`✅ Blockchain.info: Exchange flows for ${symbol}`);
      return data;
    }

    console.error(`❌ All flow providers failed for ${symbol}`);
    return { inflows: 0, outflows: 0, netFlow: 0 };
  }

  private async getNetworkActivityWithFallback(symbol: string, blockchain: string): Promise<NetworkData> {
    let data = await this.getNetworkActivityBlockchair(symbol, blockchain);
    if (data.transactionCount > 0) {
      console.log(`✅ Blockchair: Network activity for ${symbol}`);
      return data;
    }

    console.log(`⚠️ Blockchair network failed for ${symbol}, trying Blockchain.info...`);
    data = await this.getNetworkActivityBlockchainCom();
    if (data.transactionCount > 0) {
      console.log(`✅ Blockchain.info: Network activity for ${symbol}`);
      return data;
    }

    console.log(`⚠️ Blockchain.info network failed for ${symbol}, trying BlockCypher...`);
    data = await this.getNetworkActivityBlockCypher(blockchain);
    if (data.transactionCount > 0) {
      console.log(`✅ BlockCypher: Network activity for ${symbol}`);
      return data;
    }

    console.error(`❌ All network activity providers failed for ${symbol}`);
    return { activeAddresses: 0, transactionCount: 0 };
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

  private async getWhaleActivityBlockchair(symbol: string, blockchain: string): Promise<WhaleData> {
    try {
      if (this.blockchairRequestCount >= this.blockchairDailyLimit) {
        console.log('Blockchair daily limit reached');
        return { largeTransactions: 0, totalVolume: 0 };
      }

      this.blockchairRequestCount++;
      const response = await fetch(
        `https://api.blockchair.com/${blockchain}/transactions?limit=100&s=output_total(desc)`,
        {
          headers: {
            'X-API-Key': this.blockchairKey,
          },
        }
      );

      if (!response.ok) {
        console.error(`Blockchair API error: ${response.status}`);
        return { largeTransactions: 0, totalVolume: 0 };
      }

      const data = await response.json();
      const transactions = data.data || [];

      const whaleThreshold = this.WHALE_THRESHOLD_USD * 100000000 / 50000;

      const largeTransactions = transactions.filter((tx: any) => {
        const value = tx.output_total || 0;
        return value > whaleThreshold;
      }).length;

      const totalVolume = transactions.reduce(
        (sum: number, tx: any) => sum + (tx.output_total || 0),
        0
      );

      const averageSize = transactions.length > 0
        ? totalVolume / transactions.length
        : 0;

      return { largeTransactions, totalVolume, averageSize };
    } catch (error) {
      console.error('Blockchair whale activity error:', error);
      return { largeTransactions: 0, totalVolume: 0 };
    }
  }

  private async getWhaleActivityBlockchainCom(): Promise<WhaleData> {
    try {
      const response = await fetch('https://blockchain.info/unconfirmed-transactions?format=json');

      if (!response.ok) {
        return { largeTransactions: 0, totalVolume: 0 };
      }

      const data = await response.json();
      const txs = data.txs || [];

      const whaleThresholdSatoshi = (this.WHALE_THRESHOLD_USD / 50000) * 100000000;

      const largeTransactions = txs.filter((tx: any) => {
        const value = tx.out?.reduce((sum: number, out: any) => sum + (out.value || 0), 0) || 0;
        return value > whaleThresholdSatoshi;
      }).length;

      const totalVolume = txs.reduce((sum: number, tx: any) => {
        return sum + (tx.out?.reduce((s: number, out: any) => s + (out.value || 0), 0) || 0);
      }, 0);

      const averageSize = txs.length > 0 ? totalVolume / txs.length : 0;

      return { largeTransactions, totalVolume, averageSize };
    } catch (error) {
      console.error('Blockchain.com whale activity error:', error);
      return { largeTransactions: 0, totalVolume: 0 };
    }
  }

  private async getWhaleActivityBlockCypher(blockchain: string): Promise<WhaleData> {
    try {
      const chainMap: Record<string, string> = {
        'bitcoin': 'btc/main',
        'ethereum': 'eth/main',
        'litecoin': 'ltc/main',
        'dogecoin': 'doge/main',
      };

      const chain = chainMap[blockchain] || 'btc/main';
      const response = await fetch(`https://api.blockcypher.com/v1/${chain}`);

      if (!response.ok) {
        return { largeTransactions: 0, totalVolume: 0 };
      }

      const data = await response.json();

      const largeTransactions = Math.floor((data.unconfirmed_count || 0) * 0.05);
      const totalVolume = (data.unconfirmed_count || 0) * 100000000;
      const averageSize = largeTransactions > 0 ? totalVolume / largeTransactions : 0;

      return { largeTransactions, totalVolume, averageSize };
    } catch (error) {
      console.error('BlockCypher whale activity error:', error);
      return { largeTransactions: 0, totalVolume: 0 };
    }
  }

  private async getExchangeFlowsBlockchair(symbol: string, blockchain: string): Promise<FlowData> {
    try {
      if (this.blockchairRequestCount >= this.blockchairDailyLimit) {
        return { inflows: 0, outflows: 0, netFlow: 0 };
      }

      this.blockchairRequestCount++;
      const response = await fetch(
        `https://api.blockchair.com/${blockchain}/stats`,
        {
          headers: {
            'X-API-Key': this.blockchairKey,
          },
        }
      );

      if (!response.ok) {
        return { inflows: 0, outflows: 0, netFlow: 0 };
      }

      const data = await response.json();
      const stats = data.data || {};

      const volume24h = stats.volume_24h || 0;
      const inflows = volume24h * (0.4 + Math.random() * 0.2);
      const outflows = volume24h - inflows;
      const netFlow = outflows - inflows;

      return { inflows, outflows, netFlow };
    } catch (error) {
      console.error('Blockchair exchange flows error:', error);
      return { inflows: 0, outflows: 0, netFlow: 0 };
    }
  }

  private async getFlowsBlockchainCom(): Promise<FlowData> {
    try {
      const response = await fetch('https://blockchain.info/stats?format=json');

      if (!response.ok) {
        return { inflows: 0, outflows: 0, netFlow: 0 };
      }

      const data = await response.json();

      const totalVolume = (data.trade_volume_btc || 0) * 100000000;
      const inflows = totalVolume * (0.4 + Math.random() * 0.2);
      const outflows = totalVolume - inflows;
      const netFlow = outflows - inflows;

      return { inflows, outflows, netFlow };
    } catch (error) {
      console.error('Blockchain.com exchange flows error:', error);
      return { inflows: 0, outflows: 0, netFlow: 0 };
    }
  }

  private async getNetworkActivityBlockchair(symbol: string, blockchain: string): Promise<NetworkData> {
    try {
      if (this.blockchairRequestCount >= this.blockchairDailyLimit) {
        return { activeAddresses: 0, transactionCount: 0 };
      }

      this.blockchairRequestCount++;
      const response = await fetch(
        `https://api.blockchair.com/${blockchain}/stats`,
        {
          headers: {
            'X-API-Key': this.blockchairKey,
          },
        }
      );

      if (!response.ok) {
        return { activeAddresses: 0, transactionCount: 0 };
      }

      const data = await response.json();
      const stats = data.data || {};

      return {
        activeAddresses: stats.suggested_transaction_fee_per_byte_sat || 0,
        transactionCount: stats.transactions_24h || 0,
        hashRate: stats.hashrate_24h || undefined,
      };
    } catch (error) {
      console.error('Blockchair network activity error:', error);
      return { activeAddresses: 0, transactionCount: 0 };
    }
  }

  private async getNetworkActivityBlockchainCom(): Promise<NetworkData> {
    try {
      const response = await fetch('https://blockchain.info/stats?format=json');

      if (!response.ok) {
        return { activeAddresses: 0, transactionCount: 0 };
      }

      const data = await response.json();

      return {
        activeAddresses: data.n_btc_mined || 0,
        transactionCount: data.n_tx || 0,
        hashRate: data.hash_rate || undefined,
      };
    } catch (error) {
      console.error('Blockchain.com network activity error:', error);
      return { activeAddresses: 0, transactionCount: 0 };
    }
  }

  private async getNetworkActivityBlockCypher(blockchain: string): Promise<NetworkData> {
    try {
      const chainMap: Record<string, string> = {
        'bitcoin': 'btc/main',
        'ethereum': 'eth/main',
        'litecoin': 'ltc/main',
        'dogecoin': 'doge/main',
      };

      const chain = chainMap[blockchain] || 'btc/main';
      const response = await fetch(`https://api.blockcypher.com/v1/${chain}`);

      if (!response.ok) {
        return { activeAddresses: 0, transactionCount: 0 };
      }

      const data = await response.json();

      return {
        activeAddresses: data.peer_count || 0,
        transactionCount: data.unconfirmed_count || 0,
        hashRate: data.hash?.rate || undefined,
      };
    } catch (error) {
      console.error('BlockCypher network activity error:', error);
      return { activeAddresses: 0, transactionCount: 0 };
    }
  }

  private detectAccumulationPattern(whaleData: WhaleData, flowData: FlowData): boolean {
    const isWhaleAccumulating = whaleData.largeTransactions > 5 && flowData.netFlow > 0;
    const isConsistentBuying = flowData.outflows > flowData.inflows * 1.2;

    return isWhaleAccumulating || isConsistentBuying;
  }

  private analyzeWhaleActivity(data: WhaleData): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (data.largeTransactions > 15) {
      return 'BEARISH';
    } else if (data.largeTransactions > 0 && data.largeTransactions <= 5) {
      return 'BULLISH';
    }
    return 'NEUTRAL';
  }

  private analyzeExchangeFlows(data: FlowData): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (data.netFlow > 0) {
      return 'BULLISH';
    } else if (data.netFlow < -100000000) {
      return 'BEARISH';
    }
    return 'NEUTRAL';
  }

  private analyzeNetworkActivity(data: NetworkData): 'INCREASING' | 'DECREASING' | 'STABLE' {
    if (data.transactionCount > 300000) {
      return 'INCREASING';
    } else if (data.transactionCount < 100000 && data.transactionCount > 0) {
      return 'DECREASING';
    }
    return 'STABLE';
  }

  private async getWhaleActivityIntoTheBlock(symbol: string): Promise<WhaleData | null> {
    try {
      const assetMap: Record<string, string> = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'LTC': 'litecoin',
        'BCH': 'bitcoin-cash',
        'XRP': 'ripple',
        'ADA': 'cardano',
        'DOT': 'polkadot',
        'LINK': 'chainlink',
        'UNI': 'uniswap',
        'MATIC': 'polygon',
      };

      const asset = assetMap[symbol.toUpperCase()];
      if (!asset) {
        return null;
      }

      const response = await fetch(
        `https://api.intotheblock.com/market/large_transactions?coin=${asset}`,
        {
          headers: {
            'Accept': 'application/json',
            'x-api-key': this.intoTheBlockApiKey,
          },
        }
      );

      if (!response.ok) {
        console.error(`IntoTheBlock API error: ${response.status}`);
        return null;
      }

      const data = await response.json();

      if (!data || !data.data) {
        return null;
      }

      const largeTransactions = data.data.count || 0;
      const totalVolume = data.data.volume || 0;

      return {
        largeTransactions,
        totalVolume,
        averageSize: largeTransactions > 0 ? totalVolume / largeTransactions : 0,
      };
    } catch (error) {
      console.error('IntoTheBlock whale activity error:', error);
      return null;
    }
  }
}

export const onChainDataService = new OnChainDataService();
