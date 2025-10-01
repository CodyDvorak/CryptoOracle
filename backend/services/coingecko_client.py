import aiohttp
import asyncio
from typing import List, Dict, Optional
from datetime import datetime, timedelta, timezone
import logging

logger = logging.getLogger(__name__)

class CoinGeckoClient:
    """CoinGecko API client for accurate real-time crypto data (free, no key required)."""
    
    def __init__(self):
        self.base_url = 'https://api.coingecko.com/api/v3'
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self):
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session
    
    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def get_top_coins(self, limit: int = 500) -> List[Dict]:
        """Fetch top coins by market cap with current prices.
        
        Returns list of dicts with: id, symbol, name, current_price, market_cap
        """
        try:
            session = await self._get_session()
            
            url = f'{self.base_url}/coins/markets'
            params = {
                'vs_currency': 'usd',
                'order': 'market_cap_desc',
                'per_page': min(limit, 250),  # CoinGecko max per page
                'page': 1,
                'sparkline': 'false',  # String instead of boolean
                'locale': 'en'
            }
            
            all_coins = []
            
            # Fetch multiple pages if needed
            for page in range(1, (limit // 250) + 2):
                params['page'] = page
                
                async with session.get(url, params=params, timeout=30) as response:
                    if response.status == 200:
                        data = await response.json()
                        if not data:
                            break
                        all_coins.extend(data)
                        if len(all_coins) >= limit or len(data) < 250:
                            break
                    else:
                        logger.error(f"CoinGecko API error: {response.status}")
                        break
                
                # Rate limiting - CoinGecko free tier: 10-30 calls/min
                await asyncio.sleep(2)
            
            logger.info(f"Fetched {len(all_coins)} coins from CoinGecko")
            return all_coins[:limit]
            
        except Exception as e:
            logger.error(f"Exception fetching coins from CoinGecko: {e}")
            return []
    
    async def get_coin_data(self, coin_id: str) -> Optional[Dict]:
        """Get detailed data for a specific coin including price and market data."""
        try:
            session = await self._get_session()
            
            url = f'{self.base_url}/coins/{coin_id}'
            params = {
                'localization': False,
                'tickers': False,
                'market_data': True,
                'community_data': False,
                'developer_data': False,
                'sparkline': False
            }
            
            async with session.get(url, params=params, timeout=30) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    logger.warning(f"Could not fetch data for {coin_id}: {response.status}")
                    return None
                    
        except Exception as e:
            logger.error(f"Exception fetching {coin_id}: {e}")
            return None
    
    async def get_historical_ohlc(self, coin_id: str, days: int = 365) -> List[List]:
        """Get historical OHLC data.
        
        Returns list of [timestamp, open, high, low, close]
        Note: CoinGecko free tier provides daily OHLC only
        """
        try:
            session = await self._get_session()
            
            url = f'{self.base_url}/coins/{coin_id}/ohlc'
            params = {
                'vs_currency': 'usd',
                'days': days
            }
            
            async with session.get(url, params=params, timeout=30) as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info(f"Fetched {len(data)} OHLC candles for {coin_id}")
                    return data
                else:
                    logger.warning(f"Could not fetch OHLC for {coin_id}: {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"Exception fetching OHLC for {coin_id}: {e}")
            return []
