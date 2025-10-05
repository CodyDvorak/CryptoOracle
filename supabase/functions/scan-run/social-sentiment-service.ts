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
  trendingTopics?: string[];
  breakingNews?: boolean;
}

interface SentimentScore {
  score: number;
  volume: number;
  summary: string;
  engagement?: number;
  upvoteRatio?: number;
}

class SocialSentimentService {
  private cryptoPanicKey: string;
  private newsApiKey: string;

  private bullishKeywords = [
    'bullish', 'moon', 'buy', 'pump', 'surge', 'rally', 'gain', 'rise',
    'bull', 'soar', 'climb', 'breakthrough', 'adoption', 'partnership',
    'upgrade', 'accumulate', 'green', 'rocket', 'ath', 'breakout'
  ];

  private bearishKeywords = [
    'bearish', 'dump', 'sell', 'plunge', 'crash', 'drop', 'fall', 'bear',
    'decline', 'sink', 'fud', 'scam', 'hack', 'exploit', 'rug', 'red',
    'loss', 'down', 'fear', 'panic'
  ];

  constructor() {
    this.cryptoPanicKey = Deno.env.get('CRYPTOPANIC_API_KEY') || '';
    this.newsApiKey = Deno.env.get('NEWSAPI_API_KEY') || '';
  }

  async getSentiment(symbol: string): Promise<SentimentData | null> {
    try {
      const [reddit, cryptopanic, news] = await Promise.all([
        this.getRedditSentimentWithFallback(symbol),
        this.getCryptoPanicSentimentWithFallback(symbol),
        this.getNewsSentimentWithFallback(symbol),
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
        console.error(`❌ All sentiment providers failed for ${symbol}`);
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

      const trendingTopics = this.extractTrendingTopics(reddit, cryptopanic, news);
      const breakingNews = this.detectBreakingNews(news, cryptopanic);

      console.log(`✅ Sentiment aggregated for ${symbol}: ${sentiment} (confidence: ${(confidence * 100).toFixed(1)}%)`);

      return {
        symbol,
        sources,
        aggregatedScore,
        aggregatedVolume,
        sentiment,
        confidence,
        trendingTopics,
        breakingNews,
      };
    } catch (error) {
      console.error('Social sentiment error:', error);
      return null;
    }
  }

  private async getRedditSentimentWithFallback(symbol: string): Promise<SentimentScore | null> {
    const subreddits = ['CryptoCurrency', 'Bitcoin', 'ethereum', 'CryptoMarkets'];

    for (const subreddit of subreddits) {
      const sentiment = await this.getRedditSentimentFromSubreddit(symbol, subreddit);
      if (sentiment) {
        console.log(`✅ Reddit: Sentiment for ${symbol} from r/${subreddit}`);
        return sentiment;
      }
    }

    console.log(`⚠️ All Reddit sources failed for ${symbol}`);
    return null;
  }

  private async getRedditSentimentFromSubreddit(symbol: string, subreddit: string): Promise<SentimentScore | null> {
    try {
      const coinName = this.getCoinName(symbol);
      const query = `${symbol} OR ${coinName}`;

      const searchUrl = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(
        query
      )}&restrict_sr=on&sort=new&limit=50`;

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'CryptoOracle/2.0',
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
      let totalEngagement = 0;
      let totalUpvoteRatio = 0;

      posts.forEach((post: any) => {
        const p = post.data;
        const score = p.score || 0;
        const comments = p.num_comments || 0;
        const upvoteRatio = p.upvote_ratio || 0.5;

        const title = (p.title || '').toLowerCase();
        const body = (p.selftext || '').toLowerCase();
        const text = title + ' ' + body;

        let sentiment = 0;
        this.bullishKeywords.forEach(word => {
          if (text.includes(word)) sentiment += 0.1;
        });
        this.bearishKeywords.forEach(word => {
          if (text.includes(word)) sentiment -= 0.1;
        });

        const weight = Math.log(score + 1) * (upvoteRatio + 0.1);
        totalScore += sentiment * weight;
        totalEngagement += score + comments;
        totalUpvoteRatio += upvoteRatio;
        totalPosts++;
      });

      const avgScore = totalPosts > 0 ? totalScore / totalPosts : 0;
      const normalizedScore = Math.max(-1, Math.min(1, avgScore));
      const avgUpvoteRatio = totalPosts > 0 ? totalUpvoteRatio / totalPosts : 0.5;

      return {
        score: normalizedScore,
        volume: totalPosts,
        summary: `${totalPosts} posts from r/${subreddit}`,
        engagement: totalEngagement,
        upvoteRatio: avgUpvoteRatio,
      };
    } catch (error) {
      console.error(`Reddit r/${subreddit} error:`, error);
      return null;
    }
  }

  private async getCryptoPanicSentimentWithFallback(symbol: string): Promise<SentimentScore | null> {
    const sentiment = await this.getCryptoPanicSentiment(symbol);
    if (sentiment) {
      console.log(`✅ CryptoPanic: Sentiment for ${symbol}`);
      return sentiment;
    }

    console.log(`⚠️ CryptoPanic failed for ${symbol}`);
    return null;
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
        console.error(`CryptoPanic API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const posts = data.results || [];

      if (posts.length === 0) {
        return null;
      }

      let totalSentiment = 0;
      let count = 0;
      let hotNewsCount = 0;

      posts.forEach((post: any) => {
        const votes = post.votes || {};
        const positive = votes.positive || 0;
        const negative = votes.negative || 0;
        const important = votes.important || 0;
        const liked = votes.liked || 0;
        const disliked = votes.disliked || 0;

        const totalVotes = positive + negative + liked + disliked + important;
        if (totalVotes > 0) {
          const sentiment = (positive + liked + important - negative - disliked) / totalVotes;
          totalSentiment += sentiment;
          count++;
        }

        if (post.metadata?.hot === true) {
          hotNewsCount++;
        }
      });

      const avgSentiment = count > 0 ? totalSentiment / count : 0;

      return {
        score: avgSentiment,
        volume: count,
        summary: `${count} CryptoPanic items (${hotNewsCount} hot)`,
        engagement: hotNewsCount,
      };
    } catch (error) {
      console.error('CryptoPanic error:', error);
      return null;
    }
  }

  private async getNewsSentimentWithFallback(symbol: string): Promise<SentimentScore | null> {
    const sentiment = await this.getNewsSentiment(symbol);
    if (sentiment) {
      console.log(`✅ NewsAPI: Sentiment for ${symbol}`);
      return sentiment;
    }

    console.log(`⚠️ NewsAPI failed for ${symbol}`);
    return null;
  }

  private async getNewsSentiment(symbol: string): Promise<SentimentScore | null> {
    try {
      const coinName = this.getCoinName(symbol);
      const query = `${coinName} cryptocurrency`;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const fromDate = yesterday.toISOString().split('T')[0];

      const response = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(
          query
        )}&from=${fromDate}&sortBy=publishedAt&language=en&apiKey=${this.newsApiKey}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error(`NewsAPI error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const articles = data.articles || [];

      if (articles.length === 0) {
        return null;
      }

      let totalSentiment = 0;
      let count = 0;
      let recentCount = 0;

      const sixHoursAgo = Date.now() - (6 * 60 * 60 * 1000);

      articles.forEach((article: any) => {
        const title = (article.title || '').toLowerCase();
        const description = (article.description || '').toLowerCase();
        const text = title + ' ' + description;

        let sentiment = 0;
        this.bullishKeywords.forEach(word => {
          if (text.includes(word)) sentiment += 0.15;
        });
        this.bearishKeywords.forEach(word => {
          if (text.includes(word)) sentiment -= 0.15;
        });

        totalSentiment += sentiment;
        count++;

        const publishedAt = new Date(article.publishedAt).getTime();
        if (publishedAt > sixHoursAgo) {
          recentCount++;
        }
      });

      const avgSentiment = count > 0 ? totalSentiment / count : 0;
      const normalizedScore = Math.max(-1, Math.min(1, avgSentiment));

      return {
        score: normalizedScore,
        volume: count,
        summary: `${count} news articles (${recentCount} recent)`,
        engagement: recentCount,
      };
    } catch (error) {
      console.error('NewsAPI error:', error);
      return null;
    }
  }

  private extractTrendingTopics(reddit: SentimentScore | null, cryptopanic: SentimentScore | null, news: SentimentScore | null): string[] {
    const topics: string[] = [];

    if (reddit && reddit.upvoteRatio && reddit.upvoteRatio > 0.8) {
      topics.push('High Reddit Engagement');
    }

    if (cryptopanic && cryptopanic.engagement && cryptopanic.engagement > 5) {
      topics.push('Hot on CryptoPanic');
    }

    if (news && news.engagement && news.engagement > 10) {
      topics.push('Breaking News');
    }

    return topics;
  }

  private detectBreakingNews(news: SentimentScore | null, cryptopanic: SentimentScore | null): boolean {
    if (news && news.engagement && news.engagement > 15) {
      return true;
    }

    if (cryptopanic && cryptopanic.engagement && cryptopanic.engagement > 10) {
      return true;
    }

    return false;
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
      'LINK': 'Chainlink',
      'UNI': 'Uniswap',
      'LTC': 'Litecoin',
      'ATOM': 'Cosmos',
      'XLM': 'Stellar',
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
      'LINK': 'LINK',
      'UNI': 'UNI',
      'LTC': 'LTC',
      'ATOM': 'ATOM',
      'XLM': 'XLM',
    };
    return map[symbol.toUpperCase()] || symbol.toUpperCase();
  }
}

export const socialSentimentService = new SocialSentimentService();
