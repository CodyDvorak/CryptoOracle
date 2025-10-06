const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const symbol = url.searchParams.get('symbol') || 'BTC';

    const coinNames: Record<string, string> = {
      'BTC': 'Bitcoin',
      'ETH': 'Ethereum',
      'SOL': 'Solana',
      'ADA': 'Cardano',
      'DOT': 'Polkadot',
      'LINK': 'Chainlink',
      'MATIC': 'Polygon',
      'AVAX': 'Avalanche',
      'UNI': 'Uniswap',
      'ATOM': 'Cosmos',
      'BNB': 'Binance',
      'XRP': 'Ripple',
      'DOGE': 'Dogecoin',
      'LTC': 'Litecoin',
    };

    const searchTerm = coinNames[symbol] || symbol;

    const cryptopanicUrl = `https://cryptopanic.com/api/v1/posts/?auth_token=free&currencies=${symbol}&public=true`;
    const response = await fetch(cryptopanicUrl);

    if (!response.ok) {
      throw new Error('Failed to fetch news from CryptoPanic');
    }

    const data = await response.json();

    const analyzeSentiment = (text: string): string => {
      const bullishWords = ['surge', 'rally', 'gain', 'rise', 'jump', 'soar', 'bullish', 'breakthrough', 'adoption', 'upgrade', 'partnership', 'growth', 'positive', 'optimistic', 'success'];
      const bearishWords = ['crash', 'plunge', 'drop', 'fall', 'decline', 'bearish', 'concern', 'warning', 'risk', 'trouble', 'loss', 'negative', 'pessimistic', 'failure', 'hack'];

      const lowerText = text.toLowerCase();
      let score = 0;

      bullishWords.forEach(word => {
        if (lowerText.includes(word)) score += 1;
      });

      bearishWords.forEach(word => {
        if (lowerText.includes(word)) score -= 1;
      });

      if (score > 0) return 'bullish';
      if (score < 0) return 'bearish';
      return 'neutral';
    };

    const articles = (data.results || []).slice(0, 15).map((item: any) => ({
      title: item.title,
      description: item.title,
      url: item.url,
      urlToImage: null,
      publishedAt: item.published_at || item.created_at,
      source: { name: item.source?.title || 'CryptoPanic' },
      author: null,
      sentiment: analyzeSentiment(item.title),
    }));

    return new Response(
      JSON.stringify({
        success: true,
        articles,
        count: articles.length,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Crypto news error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        articles: [],
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});