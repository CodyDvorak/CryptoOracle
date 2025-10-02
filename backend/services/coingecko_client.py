import aiohttp
import asyncio
from typing import List, Dict, Optional
from datetime import datetime, timedelta, timezone
import logging
import os

logger = logging.getLogger(__name__)

class CoinGeckoClient:
    """CoinGecko API client for crypto market data."""
    
    def __init__(self, api_key: Optional[str] = None):
        self.base_url = 'https://api.coingecko.com/api/v3'
        self.api_key = api_key or os.getenv('COINGECKO_API_KEY')
        self.session: Optional[aiohttp.ClientSession] = None
        self.provider_name = "CoinGecko"
    
    async def _get_session(self):
        if self.session is None or self.session.closed:
            headers = {}
            if self.api_key:
                headers['x-cg-demo-api-key'] = self.api_key
            self.session = aiohttp.ClientSession(headers=headers)
        return self.session
    
    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def get_all_coins(self, max_coins: int = 100) -> List[tuple]:
        """Fetch top coins by market cap from CoinGecko.
        
        Args:
            max_coins: Maximum number of coins to fetch
        
        Returns list of tuples: (symbol, name, current_price_usd)
        """
        try:
            session = await self._get_session()
            
            # CoinGecko uses pagination with per_page parameter
            # We'll fetch in batches of 250 (CoinGecko's max per page)
            all_coins = []
            per_page = min(250, max_coins)
            pages_needed = (max_coins + per_page - 1) // per_page
            
            for page in range(1, pages_needed + 1):
                url = f'{self.base_url}/coins/markets'
                params = {
                    'vs_currency': 'usd',
                    'order': 'market_cap_desc',
                    'per_page': per_page,
                    'page': page,
                    'sparkline': 'false'
                }
                
                async with session.get(url, params=params, timeout=30) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        for coin in data:
                            symbol = coin.get('symbol', '').upper()
                            name = coin.get('name', '')
                            price = coin.get('current_price', 0)
                            
                            if symbol and price and price > 0:
                                all_coins.append((symbol, name, price))
                                
                                if len(all_coins) >= max_coins:
                                    break
                        
                        if len(all_coins) >= max_coins:
                            break
                        
                        # Small delay between pages to respect rate limits
                        if page < pages_needed:
                            await asyncio.sleep(0.5)
                    
                    elif response.status == 429:
                        error_text = await response.text()
                        logger.warning(f"CoinGecko rate limit hit: {error_text}")
                        raise Exception("Rate limit exceeded")
                    else:
                        error_text = await response.text()
                        logger.error(f"CoinGecko API error {response.status}: {error_text}")
                        raise Exception(f"API error: {response.status}")
            
            logger.info(f"✅ CoinGecko: Fetched {len(all_coins)} coins")
            return all_coins[:max_coins]
                    
        except Exception as e:
            logger.error(f"CoinGecko exception: {e}")
            raise
    
    async def get_historical_data(self, symbol: str, days: int = 30) -> List[tuple]:
        """Fetch historical OHLC data for a coin.
        
        Args:
            symbol: Coin symbol (e.g., 'BTC')
            days: Number of days of historical data
        
        Returns list of tuples: (timestamp, close_price, high, low, open)
        """
        try:
            session = await self._get_session()
            
            # First, get the coin ID from symbol
            coin_id = await self._get_coin_id(symbol)
            if not coin_id:
                logger.warning(f"CoinGecko: Could not find coin ID for {symbol}")
                return []
            
            # Fetch OHLC data
            url = f'{self.base_url}/coins/{coin_id}/ohlc'
            params = {
                'vs_currency': 'usd',
                'days': days
            }
            
            async with session.get(url, params=params, timeout=30) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # CoinGecko OHLC format: [[timestamp, open, high, low, close], ...]
                    # Convert to dictionary format compatible with CryptoCompare
                    historical_data = []
                    for candle in data:
                        timestamp = candle[0] / 1000  # Convert ms to seconds
                        open_price = candle[1]
                        high_price = candle[2]
                        low_price = candle[3]
                        close_price = candle[4]
                        
                        # Return as dictionary to match CryptoCompare format
                        historical_data.append({
                            'time': int(timestamp),
                            'close': close_price,
                            'high': high_price,
                            'low': low_price,
                            'open': open_price
                        })
                    
                    logger.info(f"CoinGecko: Fetched {len(historical_data)} candles for {symbol}")
                    return historical_data
                
                elif response.status == 429:
                    logger.warning(f"CoinGecko rate limit hit for historical data")
                    raise Exception("Rate limit exceeded")
                else:
                    logger.warning(f"CoinGecko historical data error {response.status} for {symbol}")
                    return []
                    
        except Exception as e:
            logger.error(f"CoinGecko historical data exception for {symbol}: {e}")
            raise
    
    async def _get_coin_id(self, symbol: str) -> Optional[str]:
        """Get CoinGecko coin ID from symbol.
        
        CoinGecko uses IDs like 'bitcoin', 'ethereum' instead of symbols.
        """
        try:
            session = await self._get_session()
            
            # Use the coins/list endpoint to map symbol to ID
            url = f'{self.base_url}/coins/list'
            
            async with session.get(url, timeout=30) as response:
                if response.status == 200:
                    coins = await response.json()
                    
                    # Find matching coin by symbol
                    symbol_lower = symbol.lower()
                    for coin in coins:
                        if coin.get('symbol', '').lower() == symbol_lower:
                            return coin.get('id')
                    
                    logger.warning(f"CoinGecko: No coin ID found for symbol {symbol}")
                    return None
                else:
                    logger.error(f"CoinGecko coins/list error: {response.status}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error getting CoinGecko coin ID for {symbol}: {e}")
            return None