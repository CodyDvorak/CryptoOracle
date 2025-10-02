import aiohttp
import asyncio
from typing import List, Dict, Optional
from datetime import datetime, timedelta, timezone
import logging

logger = logging.getLogger(__name__)

class CryptoCompareClient:
    """CryptoCompare API client for crypto market data (free, generous limits)."""
    
    def __init__(self):
        self.base_url = 'https://min-api.cryptocompare.com/data'
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self):
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session
    
    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def get_all_coins(self, max_coins: int = 100) -> List[tuple]:
        """Fetch top coins by market cap from CryptoCompare.
        
        Args:
            max_coins: Maximum number of coins to fetch (uses pagination if > 100)
        
        Returns list of tuples: (symbol, name, current_price_usd)
        """
        try:
            # If requesting more than 100, use pagination
            if max_coins > 100:
                return await self._get_coins_with_pagination(max_coins)
            
            # Standard single request for <= 100 coins
            session = await self._get_session()
            
            url = f'{self.base_url}/top/mktcapfull'
            params = {
                'limit': min(max_coins, 100),  # API max is 100
                'tsym': 'USD'
            }
            
            async with session.get(url, params=params, timeout=30) as response:
                if response.status == 200:
                    data = await response.json()
                    coins = []
                    
                    if data.get('Message') == 'Success':
                        for item in data.get('Data', []):
                            coin_info = item.get('CoinInfo', {})
                            raw_data = item.get('RAW', {}).get('USD', {})
                            
                            symbol = coin_info.get('Name')
                            full_name = coin_info.get('FullName')
                            price = raw_data.get('PRICE', 0)
                            
                            if symbol and price > 0:
                                coins.append((symbol, full_name or symbol, price))
                        
                        logger.info(f"Fetched {len(coins)} coins from CryptoCompare")
                        return coins
                    else:
                        logger.error(f"CryptoCompare API error: {data.get('Message')}")
                        return []
                else:
                    logger.error(f"CryptoCompare API HTTP error: {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"Exception fetching CryptoCompare coins: {e}")
            return []
    
    async def _get_coins_with_pagination(self, max_coins: int) -> List[tuple]:
        """Fetch coins using pagination (multiple API calls for > 100 coins).
        
        Args:
            max_coins: Total number of coins to fetch
            
        Returns list of tuples: (symbol, name, current_price_usd)
        """
        try:
            session = await self._get_session()
            all_coins = []
            seen_symbols = set()
            
            # Calculate number of pages needed (100 coins per page)
            num_pages = (max_coins + 99) // 100  # Ceiling division
            logger.info(f"🔄 Pagination: Fetching {max_coins} coins across {num_pages} pages...")
            
            for page in range(num_pages):
                url = f'{self.base_url}/top/mktcapfull'
                params = {
                    'limit': 100,
                    'tsym': 'USD',
                    'page': page
                }
                
                try:
                    async with session.get(url, params=params, timeout=30) as response:
                        if response.status == 200:
                            data = await response.json()
                            
                            if data.get('Message') == 'Success':
                                page_coins = 0
                                for item in data.get('Data', []):
                                    coin_info = item.get('CoinInfo', {})
                                    raw_data = item.get('RAW', {}).get('USD', {})
                                    
                                    symbol = coin_info.get('Name')
                                    full_name = coin_info.get('FullName')
                                    price = raw_data.get('PRICE', 0)
                                    
                                    # Avoid duplicates and ensure valid data
                                    if symbol and price > 0 and symbol not in seen_symbols:
                                        all_coins.append((symbol, full_name or symbol, price))
                                        seen_symbols.add(symbol)
                                        page_coins += 1
                                        
                                        # Stop if we've reached max_coins
                                        if len(all_coins) >= max_coins:
                                            break
                                
                                logger.info(f"  Page {page + 1}/{num_pages}: +{page_coins} coins (total: {len(all_coins)})")
                            else:
                                logger.warning(f"Page {page + 1} error: {data.get('Message')}")
                        else:
                            logger.warning(f"Page {page + 1} HTTP error: {response.status}")
                        
                        # Stop if we've reached max_coins
                        if len(all_coins) >= max_coins:
                            break
                        
                        # Small delay between requests to be nice to the API
                        await asyncio.sleep(0.5)
                        
                except Exception as e:
                    logger.error(f"Error fetching page {page + 1}: {e}")
                    continue
            
            logger.info(f"✅ Pagination complete: Fetched {len(all_coins)} total coins")
            return all_coins[:max_coins]  # Ensure we don't exceed max_coins
            
        except Exception as e:
            logger.error(f"Exception in pagination: {e}")
            return []
    
    async def get_historical_data(self, symbol: str, days: int = 365) -> List[Dict]:
        """Get historical daily OHLCV data.
        
        Args:
            symbol: Coin symbol (e.g., 'BTC')
            days: Number of days of historical data
        
        Returns:
            List of candle dicts with timestamp, open, high, low, close, volume
        """
        try:
            session = await self._get_session()
            
            # CryptoCompare histoday endpoint
            url = f'{self.base_url}/v2/histoday'
            params = {
                'fsym': symbol,
                'tsym': 'USD',
                'limit': days,  # Number of data points
                'toTs': int(datetime.now(timezone.utc).timestamp())
            }
            
            async with session.get(url, params=params, timeout=30) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    if data.get('Response') == 'Success':
                        raw_data = data.get('Data', {}).get('Data', [])
                        candles = []
                        
                        for candle in raw_data:
                            if candle.get('close', 0) > 0:
                                candles.append({
                                    'timestamp': candle.get('time'),
                                    'open': float(candle.get('open', 0)),
                                    'high': float(candle.get('high', 0)),
                                    'low': float(candle.get('low', 0)),
                                    'close': float(candle.get('close', 0)),
                                    'volume': float(candle.get('volumeto', 0))
                                })
                        
                        logger.info(f"Fetched {len(candles)} candles from CryptoCompare for {symbol}")
                        return candles
                    else:
                        logger.warning(f"CryptoCompare API error for {symbol}: {data.get('Message')}")
                        return []
                else:
                    logger.warning(f"CryptoCompare API HTTP error for {symbol}: {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"Exception fetching CryptoCompare historical data for {symbol}: {e}")
            return []
