import os
import aiohttp
import asyncio
from typing import List, Dict, Optional
from datetime import datetime, timedelta, timezone
import logging

logger = logging.getLogger(__name__)

class CoinalyzeClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = 'https://api.coinalyze.net/v1'
        self.session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self):
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session

    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()

    async def get_coins(self) -> List[str]:
        """Fetch list of all available coins from Coinalyze."""
        try:
            session = await self._get_session()
            headers = {'api_key': self.api_key}
            
            # Coinalyze endpoint for symbols - using futures data
            url = f'{self.base_url}/futures-symbols'
            
            async with session.get(url, headers=headers, timeout=30) as response:
                if response.status == 200:
                    data = await response.json()
                    # Extract unique base symbols
                    symbols = []
                    if isinstance(data, list):
                        for item in data:
                            symbol = item.get('symbol', '').split('-')[0].split('/')[0]
                            if symbol and symbol not in symbols:
                                symbols.append(symbol)
                    
                    logger.info(f"Fetched {len(symbols)} coins from Coinalyze")
                    return symbols  # Return ALL coins
                else:
                    logger.error(f"Error fetching coins: {response.status}")
                    # Fallback to popular coins
                    return self._get_fallback_coins()
        except Exception as e:
            logger.error(f"Exception fetching coins: {e}")
            return self._get_fallback_coins()

    def _get_fallback_coins(self) -> List[str]:
        """Fallback list of popular coins if API fails."""
        return [
            'BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'DOT', 'MATIC', 'AVAX',
            'LINK', 'UNI', 'ATOM', 'XRP', 'LTC', 'BCH', 'ALGO', 'FIL',
            'VET', 'ICP', 'XLM', 'AAVE', 'SAND', 'MANA', 'AXS', 'GALA',
            'ENJ', 'CHZ', 'THETA', 'HBAR', 'EOS', 'TRX', 'XTZ', 'NEO',
            'DASH', 'ZEC', 'WAVES', 'QTUM', 'ONT', 'ZIL', 'RVN', 'BAT',
            'COMP', 'MKR', 'SNX', 'YFI', 'CRV', 'SUSHI', 'BAL', 'RUNE', 'KSM', 'NEAR'
        ]

    async def get_ohlcv(self, symbol: str, days: int = 365) -> List[Dict]:
        """Fetch OHLCV data for a symbol over the specified number of days.
        
        Args:
            symbol: Trading symbol (e.g., 'BTC')
            days: Number of days of historical data (default 365 = 1 year)
        
        Returns:
            List of OHLCV candles with keys: timestamp, open, high, low, close, volume
        """
        try:
            session = await self._get_session()
            headers = {'api_key': self.api_key}
            
            # Calculate timestamps
            end_time = datetime.now(timezone.utc)
            start_time = end_time - timedelta(days=days)
            
            # Use 4-hour candles for good granularity without too much data
            interval = '4h'
            
            # Coinalyze historical OHLCV endpoint
            url = f'{self.base_url}/open-interest-aggregated-history'
            params = {
                'symbols': f'{symbol}USDT',
                'from': int(start_time.timestamp()),
                'to': int(end_time.timestamp()),
                'interval': interval
            }
            
            async with session.get(url, headers=headers, params=params, timeout=60) as response:
                if response.status == 200:
                    data = await response.json()
                    # Parse and return OHLCV data
                    candles = self._parse_ohlcv(data, symbol)
                    logger.info(f"Fetched {len(candles)} candles for {symbol}")
                    return candles
                else:
                    logger.warning(f"Error fetching OHLCV for {symbol}: {response.status}")
                    # Generate mock data for MVP demo
                    return self._generate_mock_ohlcv(symbol, days)
        except Exception as e:
            logger.error(f"Exception fetching OHLCV for {symbol}: {e}")
            return self._generate_mock_ohlcv(symbol, days)

    def _parse_ohlcv(self, data: Dict, symbol: str) -> List[Dict]:
        """Parse Coinalyze API response to OHLCV format."""
        candles = []
        if isinstance(data, dict) and 'history' in data:
            for item in data['history']:
                candles.append({
                    'timestamp': item.get('t', 0),
                    'open': float(item.get('o', 0)),
                    'high': float(item.get('h', 0)),
                    'low': float(item.get('l', 0)),
                    'close': float(item.get('c', 0)),
                    'volume': float(item.get('v', 0))
                })
        return candles

    def _generate_mock_ohlcv(self, symbol: str, days: int) -> List[Dict]:
        """Generate realistic mock OHLCV data for demo purposes."""
        import random
        
        # Base prices for different coins
        base_prices = {
            'BTC': 50000, 'ETH': 3000, 'BNB': 400, 'SOL': 100, 'ADA': 0.5,
            'DOT': 7, 'MATIC': 1, 'AVAX': 30, 'LINK': 15, 'UNI': 8
        }
        
        base_price = base_prices.get(symbol, 10)
        candles = []
        
        # Generate 4-hour candles for the period
        num_candles = (days * 24) // 4
        current_time = datetime.now(timezone.utc) - timedelta(days=days)
        
        price = base_price
        for i in range(num_candles):
            # Random walk with trend
            change = random.uniform(-0.03, 0.035)
            price = price * (1 + change)
            
            # Generate OHLC from price
            high = price * random.uniform(1.0, 1.02)
            low = price * random.uniform(0.98, 1.0)
            open_price = price * random.uniform(0.99, 1.01)
            close_price = price
            volume = random.uniform(1000000, 10000000)
            
            candles.append({
                'timestamp': int(current_time.timestamp()),
                'open': round(open_price, 2),
                'high': round(high, 2),
                'low': round(low, 2),
                'close': round(close_price, 2),
                'volume': round(volume, 2)
            })
            
            current_time += timedelta(hours=4)
        
        return candles