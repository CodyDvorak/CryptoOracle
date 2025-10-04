interface SentimentData {
  symbol: string;
  sources: {
    reddit?: SentimentScore;
    cryptopanic?: SentimentScore;
    news?: SentimentScore;
  };
  aggregatedScore: number;
  aggregatedVolume: number;
  sentiment: 'VERY_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'VERY_BEARISH';
  confidence: number;
}

interface SentimentScore {
  score: number;
  volume: number;
  summary: string;
}

class SocialSentimentService {
  private cryptoPanicKey = 'adf2d5386a8db134bfe7700259f7fab178705324';
  private newsApiKey = '2841426678d04402b8a9dd54677dbca3';

  async getSentiment(symbol: string): Promise<SentimentData | null> {
    try {
      const [reddit, cryptopanic, news] = await Promise.all([
        this.getRedditSentiment(symbol),
        this.getCryptoPanicSentiment(symbol),
        this.getNewsSentiment(symbol),
      ]);

      const sources: any = {};
      const scores: number[] = [];
      const volumes: number[] = [];

      if (reddit) {
        sources.reddit = reddit;
        scores.push(reddit.score);
        volumes.push(reddit.volume);
      }

      if (cryptopanic) {
        sources.cryptopanic = cryptopanic;
        scores.push(cryptopanic.score);
        volumes.push(cryptopanic.volume);
      }

      if (news) {
        sources.news = news;
        scores.push(news.score);
        volumes.push(news.volume);
      }

      if (scores.length === 0) {
        return null;
      }

      const aggregatedScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const aggregatedVolume = volumes.reduce((a, b) => a + b, 0);

      let sentiment: SentimentData['sentiment'] = 'NEUTRAL';
      if (aggregatedScore > 0.6) sentiment = 'VERY_BULLISH';
      else if (aggregatedScore > 0.2) sentiment = 'BULLISH';
      else if (aggregatedScore < -0.6) sentiment = 'VERY_BEARISH';
      else if (aggregatedScore < -0.2) sentiment = 'BEARISH';

      const confidence = Math.min(aggregatedVolume / 1000, 1.0);

      return {
        symbol,
        sources,
        aggregatedScore,
        aggregatedVolume,
        sentiment,
        confidence,
      };
    } catch (error) {
      console.error('Social sentiment error:', error);
      return null;
    }
  }

  private async getRedditSentiment(symbol: string): Promise<SentimentScore | null> {
    try {
      const subreddits = ['CryptoCurrency', 'Bitcoin', 'ethereum', 'altcoin'];
      const query = `${symbol} OR ${this.getCoinName(symbol)}`;

      const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(
        query
      )}&sort=new&limit=100`;

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'CryptoOracle/1.0',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const posts = data.data?.children || [];

      if (posts.length === 0) {
        return null;
      }

      let totalScore = 0;
      let totalPosts = 0;

      posts.forEach((post: any) => {
        const p = post.data;
        const score = p.score || 0;
        const comments = p.num_comments || 0;

        const positiveWords = ['bullish', 'moon', 'buy', 'pump', 'up', 'gain', 'profit'];
        const negativeWords = ['bearish', 'dump', 'sell', 'down', 'loss', 'crash'];

        const title = (p.title || '').toLowerCase();
        const body = (p.selftext || '').toLowerCase();
        const text = title + ' ' + body;

        let sentiment = 0;
        positiveWords.forEach(word => {
          if (text.includes(word)) sentiment += 0.1;
        });
        negativeWords.forEach(word => {
          if (text.includes(word)) sentiment -= 0.1;
        });

        if (score > 100) {
          totalScore += sentiment * (score / 100);
        } else {
          totalScore += sentiment;
        }
        totalPosts++;
      });

      const avgScore = totalPosts > 0 ? totalScore / totalPosts : 0;
      const normalizedScore = Math.max(-1, Math.min(1, avgScore));

      return {
        score: normalizedScore,
        volume: totalPosts,
        summary: `${totalPosts} Reddit posts analyzed`,
      };
    } catch (error) {
      console.error('Reddit sentiment error:', error);
      return null;
    }
  }

  private async getCryptoPanicSentiment(symbol: string): Promise<SentimentScore | null> {
    try {
      const currencies = this.getCryptoPanicCurrency(symbol);
      if (!currencies) return null;

      const response = await fetch(
        `https://cryptopanic.com/api/v1/posts/?auth_token=${this.cryptoPanicKey}&currencies=${currencies}&public=true`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const posts = data.results || [];

      if (posts.length === 0) {
        return null;
      }

      let totalSentiment = 0;
      let count = 0;

      posts.forEach((post: any) => {
        const votes = post.votes || {};
        const positive = votes.positive || 0;
        const negative = votes.negative || 0;
        const important = votes.important || 0;
        const liked = votes.liked || 0;
        const disliked = votes.disliked || 0;

        const sentiment = (positive + liked + important - negative - disliked) / Math.max(1, positive + negative + liked + disliked + important);
        totalSentiment += sentiment;
        count++;
      });

      const avgSentiment = count > 0 ? totalSentiment / count : 0;

      return {
        score: avgSentiment,
        volume: count,
        summary: `${count} CryptoPanic news items`,
      };
    } catch (error) {
      console.error('CryptoPanic error:', error);
      return null;
    }
  }

  private async getNewsSentiment(symbol: string): Promise<SentimentScore | null> {
    try {
      const query = `${this.getCoinName(symbol)} OR ${symbol}`;
      const response = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(
          query
        )}&sortBy=publishedAt&language=en&apiKey=${this.newsApiKey}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const articles = data.articles || [];

      if (articles.length === 0) {
        return null;
      }

      let totalSentiment = 0;
      let count = 0;

      const positiveWords = ['surge', 'rally', 'gain', 'rise', 'bull', 'soar', 'climb'];
      const negativeWords = ['plunge', 'crash', 'drop', 'fall', 'bear', 'decline', 'sink'];

      articles.forEach((article: any) => {
        const title = (article.title || '').toLowerCase();
        const description = (article.description || '').toLowerCase();
        const text = title + ' ' + description;

        let sentiment = 0;
        positiveWords.forEach(word => {
          if (text.includes(word)) sentiment += 0.15;
        });
        negativeWords.forEach(word => {
          if (text.includes(word)) sentiment -= 0.15;
        });

        totalSentiment += sentiment;
        count++;
      });

      const avgSentiment = count > 0 ? totalSentiment / count : 0;
      const normalizedScore = Math.max(-1, Math.min(1, avgSentiment));

      return {
        score: normalizedScore,
        volume: count,
        summary: `${count} news articles analyzed`,
      };
    } catch (error) {
      console.error('NewsAPI error:', error);
      return null;
    }
  }

  private getCoinName(symbol: string): string {
    const map: Record<string, string> = {
      'BTC': 'Bitcoin',
      'ETH': 'Ethereum',
      'SOL': 'Solana',
      'BNB': 'Binance',
      'XRP': 'Ripple',
      'ADA': 'Cardano',
      'DOGE': 'Dogecoin',
      'MATIC': 'Polygon',
      'DOT': 'Polkadot',
      'AVAX': 'Avalanche',
    };
    return map[symbol.toUpperCase()] || symbol;
  }

  private getCryptoPanicCurrency(symbol: string): string | null {
    const map: Record<string, string> = {
      'BTC': 'BTC',
      'ETH': 'ETH',
      'SOL': 'SOL',
      'BNB': 'BNB',
      'XRP': 'XRP',
      'ADA': 'ADA',
      'DOGE': 'DOGE',
      'MATIC': 'MATIC',
      'DOT': 'DOT',
      'AVAX': 'AVAX',
    };
    return map[symbol.toUpperCase()] || null;
  }
}

export const socialSentimentService = new SocialSentimentService();
