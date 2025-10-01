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
    
    async def get_all_coins(self) -> List[tuple]:
        """Fetch top coins by market cap from CryptoCompare.
        
        Returns list of tuples: (symbol, name, current_price_usd)
        """
        try:
            session = await self._get_session()
            
            # Fetch top 100 coins by market cap
            url = f'{self.base_url}/top/mktcapfull'
            params = {
                'limit': 100,
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
