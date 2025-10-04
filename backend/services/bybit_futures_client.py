import aiohttp
import asyncio
from typing import List, Dict, Optional
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

class BybitFuturesClient:
    """Bybit Futures API client for derivatives data.
    
    Uses Bybit public API - no API key required for public endpoints!
    """
    
    def __init__(self):
        self.base_url = 'https://api.bybit.com'  # V5 API
        self.session: Optional[aiohttp.ClientSession] = None
        self.provider_name = "Bybit Futures"
    
    async def _get_session(self):
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session
    
    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def get_open_interest(self, symbol: str) -> Optional[Dict]:
        """Get current open interest for a symbol.
        
        Args:
            symbol: Trading pair symbol (e.g., 'BTC')
            
        Returns:
            Dict with open_interest, timestamp
        """
        try:
            session = await self._get_session()
            
            # Bybit format: BTCUSDT
            bybit_symbol = f"{symbol.upper()}USDT"
            
            url = f'{self.base_url}/v5/market/open-interest'
            params = {
                'category': 'linear',  # USDT perpetual
                'symbol': bybit_symbol,
                'intervalTime': '5min'
            }
            
            async with session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('retCode') == 0:
                        result = data.get('result', {})
                        if result and 'list' in result and len(result['list']) > 0:
                            latest = result['list'][0]
                            return {
                                'symbol': symbol,
                                'open_interest': float(latest.get('openInterest', 0)),
                                'timestamp': int(latest.get('timestamp', 0)) / 1000
                            }
                logger.debug(f"Bybit open interest error for {symbol}: {data.get('retMsg')}")
                return None
                    
        except Exception as e:
            logger.debug(f"Error fetching Bybit open interest for {symbol}: {e}")
            return None
    
    async def get_funding_rate(self, symbol: str) -> Optional[Dict]:
        """Get current funding rate for a symbol.
        
        Args:
            symbol: Trading pair symbol (e.g., 'BTC')
            
        Returns:
            Dict with funding_rate, next_funding_time, timestamp
        """
        try:
            session = await self._get_session()
            
            # Bybit format: BTCUSDT
            bybit_symbol = f"{symbol.upper()}USDT"
            
            url = f'{self.base_url}/v5/market/tickers'
            params = {
                'category': 'linear',
                'symbol': bybit_symbol
            }
            
            async with session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('retCode') == 0:
                        result = data.get('result', {})
                        if result and 'list' in result and len(result['list']) > 0:
                            ticker = result['list'][0]
                            return {
                                'symbol': symbol,
                                'funding_rate': float(ticker.get('fundingRate', 0)) * 100,  # Convert to percentage
                                'mark_price': float(ticker.get('markPrice', 0)),
                                'index_price': float(ticker.get('indexPrice', 0)),
                                'next_funding_time': int(ticker.get('nextFundingTime', 0)) / 1000,
                                'timestamp': datetime.now(timezone.utc).timestamp()
                            }
                logger.debug(f"Bybit funding rate error for {symbol}: {data.get('retMsg')}")
                return None
                    
        except Exception as e:
            logger.debug(f"Error fetching Bybit funding rate for {symbol}: {e}")
            return None
    
    async def get_funding_rate_history(self, symbol: str, limit: int = 100) -> List[Dict]:
        """Get historical funding rates for a symbol.
        
        Args:
            symbol: Trading pair symbol (e.g., 'BTC')
            limit: Number of historical records
            
        Returns:
            List of funding rate history dicts
        """
        try:
            session = await self._get_session()
            
            bybit_symbol = f"{symbol.upper()}USDT"
            
            url = f'{self.base_url}/v5/market/funding/history'
            params = {
                'category': 'linear',
                'symbol': bybit_symbol,
                'limit': min(limit, 200)
            }
            
            async with session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('retCode') == 0:
                        result = data.get('result', {})
                        history = []
                        for item in result.get('list', []):
                            history.append({
                                'funding_rate': float(item.get('fundingRate', 0)) * 100,
                                'funding_time': int(item.get('fundingRateTimestamp', 0)) / 1000,
                                'timestamp': int(item.get('fundingRateTimestamp', 0)) / 1000
                            })
                        return history
                return []
                    
        except Exception as e:
            logger.debug(f"Error fetching Bybit funding rate history for {symbol}: {e}")
            return []
    
    async def get_long_short_ratio(self, symbol: str, period: str = '5min') -> Optional[Dict]:
        """Get long/short ratio for a symbol.
        
        Args:
            symbol: Trading pair symbol (e.g., 'BTC')
            period: Time period ('5min', '15min', '30min', '1h', '4h', '1d')
            
        Returns:
            Dict with long_short_ratio, long_account, short_account
        """
        try:
            session = await self._get_session()
            
            bybit_symbol = f"{symbol.upper()}USDT"
            
            url = f'{self.base_url}/v5/market/account-ratio'
            params = {
                'category': 'linear',
                'symbol': bybit_symbol,
                'period': period,
                'limit': 1
            }
            
            async with session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('retCode') == 0:
                        result = data.get('result', {})
                        if result and 'list' in result and len(result['list']) > 0:
                            latest = result['list'][0]
                            buy_ratio = float(latest.get('buyRatio', 0))
                            sell_ratio = float(latest.get('sellRatio', 0))
                            ratio = buy_ratio / sell_ratio if sell_ratio > 0 else 0
                            
                            return {
                                'symbol': symbol,
                                'long_short_ratio': ratio,
                                'long_account_percent': buy_ratio * 100,
                                'short_account_percent': sell_ratio * 100,
                                'timestamp': int(latest.get('timestamp', 0)) / 1000
                            }
                return None
                    
        except Exception as e:
            logger.debug(f"Error fetching Bybit long/short ratio for {symbol}: {e}")
            return None
    
    async def get_all_derivatives_metrics(self, symbol: str) -> Dict:
        """Get all available derivatives metrics for a symbol.
        
        Args:
            symbol: Trading pair symbol (e.g., 'BTC')
            
        Returns:
            Dict with all available metrics
        """
        try:
            # Fetch all metrics concurrently
            results = await asyncio.gather(
                self.get_open_interest(symbol),
                self.get_funding_rate(symbol),
                self.get_long_short_ratio(symbol),
                return_exceptions=True
            )
            
            open_interest, funding_rate, long_short = results
            
            # Compile into single dict
            metrics = {
                'symbol': symbol,
                'has_derivatives_data': False,
                'provider': 'bybit',
                'timestamp': datetime.now(timezone.utc).timestamp()
            }
            
            if isinstance(open_interest, dict):
                metrics['open_interest'] = open_interest.get('open_interest', 0)
                metrics['has_derivatives_data'] = True
            
            if isinstance(funding_rate, dict):
                metrics['funding_rate'] = funding_rate.get('funding_rate', 0)
                metrics['mark_price'] = funding_rate.get('mark_price', 0)
                metrics['next_funding_time'] = funding_rate.get('next_funding_time', 0)
                
                # Calculate liquidation risk
                funding_abs = abs(metrics['funding_rate'])
                if funding_abs > 0.1:
                    metrics['liquidation_risk'] = 'high'
                elif funding_abs > 0.05:
                    metrics['liquidation_risk'] = 'medium'
                else:
                    metrics['liquidation_risk'] = 'low'
                
                metrics['funding_direction'] = 'longs_pay' if metrics['funding_rate'] > 0 else 'shorts_pay'
                metrics['has_derivatives_data'] = True
            
            if isinstance(long_short, dict):
                metrics['long_short_ratio'] = long_short.get('long_short_ratio', 1.0)
                metrics['long_account_percent'] = long_short.get('long_account_percent', 50)
                metrics['short_account_percent'] = long_short.get('short_account_percent', 50)
                metrics['has_derivatives_data'] = True
            
            if metrics['has_derivatives_data']:
                logger.info(f"✅ Bybit: Fetched derivatives data for {symbol}")
            else:
                logger.debug(f"⚠️ Bybit: No derivatives data for {symbol}")
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error fetching Bybit derivatives metrics for {symbol}: {e}")
            return {
                'symbol': symbol,
                'has_derivatives_data': False,
                'provider': 'bybit',
                'error': str(e),
                'timestamp': datetime.now(timezone.utc).timestamp()
            }