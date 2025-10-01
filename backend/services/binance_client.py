import aiohttp
import asyncio
from typing import List, Dict, Optional
from datetime import datetime, timedelta, timezone
import logging

logger = logging.getLogger(__name__)

class BinanceClient:
    """Binance API client for real historical OHLCV data (free, no key required)."""
    
    def __init__(self):
        self.base_url = 'https://api.binance.com/api/v3'
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self):
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session
    
    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def get_all_symbols(self) -> List[str]:
        """Fetch all available USDT trading pairs from Binance.
        
        Returns list of base symbols (e.g., ['BTC', 'ETH', 'BNB', ...])
        """
        try:
            session = await self._get_session()
            
            url = f'{self.base_url}/exchangeInfo'
            
            async with session.get(url, timeout=30) as response:
                if response.status == 200:
                    data = await response.json()
                    symbols = []
                    
                    for symbol_info in data.get('symbols', []):
                        # Only get USDT pairs that are trading
                        if (symbol_info.get('status') == 'TRADING' and 
                            symbol_info.get('quoteAsset') == 'USDT'):
                            base_asset = symbol_info.get('baseAsset')
                            if base_asset and base_asset not in symbols:
                                symbols.append(base_asset)
                    
                    logger.info(f"Fetched {len(symbols)} trading symbols from Binance")
                    return symbols
                else:
                    logger.error(f"Binance API error: {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"Exception fetching Binance symbols: {e}")
            return []
    
    async def get_historical_klines(self, symbol: str, days: int = 365) -> List[Dict]:
        """Get historical kline/candlestick data.
        
        Args:
            symbol: Base symbol (e.g., 'BTC')
            days: Number of days of historical data
        
        Returns:
            List of candle dicts with timestamp, open, high, low, close, volume
        """
        try:
            session = await self._get_session()
            
            # Binance uses symbol pairs like BTCUSDT
            trading_pair = f"{symbol}USDT"
            
            # Calculate time range
            end_time = datetime.now(timezone.utc)
            start_time = end_time - timedelta(days=days)
            
            # Use 4-hour intervals for good granularity
            interval = '4h'
            
            url = f'{self.base_url}/klines'
            params = {
                'symbol': trading_pair,
                'interval': interval,
                'startTime': int(start_time.timestamp() * 1000),  # Binance uses milliseconds
                'endTime': int(end_time.timestamp() * 1000),
                'limit': 1000  # Max per request
            }
            
            all_klines = []
            
            # Binance returns max 1000 candles per request
            # For 365 days of 4h candles: 365*24/4 = 2190 candles
            # Need 3 requests
            for _ in range(3):
                async with session.get(url, params=params, timeout=30) as response:
                    if response.status == 200:
                        klines = await response.json()
                        
                        if not klines:
                            break
                        
                        all_klines.extend(klines)
                        
                        # Update start time for next batch
                        last_timestamp = klines[-1][0]
                        params['startTime'] = last_timestamp + 1
                        
                        if len(klines) < 1000:
                            # Got all available data
                            break
                    else:
                        logger.warning(f"Binance API error for {symbol}: {response.status}")
                        break
            
            # Convert to our format
            candles = self._parse_klines(all_klines)
            logger.info(f"Fetched {len(candles)} real candles from Binance for {symbol}")
            return candles
            
        except Exception as e:
            logger.error(f"Exception fetching Binance klines for {symbol}: {e}")
            return []
    
    async def get_ticker_prices(self) -> Dict[str, float]:
        """Get current prices for all USDT pairs from Binance ticker.
        
        Returns dict mapping symbol -> current price
        """
        try:
            session = await self._get_session()
            
            url = f'{self.base_url}/ticker/price'
            
            async with session.get(url, timeout=30) as response:
                if response.status == 200:
                    tickers = await response.json()
                    prices = {}
                    
                    for ticker in tickers:
                        symbol_pair = ticker.get('symbol', '')
                        if symbol_pair.endswith('USDT'):
                            # Extract base symbol (e.g., BTCUSDT -> BTC)
                            base_symbol = symbol_pair.replace('USDT', '')
                            price = float(ticker.get('price', 0))
                            if price > 0:
                                prices[base_symbol] = price
                    
                    logger.info(f"Fetched {len(prices)} current prices from Binance")
                    return prices
                else:
                    logger.error(f"Binance ticker API error: {response.status}")
                    return {}
                    
        except Exception as e:
            logger.error(f"Exception fetching Binance ticker prices: {e}")
            return {}

        """Parse Binance kline data to our format.
        
        Binance kline format:
        [
          timestamp,      // 0: Open time
          open,           // 1: Open price
          high,           // 2: High price
          low,            // 3: Low price
          close,          // 4: Close price
          volume,         // 5: Volume
          close_time,     // 6: Close time
          quote_volume,   // 7: Quote asset volume
          trades,         // 8: Number of trades
          taker_buy_base, // 9: Taker buy base asset volume
          taker_buy_quote,// 10: Taker buy quote asset volume
          ignore          // 11: Ignore
        ]
        """
        candles = []
        
        for kline in klines:
            if len(kline) >= 6:
                candles.append({
                    'timestamp': int(kline[0] / 1000),  # Convert ms to seconds
                    'open': float(kline[1]),
                    'high': float(kline[2]),
                    'low': float(kline[3]),
                    'close': float(kline[4]),
                    'volume': float(kline[5])
                })
        
        return candles
