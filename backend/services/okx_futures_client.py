import aiohttp
import asyncio
from typing import List, Dict, Optional
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

class OKXFuturesClient:
    """OKX Futures API client for derivatives data.
    
    Uses OKX public API - no API key required for public endpoints!
    """
    
    def __init__(self):
        self.base_url = 'https://www.okx.com'
        self.session: Optional[aiohttp.ClientSession] = None
        self.provider_name = "OKX Futures"
    
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
            
            # OKX format: BTC-USDT-SWAP
            okx_symbol = f"{symbol.upper()}-USDT-SWAP"
            
            url = f'{self.base_url}/api/v5/public/open-interest'
            params = {'instId': okx_symbol}
            
            async with session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('code') == '0':
                        result = data.get('data', [])
                        if result and len(result) > 0:
                            oi_data = result[0]
                            return {
                                'symbol': symbol,
                                'open_interest': float(oi_data.get('oi', 0)),
                                'timestamp': int(oi_data.get('ts', 0)) / 1000
                            }
                logger.debug(f"OKX open interest error for {symbol}: {data.get('msg')}")
                return None
                    
        except Exception as e:
            logger.debug(f"Error fetching OKX open interest for {symbol}: {e}")
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
            
            # OKX format: BTC-USDT-SWAP
            okx_symbol = f"{symbol.upper()}-USDT-SWAP"
            
            url = f'{self.base_url}/api/v5/public/funding-rate'
            params = {'instId': okx_symbol}
            
            async with session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('code') == '0':
                        result = data.get('data', [])
                        if result and len(result) > 0:
                            funding = result[0]
                            return {
                                'symbol': symbol,
                                'funding_rate': float(funding.get('fundingRate', 0)) * 100,  # Convert to percentage
                                'next_funding_time': int(funding.get('nextFundingTime', 0)) / 1000,
                                'timestamp': int(funding.get('fundingTime', 0)) / 1000
                            }
                logger.debug(f"OKX funding rate error for {symbol}: {data.get('msg')}")
                return None
                    
        except Exception as e:
            logger.debug(f"Error fetching OKX funding rate for {symbol}: {e}")
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
            
            okx_symbol = f"{symbol.upper()}-USDT-SWAP"
            
            url = f'{self.base_url}/api/v5/public/funding-rate-history'
            params = {
                'instId': okx_symbol,
                'limit': min(limit, 100)
            }
            
            async with session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('code') == '0':
                        history = []
                        for item in data.get('data', []):
                            history.append({
                                'funding_rate': float(item.get('fundingRate', 0)) * 100,
                                'funding_time': int(item.get('fundingTime', 0)) / 1000,
                                'timestamp': int(item.get('fundingTime', 0)) / 1000
                            })
                        return history
                return []
                    
        except Exception as e:
            logger.debug(f"Error fetching OKX funding rate history for {symbol}: {e}")
            return []
    
    async def get_long_short_ratio(self, symbol: str) -> Optional[Dict]:
        """Get long/short ratio for a symbol.
        
        Args:
            symbol: Trading pair symbol (e.g., 'BTC')
            
        Returns:
            Dict with long_short_ratio, long_account, short_account
        """
        try:
            session = await self._get_session()
            
            # OKX uses coin symbol for this endpoint
            url = f'{self.base_url}/api/v5/rubik/stat/contracts/long-short-account-ratio'
            params = {
                'ccy': symbol.upper(),
                'period': '5m'
            }
            
            async with session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('code') == '0':
                        result = data.get('data', [])
                        if result and len(result) > 0:
                            latest = result[0]
                            long_pct = float(latest.get('longRatio', 0))
                            short_pct = float(latest.get('shortRatio', 0))
                            ratio = long_pct / short_pct if short_pct > 0 else 0
                            
                            return {
                                'symbol': symbol,
                                'long_short_ratio': ratio,
                                'long_account_percent': long_pct * 100,
                                'short_account_percent': short_pct * 100,
                                'timestamp': int(latest.get('ts', 0)) / 1000
                            }
                return None
                    
        except Exception as e:
            logger.debug(f"Error fetching OKX long/short ratio for {symbol}: {e}")
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
                'provider': 'okx',
                'timestamp': datetime.now(timezone.utc).timestamp()
            }
            
            if isinstance(open_interest, dict):
                metrics['open_interest'] = open_interest.get('open_interest', 0)
                metrics['has_derivatives_data'] = True
            
            if isinstance(funding_rate, dict):
                metrics['funding_rate'] = funding_rate.get('funding_rate', 0)
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
                logger.info(f"✅ OKX: Fetched derivatives data for {symbol}")
            else:
                logger.debug(f"⚠️ OKX: No derivatives data for {symbol}")
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error fetching OKX derivatives metrics for {symbol}: {e}")
            return {
                'symbol': symbol,
                'has_derivatives_data': False,
                'provider': 'okx',
                'error': str(e),
                'timestamp': datetime.now(timezone.utc).timestamp()
            }