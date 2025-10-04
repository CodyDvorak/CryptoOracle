import aiohttp
import asyncio
from typing import List, Dict, Optional
from datetime import datetime, timezone, timedelta
import logging

logger = logging.getLogger(__name__)

class CoinMarketCapClient:
    """CoinMarketCap API client for crypto market data.
    
    Uses CoinMarketCap Pro API with API key.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        self.base_url = 'https://pro-api.coinmarketcap.com/v1'
        self.api_key = api_key
        self.session: Optional[aiohttp.ClientSession] = None
        self.provider_name = "CoinMarketCap"
        
        # Cache for CMC ID mapping (symbol -> CMC ID)
        self.symbol_id_cache = {}
    
    async def _get_session(self):
        if self.session is None or self.session.closed:
            headers = {}
            if self.api_key:
                headers['X-CMC_PRO_API_KEY'] = self.api_key
            self.session = aiohttp.ClientSession(headers=headers)
        return self.session
    
    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def get_all_coins(self, max_coins: int = 100) -> List[tuple]:
        """Fetch top coins by market cap from CoinMarketCap.
        
        Args:
            max_coins: Maximum number of coins to fetch
        
        Returns list of tuples: (symbol, name, current_price_usd)
        """
        try:
            session = await self._get_session()
            
            url = f'{self.base_url}/cryptocurrency/listings/latest'
            params = {
                'start': '1',
                'limit': min(max_coins, 5000),  # CMC allows up to 5000
                'convert': 'USD',
                'sort': 'market_cap',
                'sort_dir': 'desc'
            }
            
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=15)) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    coins = []
                    for coin in data.get('data', []):
                        symbol = coin.get('symbol', '').upper()
                        name = coin.get('name', '')
                        quote = coin.get('quote', {}).get('USD', {})
                        price = quote.get('price', 0)
                        cmc_id = coin.get('id')
                        
                        if symbol and price and price > 0:
                            coins.append((symbol, name, price))
                            # Cache CMC ID for later use
                            if cmc_id:
                                self.symbol_id_cache[symbol] = cmc_id
                        
                        if len(coins) >= max_coins:
                            break
                    
                    logger.info(f"✅ CoinMarketCap: Fetched {len(coins)} coins")
                    return coins
                
                elif response.status == 429:
                    error_text = await response.text()
                    logger.warning(f"CoinMarketCap rate limit hit: {error_text}")
                    raise Exception("Rate limit exceeded")
                else:
                    error_text = await response.text()
                    logger.error(f"CoinMarketCap API error {response.status}: {error_text}")
                    raise Exception(f"API error: {response.status}")
                    
        except Exception as e:
            logger.error(f"CoinMarketCap exception: {e}")
            raise
    
    async def get_historical_data(self, symbol: str, days: int = 30) -> List[Dict]:
        """Fetch historical OHLC data for a coin.
        
        Note: CoinMarketCap historical OHLC data requires enterprise plan.
        This method uses quotes/historical endpoint for basic historical data.
        
        Args:
            symbol: Coin symbol (e.g., 'BTC')
            days: Number of days of historical data
        
        Returns list of dicts with OHLCV data
        """
        try:
            session = await self._get_session()
            
            # Get CMC ID for the symbol
            cmc_id = await self._get_cmc_id(symbol)
            if not cmc_id:
                logger.warning(f"CoinMarketCap: Could not find CMC ID for {symbol}")
                return []
            
            # CMC historical quotes endpoint (daily data points)
            url = f'{self.base_url}/cryptocurrency/quotes/historical'
            
            # Calculate time range
            from datetime import timedelta
            end_time = datetime.now(timezone.utc)
            start_time = end_time - timedelta(days=days)
            
            params = {
                'id': cmc_id,
                'time_start': int(start_time.timestamp()),
                'time_end': int(end_time.timestamp()),
                'interval': 'daily',  # or '1d', '1h' for more granular
                'convert': 'USD'
            }
            
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=15)) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    historical_data = []
                    quotes = data.get('data', {}).get('quotes', [])
                    
                    for quote in quotes:
                        timestamp = quote.get('timestamp')
                        usd_quote = quote.get('quote', {}).get('USD', {})
                        
                        if timestamp and usd_quote:
                            # CMC provides limited OHLC in historical quotes
                            # We'll approximate OHLC from price data
                            price = usd_quote.get('price', 0)
                            volume = usd_quote.get('volume_24h', 0)
                            
                            # Approximate OHLC (not perfect but workable)
                            historical_data.append({
                                'timestamp': int(datetime.fromisoformat(timestamp.replace('Z', '+00:00')).timestamp()),
                                'open': price,
                                'high': price * 1.01,  # Approximate
                                'low': price * 0.99,   # Approximate
                                'close': price,
                                'volume': volume
                            })
                    
                    logger.info(f"CoinMarketCap: Fetched {len(historical_data)} data points for {symbol}")
                    return historical_data
                
                elif response.status == 429:
                    logger.warning(f"CoinMarketCap rate limit hit for historical data")
                    raise Exception("Rate limit exceeded")
                else:
                    logger.warning(f"CoinMarketCap historical data error {response.status} for {symbol}")
                    return []
                    
        except Exception as e:
            logger.error(f"CoinMarketCap historical data exception for {symbol}: {e}")
            raise
    
    async def get_4h_candles(self, symbol: str, limit: int = 168) -> List[Dict]:
        """Get 4-hour candles (7 days = 168 4h periods).
        
        Phase 4: Multi-timeframe analysis
        Note: CMC may not support 4h interval directly, so we'll use hourly and aggregate
        """
        try:
            cmc_id = await self._get_cmc_id(symbol)
            if not cmc_id:
                return []
            
            # Fetch hourly data and aggregate to 4h
            # Note: CoinMarketCap historical OHLCV requires enterprise plan
            # For now, we'll use quotes/historical and approximate 4h candles
            url = f"{self.base_url}/cryptocurrency/quotes/historical"
            end_time = datetime.now(timezone.utc)
            start_time = end_time - timedelta(days=7)  # Last 7 days
            
            params = {
                'id': cmc_id,
                'time_start': int(start_time.timestamp()),
                'time_end': int(end_time.timestamp()),
                'interval': 'hourly',  # Fetch hourly, aggregate to 4h
                'convert': 'USD'
            }
            
            session = await self._get_session()
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=15)) as response:
                    if response.status == 200:
                        data = await response.json()
                        quotes = data.get('data', {}).get('quotes', [])
                        
                        # Aggregate hourly to 4h candles
                        candles_4h = []
                        for i in range(0, len(quotes), 4):  # Every 4 hours
                            chunk = quotes[i:i+4]
                            if len(chunk) < 4:
                                continue
                            
                            # Aggregate OHLCV
                            opens = [q.get('quote', {}).get('USD', {}).get('open', 0) for q in chunk]
                            highs = [q.get('quote', {}).get('USD', {}).get('high', 0) for q in chunk]
                            lows = [q.get('quote', {}).get('USD', {}).get('low', 0) for q in chunk]
                            closes = [q.get('quote', {}).get('USD', {}).get('close', 0) for q in chunk]
                            volumes = [q.get('quote', {}).get('USD', {}).get('volume', 0) for q in chunk]
                            
                            candles_4h.append({
                                'timestamp': int(datetime.fromisoformat(chunk[0].get('timestamp').replace('Z', '+00:00')).timestamp()),
                                'open': opens[0] if opens else 0,
                                'high': max(highs) if highs else 0,
                                'low': min(lows) if lows else 0,
                                'close': closes[-1] if closes else 0,
                                'volume': sum(volumes) if volumes else 0
                            })
                        
                        logger.info(f"CoinMarketCap: Aggregated {len(candles_4h)} 4h candles for {symbol}")
                        return candles_4h[-limit:] if len(candles_4h) > limit else candles_4h
                    else:
                        logger.warning(f"CoinMarketCap 4h candles error {response.status} for {symbol}")
                        return []
        except Exception as e:
            logger.error(f"CoinMarketCap 4h candles exception for {symbol}: {e}")
            return []
    
    async def _get_cmc_id(self, symbol: str) -> Optional[int]:
        """Get CoinMarketCap ID from symbol.
        
        Uses cache first, then queries CMC map endpoint.
        """
        # Check cache first
        if symbol in self.symbol_id_cache:
            return self.symbol_id_cache[symbol]
        
        try:
            session = await self._get_session()
            
            url = f'{self.base_url}/cryptocurrency/map'
            params = {
                'symbol': symbol.upper(),
                'limit': 1
            }
            
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=15)) as response:
                if response.status == 200:
                    data = await response.json()
                    coins = data.get('data', [])
                    
                    if coins and len(coins) > 0:
                        cmc_id = coins[0].get('id')
                        # Cache for future use
                        self.symbol_id_cache[symbol] = cmc_id
                        return cmc_id
                    
                    logger.warning(f"CoinMarketCap: No CMC ID found for symbol {symbol}")
                    return None
                else:
                    logger.error(f"CoinMarketCap map error: {response.status}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error getting CoinMarketCap ID for {symbol}: {e}")
            return None
