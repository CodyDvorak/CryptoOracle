import aiohttp
import asyncio
from typing import List, Dict, Optional
from datetime import datetime, timedelta, timezone
import logging

logger = logging.getLogger(__name__)

class TokenMetricsClient:
    """TokenMetrics API client for comprehensive crypto market data with AI analytics."""
    
    def __init__(self, api_key: str):
        self.base_url = 'https://api.tokenmetrics.com/v2'
        self.api_key = api_key
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self):
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(
                headers={'x-api-key': self.api_key}
            )
        return self.session
    
    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def get_all_tokens(self, limit: int = 500) -> List[tuple]:
        """Fetch top tokens by market cap from TokenMetrics.
        
        Returns list of tuples: (symbol, name, current_price_usd, token_id, trader_grade, investor_grade)
        """
        try:
            session = await self._get_session()
            
            # Fetch token list with metadata
            url = f'{self.base_url}/tokens'
            params = {'limit': limit}
            
            async with session.get(url, params=params, timeout=30) as response:
                if response.status == 200:
                    data = await response.json()
                    tokens = []
                    
                    if data.get('data'):
                        for item in data['data']:
                            symbol = item.get('TOKEN_SYMBOL')
                            name = item.get('TOKEN_NAME')
                            token_id = item.get('TOKEN_ID')
                            
                            if symbol and token_id:
                                # Fetch current price and grades
                                price_data = await self.get_latest_price(symbol)
                                grade_data = await self.get_latest_grades(symbol)
                                
                                if price_data:
                                    price = price_data.get('price', 0)
                                    trader_grade = grade_data.get('trader_grade', 0) if grade_data else 0
                                    investor_grade = grade_data.get('investor_grade', 0) if grade_data else 0
                                    
                                    tokens.append((symbol, name or symbol, price, token_id, trader_grade, investor_grade))
                        
                        logger.info(f"Fetched {len(tokens)} tokens from TokenMetrics")
                        return tokens
                    else:
                        logger.error(f"TokenMetrics API error: {data}")
                        return []
                else:
                    logger.error(f"TokenMetrics API HTTP error: {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"Exception fetching TokenMetrics tokens: {e}")
            return []
    
    async def get_latest_price(self, symbol: str) -> Optional[Dict]:
        """Get latest price for a token."""
        try:
            session = await self._get_session()
            
            # Get most recent OHLCV data
            end_date = datetime.now(timezone.utc).strftime('%Y-%m-%d')
            start_date = (datetime.now(timezone.utc) - timedelta(days=2)).strftime('%Y-%m-%d')
            
            url = f'{self.base_url}/daily-ohlcv'
            params = {
                'symbol': symbol,
                'startDate': start_date,
                'endDate': end_date
            }
            
            async with session.get(url, params=params, timeout=20) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('data') and len(data['data']) > 0:
                        latest = data['data'][-1]
                        return {
                            'price': float(latest.get('CLOSE', 0)),
                            'volume': float(latest.get('VOLUME', 0))
                        }
                return None
                    
        except Exception as e:
            logger.warning(f"Error fetching price for {symbol}: {e}")
            return None
    
    async def get_latest_grades(self, symbol: str) -> Optional[Dict]:
        """Get latest AI grades for a token."""
        try:
            session = await self._get_session()
            
            url = f'{self.base_url}/trader-grades'
            params = {
                'symbol': symbol,
                'limit': 1
            }
            
            async with session.get(url, params=params, timeout=20) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('data') and len(data['data']) > 0:
                        latest = data['data'][0]
                        return {
                            'trader_grade': float(latest.get('TA_GRADE', 0)),
                            'investor_grade': float(latest.get('QUANT_GRADE', 0)),
                            'date': latest.get('DATE')
                        }
                return None
                    
        except Exception as e:
            logger.warning(f"Error fetching grades for {symbol}: {e}")
            return None
    
    async def get_historical_data(self, symbol: str, days: int = 365) -> List[Dict]:
        """Get historical daily OHLCV data.
        
        Args:
            symbol: Token symbol (e.g., 'BTC')
            days: Number of days of historical data
        
        Returns:
            List of candle dicts with timestamp, open, high, low, close, volume
        """
        try:
            session = await self._get_session()
            
            # Calculate date range
            end_date = datetime.now(timezone.utc).strftime('%Y-%m-%d')
            start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime('%Y-%m-%d')
            
            url = f'{self.base_url}/daily-ohlcv'
            params = {
                'symbol': symbol,
                'startDate': start_date,
                'endDate': end_date
            }
            
            async with session.get(url, params=params, timeout=30) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    if data.get('data'):
                        candles = []
                        
                        for candle in data['data']:
                            date_str = candle.get('DATE')
                            close_price = candle.get('CLOSE', 0)
                            
                            if date_str and close_price > 0:
                                # Parse date to timestamp
                                dt = datetime.strptime(date_str, '%Y-%m-%d')
                                timestamp = int(dt.replace(tzinfo=timezone.utc).timestamp())
                                
                                candles.append({
                                    'timestamp': timestamp,
                                    'open': float(candle.get('OPEN', 0)),
                                    'high': float(candle.get('HIGH', 0)),
                                    'low': float(candle.get('LOW', 0)),
                                    'close': float(close_price),
                                    'volume': float(candle.get('VOLUME', 0))
                                })
                        
                        logger.info(f"Fetched {len(candles)} candles from TokenMetrics for {symbol}")
                        return candles
                    else:
                        logger.warning(f"TokenMetrics API returned no data for {symbol}")
                        return []
                else:
                    logger.warning(f"TokenMetrics API HTTP error for {symbol}: {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"Exception fetching TokenMetrics historical data for {symbol}: {e}")
            return []
    
    async def get_ai_signals(self, symbol: str) -> Optional[Dict]:
        """Get AI trading signals and analysis for a token.
        
        Returns comprehensive AI insights including:
        - Trader grade (0-100)
        - Investor grade (0-100)
        - Sentiment signals
        - Entry/exit recommendations
        """
        try:
            session = await self._get_session()
            
            # Get trader grades (includes signals)
            url = f'{self.base_url}/trader-grades'
            params = {
                'symbol': symbol,
                'limit': 30  # Last 30 days for trend analysis
            }
            
            async with session.get(url, params=params, timeout=20) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    if data.get('data') and len(data['data']) > 0:
                        grades = data['data']
                        latest = grades[0]
                        
                        # Calculate trend
                        recent_grades = [float(g.get('TA_GRADE', 0)) for g in grades[:7] if g.get('TA_GRADE')]
                        trader_trend = 'bullish' if len(recent_grades) >= 2 and recent_grades[0] > recent_grades[-1] else 'bearish'
                        
                        return {
                            'trader_grade': float(latest.get('TA_GRADE', 0)),
                            'investor_grade': float(latest.get('QUANT_GRADE', 0)),
                            'trader_trend': trader_trend,
                            'grade_history': recent_grades,
                            'last_updated': latest.get('DATE'),
                            'signal_strength': 'strong' if float(latest.get('TA_GRADE', 0)) >= 70 else 'weak'
                        }
                    
                    return None
                else:
                    logger.warning(f"Failed to get AI signals for {symbol}: {response.status}")
                    return None
                    
        except Exception as e:
            logger.error(f"Exception fetching AI signals for {symbol}: {e}")
            return None
    
    async def get_support_resistance(self, token_id: str) -> Optional[Dict]:
        """Get support and resistance levels for a token."""
        try:
            session = await self._get_session()
            
            url = f'{self.base_url}/resistance-support'
            params = {'token_id': token_id}
            
            async with session.get(url, params=params, timeout=20) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    if data.get('data') and len(data['data']) > 0:
                        latest = data['data'][0]
                        return {
                            'resistance': float(latest.get('RESISTANCE', 0)),
                            'support': float(latest.get('SUPPORT', 0)),
                            'date': latest.get('DATE')
                        }
                    
                    return None
                else:
                    return None
                    
        except Exception as e:
            logger.warning(f"Error fetching support/resistance for token {token_id}: {e}")
            return None
