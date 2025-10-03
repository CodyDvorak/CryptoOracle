import aiohttp
import asyncio
from typing import List, Dict, Optional
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

class BinanceFuturesClient:
    """Binance Futures API client for derivatives data (open interest, funding rates, liquidations).
    
    Uses Binance public API - no API key required for public endpoints!
    Rate limit: 2400 requests/minute
    """
    
    def __init__(self):
        self.base_url = 'https://fapi.binance.com'  # Futures API
        self.session: Optional[aiohttp.ClientSession] = None
        self.provider_name = "Binance Futures"
    
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
            symbol: Trading pair symbol (e.g., 'BTC' will be converted to 'BTCUSDT')
            
        Returns:
            Dict with open_interest, open_interest_value, timestamp
        """
        try:
            session = await self._get_session()
            
            # Convert symbol to Binance format
            binance_symbol = f"{symbol.upper()}USDT"
            
            url = f'{self.base_url}/fapi/v1/openInterest'
            params = {'symbol': binance_symbol}
            
            async with session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        'symbol': symbol,
                        'open_interest': float(data.get('openInterest', 0)),
                        'open_interest_value': float(data.get('openInterest', 0)) * float(data.get('price', 0)) if 'price' in data else None,
                        'timestamp': int(data.get('time', datetime.now(timezone.utc).timestamp() * 1000)) / 1000
                    }
                else:
                    logger.debug(f"Binance open interest error {response.status} for {symbol}")
                    return None
                    
        except Exception as e:
            logger.debug(f"Error fetching Binance open interest for {symbol}: {e}")
            return None
    
    async def get_funding_rate(self, symbol: str) -> Optional[Dict]:
        """Get current and predicted funding rate for a symbol.
        
        Args:
            symbol: Trading pair symbol (e.g., 'BTC')
            
        Returns:
            Dict with funding_rate, next_funding_time, timestamp
        """
        try:
            session = await self._get_session()
            
            # Convert symbol to Binance format
            binance_symbol = f"{symbol.upper()}USDT"
            
            url = f'{self.base_url}/fapi/v1/premiumIndex'
            params = {'symbol': binance_symbol}
            
            async with session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        'symbol': symbol,
                        'funding_rate': float(data.get('lastFundingRate', 0)) * 100,  # Convert to percentage
                        'mark_price': float(data.get('markPrice', 0)),
                        'index_price': float(data.get('indexPrice', 0)),
                        'next_funding_time': int(data.get('nextFundingTime', 0)) / 1000,
                        'timestamp': int(data.get('time', datetime.now(timezone.utc).timestamp() * 1000)) / 1000
                    }
                else:
                    logger.debug(f"Binance funding rate error {response.status} for {symbol}")
                    return None
                    
        except Exception as e:
            logger.debug(f"Error fetching Binance funding rate for {symbol}: {e}")
            return None
    
    async def get_funding_rate_history(self, symbol: str, limit: int = 100) -> List[Dict]:
        """Get historical funding rates for a symbol.
        
        Args:
            symbol: Trading pair symbol (e.g., 'BTC')
            limit: Number of historical records (max 1000)
            
        Returns:
            List of funding rate history dicts
        """
        try:
            session = await self._get_session()
            
            # Convert symbol to Binance format
            binance_symbol = f"{symbol.upper()}USDT"
            
            url = f'{self.base_url}/fapi/v1/fundingRate'
            params = {
                'symbol': binance_symbol,
                'limit': min(limit, 1000)
            }
            
            async with session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    history = []
                    for item in data:
                        history.append({
                            'funding_rate': float(item.get('fundingRate', 0)) * 100,
                            'funding_time': int(item.get('fundingTime', 0)) / 1000,
                            'timestamp': int(item.get('fundingTime', 0)) / 1000
                        })
                    return history
                else:
                    logger.debug(f"Binance funding rate history error {response.status} for {symbol}")
                    return []
                    
        except Exception as e:
            logger.debug(f"Error fetching Binance funding rate history for {symbol}: {e}")
            return []
    
    async def get_long_short_ratio(self, symbol: str, period: str = '5m') -> Optional[Dict]:
        """Get current long/short ratio for a symbol.
        
        Args:
            symbol: Trading pair symbol (e.g., 'BTC')
            period: Time period ('5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d')
            
        Returns:
            Dict with long_short_ratio, long_account, short_account
        """
        try:
            session = await self._get_session()
            
            # Convert symbol to Binance format
            binance_symbol = f"{symbol.upper()}USDT"
            
            url = f'{self.base_url}/futures/data/globalLongShortAccountRatio'
            params = {
                'symbol': binance_symbol,
                'period': period,
                'limit': 1
            }
            
            async with session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if data and len(data) > 0:
                        latest = data[0]
                        long_account = float(latest.get('longAccount', 0))
                        short_account = float(latest.get('shortAccount', 0))
                        ratio = long_account / short_account if short_account > 0 else 0
                        
                        return {
                            'symbol': symbol,
                            'long_short_ratio': ratio,
                            'long_account_percent': long_account * 100,
                            'short_account_percent': short_account * 100,
                            'timestamp': int(latest.get('timestamp', 0)) / 1000
                        }
                    return None
                else:
                    logger.debug(f"Binance long/short ratio error {response.status} for {symbol}")
                    return None
                    
        except Exception as e:
            logger.debug(f"Error fetching Binance long/short ratio for {symbol}: {e}")
            return None
    
    async def get_liquidations_24h(self, symbol: str) -> Optional[Dict]:
        """Estimate 24h liquidations from open interest changes and funding rate.
        
        Note: Binance doesn't provide direct liquidation data via public API.
        This estimates liquidations from open interest volatility.
        
        Args:
            symbol: Trading pair symbol (e.g., 'BTC')
            
        Returns:
            Dict with estimated liquidation metrics
        """
        try:
            # Get current open interest
            oi_current = await self.get_open_interest(symbol)
            if not oi_current:
                return None
            
            # Get funding rate (high funding often precedes liquidations)
            funding = await self.get_funding_rate(symbol)
            if not funding:
                return None
            
            # Calculate liquidation risk score based on funding rate
            funding_rate = abs(funding['funding_rate'])
            
            # High absolute funding rate indicates potential liquidation cascade
            liquidation_risk = "low"
            if funding_rate > 0.1:  # > 0.1%
                liquidation_risk = "high"
            elif funding_rate > 0.05:  # > 0.05%
                liquidation_risk = "medium"
            
            return {
                'symbol': symbol,
                'open_interest': oi_current['open_interest'],
                'funding_rate': funding['funding_rate'],
                'liquidation_risk': liquidation_risk,
                'funding_direction': 'longs_pay' if funding['funding_rate'] > 0 else 'shorts_pay',
                'timestamp': oi_current['timestamp']
            }
            
        except Exception as e:
            logger.debug(f"Error calculating liquidation metrics for {symbol}: {e}")
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
                self.get_liquidations_24h(symbol),
                return_exceptions=True
            )
            
            open_interest, funding_rate, long_short, liquidations = results
            
            # Compile into single dict
            metrics = {
                'symbol': symbol,
                'has_derivatives_data': False,
                'timestamp': datetime.now(timezone.utc).timestamp()
            }
            
            if isinstance(open_interest, dict):
                metrics['open_interest'] = open_interest.get('open_interest', 0)
                metrics['has_derivatives_data'] = True
            
            if isinstance(funding_rate, dict):
                metrics['funding_rate'] = funding_rate.get('funding_rate', 0)
                metrics['mark_price'] = funding_rate.get('mark_price', 0)
                metrics['next_funding_time'] = funding_rate.get('next_funding_time', 0)
                metrics['has_derivatives_data'] = True
            
            if isinstance(long_short, dict):
                metrics['long_short_ratio'] = long_short.get('long_short_ratio', 1.0)
                metrics['long_account_percent'] = long_short.get('long_account_percent', 50)
                metrics['short_account_percent'] = long_short.get('short_account_percent', 50)
                metrics['has_derivatives_data'] = True
            
            if isinstance(liquidations, dict):
                metrics['liquidation_risk'] = liquidations.get('liquidation_risk', 'unknown')
                metrics['funding_direction'] = liquidations.get('funding_direction', 'neutral')
                metrics['has_derivatives_data'] = True
            
            if metrics['has_derivatives_data']:
                logger.info(f"✅ Binance Futures: Fetched derivatives data for {symbol}")
            else:
                logger.debug(f"⚠️ Binance Futures: No derivatives data for {symbol}")
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error fetching derivatives metrics for {symbol}: {e}")
            return {
                'symbol': symbol,
                'has_derivatives_data': False,
                'error': str(e),
                'timestamp': datetime.now(timezone.utc).timestamp()
            }