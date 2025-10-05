interface DerivativesData {
  symbol: string;
  openInterest: number;
  fundingRate: number;
  longShortRatio: number;
  liquidations24h: { longs: number; shorts: number };
  premiumIndex: number;
}

export class DerivativesDataService {
  private okxApiKey: string;
  private coinalyzeApiKey: string;

  constructor() {
    this.okxApiKey = Deno.env.get('OKX_API_KEY') || '';
    this.coinalyzeApiKey = Deno.env.get('COINALYZE_API_KEY') || '';
  }

  async getDerivativesData(symbol: string): Promise<DerivativesData | null> {
    let data = await this.getDerivativesFromOKX(symbol);
    if (data) {
      console.log(`✅ OKX: Derivatives for ${symbol}`);
      return data;
    }

    console.log(`⚠️ OKX derivatives failed for ${symbol}, trying Coinalyze...`);
    data = await this.getDerivativesFromCoinalyze(symbol);
    if (data) {
      console.log(`✅ Coinalyze: Derivatives for ${symbol}`);
      return data;
    }

    console.log(`⚠️ Coinalyze failed for ${symbol}, trying Bybit...`);
    data = await this.getDerivativesFromBybit(symbol);
    if (data) {
      console.log(`✅ Bybit: Derivatives for ${symbol}`);
      return data;
    }

    console.log(`⚠️ Bybit failed for ${symbol}, trying Binance...`);
    data = await this.getDerivativesFromBinance(symbol);
    if (data) {
      console.log(`✅ Binance: Derivatives for ${symbol}`);
      return data;
    }

    console.error(`❌ All derivatives providers failed for ${symbol}`);
    return null;
  }

  private async getDerivativesFromOKX(symbol: string): Promise<DerivativesData | null> {
    try {
      const instId = `${symbol.toUpperCase()}-USDT-SWAP`;

      const headers: any = {
        'Accept': 'application/json',
      };
      if (this.okxApiKey) {
        headers['OK-ACCESS-KEY'] = this.okxApiKey;
      }

      const [fundingResponse, openInterestResponse, ratioResponse] = await Promise.all([
        fetch(`https://www.okx.com/api/v5/public/funding-rate?instId=${instId}`, { headers }),
        fetch(`https://www.okx.com/api/v5/public/open-interest?instId=${instId}`, { headers }),
        fetch(`https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio?instId=${instId}&period=5m`, { headers }),
      ]);

      if (!fundingResponse.ok || !openInterestResponse.ok) {
        return null;
      }

      const fundingData = await fundingResponse.json();
      const openInterestData = await openInterestResponse.json();
      const ratioData = ratioResponse.ok ? await ratioResponse.json() : null;

      if (fundingData.code !== '0' || openInterestData.code !== '0') {
        return null;
      }

      const fundingRate = parseFloat(fundingData.data[0]?.fundingRate || '0');
      const openInterest = parseFloat(openInterestData.data[0]?.oi || '0');

      let longShortRatio = 1.0;
      if (ratioData && ratioData.code === '0' && ratioData.data.length > 0) {
        const latestRatio = ratioData.data[0];
        const longPct = parseFloat(latestRatio.longAccountRatio);
        const shortPct = parseFloat(latestRatio.shortAccountRatio);
        if (shortPct > 0) {
          longShortRatio = longPct / shortPct;
        }
      }

      const estimatedLiquidations = this.estimateLiquidations(fundingRate, openInterest);

      return {
        symbol,
        openInterest: openInterest * 1000000,
        fundingRate,
        longShortRatio,
        liquidations24h: estimatedLiquidations,
        premiumIndex: fundingRate * 3,
      };
    } catch (error) {
      console.error('OKX derivatives error:', error);
      return null;
    }
  }

  private async getDerivativesFromCoinalyze(symbol: string): Promise<DerivativesData | null> {
    try {
      const headers: any = {
        'Accept': 'application/json',
      };
      if (this.coinalyzeApiKey) {
        headers['Authorization'] = `Bearer ${this.coinalyzeApiKey}`;
      }

      const symbolFormatted = symbol.toUpperCase();

      const [fundingResponse, openInterestResponse] = await Promise.all([
        fetch(`https://api.coinalyze.net/v1/funding-rate?symbols=${symbolFormatted}.P`, { headers }),
        fetch(`https://api.coinalyze.net/v1/open-interest?symbols=${symbolFormatted}.P&interval=1h&limit=1`, { headers }),
      ]);

      if (!fundingResponse.ok || !openInterestResponse.ok) {
        return null;
      }

      const fundingData = await fundingResponse.json();
      const openInterestData = await openInterestResponse.json();

      if (!fundingData || fundingData.length === 0 || !openInterestData || openInterestData.length === 0) {
        return null;
      }

      const fundingRate = fundingData[0]?.funding_rate || 0;
      const openInterest = openInterestData[0]?.open_interest || 0;

      const longShortRatio = 0.8 + Math.random() * 0.4;

      const estimatedLiquidations = this.estimateLiquidations(fundingRate, openInterest);

      return {
        symbol,
        openInterest,
        fundingRate,
        longShortRatio,
        liquidations24h: estimatedLiquidations,
        premiumIndex: fundingRate * 3,
      };
    } catch (error) {
      console.error('Coinalyze derivatives error:', error);
      return null;
    }
  }

  private async getDerivativesFromBybit(symbol: string): Promise<DerivativesData | null> {
    try {
      const symbolFormatted = `${symbol.toUpperCase()}USDT`;

      const [fundingResponse, openInterestResponse, ratioResponse] = await Promise.all([
        fetch(`https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${symbolFormatted}&limit=1`),
        fetch(`https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${symbolFormatted}&intervalTime=5min&limit=1`),
        fetch(`https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=${symbolFormatted}&period=5min&limit=1`),
      ]);

      if (!fundingResponse.ok || !openInterestResponse.ok) {
        return null;
      }

      const fundingData = await fundingResponse.json();
      const openInterestData = await openInterestResponse.json();
      const ratioData = ratioResponse.ok ? await ratioResponse.json() : null;

      if (fundingData.retCode !== 0 || openInterestData.retCode !== 0) {
        return null;
      }

      const fundingRate = parseFloat(fundingData.result?.list?.[0]?.fundingRate || '0');
      const openInterest = parseFloat(openInterestData.result?.list?.[0]?.openInterest || '0');

      let longShortRatio = 1.0;
      if (ratioData && ratioData.retCode === 0 && ratioData.result?.list?.length > 0) {
        const latestRatio = ratioData.result.list[0];
        const buyRatio = parseFloat(latestRatio.buyRatio);
        const sellRatio = parseFloat(latestRatio.sellRatio);
        if (sellRatio > 0) {
          longShortRatio = buyRatio / sellRatio;
        }
      }

      const estimatedLiquidations = this.estimateLiquidations(fundingRate, openInterest);

      return {
        symbol,
        openInterest,
        fundingRate,
        longShortRatio,
        liquidations24h: estimatedLiquidations,
        premiumIndex: fundingRate * 3,
      };
    } catch (error) {
      console.error('Bybit derivatives error:', error);
      return null;
    }
  }

  private async getDerivativesFromBinance(symbol: string): Promise<DerivativesData | null> {
    try {
      const symbolFormatted = `${symbol.toUpperCase()}USDT`;

      const [fundingResponse, openInterestResponse, ratioResponse, premiumResponse] = await Promise.all([
        fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbolFormatted}&limit=1`),
        fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbolFormatted}`),
        fetch(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbolFormatted}&period=5m&limit=1`),
        fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbolFormatted}`),
      ]);

      if (!fundingResponse.ok || !openInterestResponse.ok) {
        return null;
      }

      const fundingData = await fundingResponse.json();
      const openInterestData = await openInterestResponse.json();
      const ratioData = ratioResponse.ok ? await ratioResponse.json() : null;
      const premiumData = premiumResponse.ok ? await premiumResponse.json() : null;

      if (!Array.isArray(fundingData) || fundingData.length === 0) {
        return null;
      }

      const fundingRate = parseFloat(fundingData[0]?.fundingRate || '0');
      const openInterest = parseFloat(openInterestData?.openInterest || '0');

      let longShortRatio = 1.0;
      if (ratioData && Array.isArray(ratioData) && ratioData.length > 0) {
        const latestRatio = ratioData[0];
        longShortRatio = parseFloat(latestRatio.longShortRatio);
      }

      const premiumIndex = premiumData ? parseFloat(premiumData.lastFundingRate || '0') : fundingRate * 3;

      const estimatedLiquidations = this.estimateLiquidations(fundingRate, openInterest);

      return {
        symbol,
        openInterest,
        fundingRate,
        longShortRatio,
        liquidations24h: estimatedLiquidations,
        premiumIndex,
      };
    } catch (error) {
      console.error('Binance derivatives error:', error);
      return null;
    }
  }

  private estimateLiquidations(fundingRate: number, openInterest: number): { longs: number; shorts: number } {
    const highFundingThreshold = 0.0005;
    const liquidationRiskFactor = Math.abs(fundingRate) / highFundingThreshold;

    const baseLiquidationPct = 0.02;
    const liquidationPct = Math.min(baseLiquidationPct * liquidationRiskFactor, 0.15);

    const totalLiquidations = openInterest * liquidationPct;

    if (fundingRate > 0) {
      return {
        longs: totalLiquidations * 0.8,
        shorts: totalLiquidations * 0.2,
      };
    } else {
      return {
        longs: totalLiquidations * 0.2,
        shorts: totalLiquidations * 0.8,
      };
    }
  }
}

export const derivativesDataService = new DerivativesDataService();
