interface TokenMetricsData {
  symbol: string;
  supported: boolean;
  rating?: {
    overall: number;
    trader: number;
    investor: number;
  };
  aiPrediction?: {
    price7d: number;
    price30d: number;
    confidence: number;
  };
  technicalScore?: number;
  fundamentalScore?: number;
  recommendation?: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
}

class TokenMetricsService {
  private apiKey: string;
  private baseUrl = 'https://api.tokenmetrics.com/v2';

  constructor() {
    this.apiKey = Deno.env.get('TOKENMETRICS_API_KEY') || '';
  }

  async getTokenData(symbol: string): Promise<TokenMetricsData | null> {
    if (!this.apiKey) {
      console.warn('TokenMetrics API key not set');
      return {
        symbol,
        supported: false,
      };
    }

    try {
      console.log(`📊 Fetching TokenMetrics data for ${symbol}...`);

      const [rating, prediction, technicals] = await Promise.all([
        this.getTokenRating(symbol),
        this.getAIPrediction(symbol),
        this.getTechnicalScore(symbol),
      ]);

      if (!rating && !prediction && !technicals) {
        console.log(`⚠️ TokenMetrics: No data available for ${symbol}`);
        return {
          symbol,
          supported: false,
        };
      }

      const recommendation = this.determineRecommendation(rating, technicals);

      console.log(`✅ TokenMetrics: Data retrieved for ${symbol} - ${recommendation || 'N/A'}`);

      return {
        symbol,
        supported: true,
        rating,
        aiPrediction: prediction,
        technicalScore: technicals,
        recommendation,
      };
    } catch (error) {
      console.error(`TokenMetrics error for ${symbol}:`, error);
      return {
        symbol,
        supported: false,
      };
    }
  }

  private async getTokenRating(symbol: string): Promise<any | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/tokens/ratings/${symbol.toLowerCase()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      if (data && data.data) {
        return {
          overall: data.data.overall_rating || 0,
          trader: data.data.trader_grade || 0,
          investor: data.data.investor_grade || 0,
        };
      }

      return null;
    } catch (error) {
      console.error('TokenMetrics rating error:', error);
      return null;
    }
  }

  private async getAIPrediction(symbol: string): Promise<any | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/predictions/${symbol.toLowerCase()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      if (data && data.data) {
        return {
          price7d: data.data.price_prediction_7d || 0,
          price30d: data.data.price_prediction_30d || 0,
          confidence: data.data.confidence_score || 0,
        };
      }

      return null;
    } catch (error) {
      console.error('TokenMetrics prediction error:', error);
      return null;
    }
  }

  private async getTechnicalScore(symbol: string): Promise<number | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/tokens/technical/${symbol.toLowerCase()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data?.data?.technical_score || null;
    } catch (error) {
      console.error('TokenMetrics technical error:', error);
      return null;
    }
  }

  private determineRecommendation(
    rating: any,
    technicalScore: number | null
  ): 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' | null {
    if (!rating && !technicalScore) {
      return null;
    }

    const overallRating = rating?.overall || 0;
    const technical = technicalScore || 0;

    const avgScore = (overallRating + technical) / 2;

    if (avgScore >= 80) return 'STRONG_BUY';
    if (avgScore >= 65) return 'BUY';
    if (avgScore >= 35) return 'HOLD';
    if (avgScore >= 20) return 'SELL';
    return 'STRONG_SELL';
  }
}

export const tokenMetricsService = new TokenMetricsService();
