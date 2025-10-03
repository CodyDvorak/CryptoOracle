import asyncio
from typing import Dict, Optional
from datetime import datetime, timezone
import logging
import os

from services.binance_futures_client import BinanceFuturesClient
from services.bybit_futures_client import BybitFuturesClient
from services.okx_futures_client import OKXFuturesClient
from services.coinalyze_client import CoinalyzeClient

logger = logging.getLogger(__name__)

class MultiFuturesClient:
    """Multi-provider futures/derivatives client with automatic fallback.
    
    Tries providers in order: OKX (Primary) → Coinalyze (Backup) → Bybit → Binance
    """
    
    def __init__(self):
        # Initialize all providers
        self.okx = OKXFuturesClient()
        self.coinalyze = CoinalyzeClient(api_key=os.getenv('COINALYZE_API_KEY'))
        self.bybit = BybitFuturesClient()
        self.binance = BinanceFuturesClient()
        
        # Provider order (OKX primary, Coinalyze backup, then Bybit, then Binance)
        self.providers = [
            ('okx', self.okx),
            ('coinalyze', self.coinalyze),
            ('bybit', self.bybit),
            ('binance', self.binance)
        ]
        
        # Statistics tracking
        self.stats = {
            'okx': {'calls': 0, 'success': 0, 'failures': 0},
            'coinalyze': {'calls': 0, 'success': 0, 'failures': 0},
            'bybit': {'calls': 0, 'success': 0, 'failures': 0},
            'binance': {'calls': 0, 'success': 0, 'failures': 0}
        }
        
        # Cache successful provider per symbol
        self.symbol_providers = {}  # {symbol: provider_name}
        
        logger.info(f"🔄 MultiFuturesClient initialized: OKX (Primary) → Coinalyze (Backup) → Bybit → Binance")
    
    async def close(self):
        """Close all provider sessions."""
        await self.okx.close()
        await self.coinalyze.close()
        await self.bybit.close()
        await self.binance.close()
    
    def _record_call(self, provider_name: str, success: bool):
        """Record API call statistics."""
        if provider_name in self.stats:
            self.stats[provider_name]['calls'] += 1
            if success:
                self.stats[provider_name]['success'] += 1
            else:
                self.stats[provider_name]['failures'] += 1
    
    def get_stats(self) -> Dict:
        """Get provider usage statistics."""
        return {
            'providers': self.stats,
            'symbol_providers': self.symbol_providers,
            'total_calls': sum(p['calls'] for p in self.stats.values()),
            'total_success': sum(p['success'] for p in self.stats.values())
        }
    
    async def get_all_derivatives_metrics(self, symbol: str) -> Dict:
        """Get derivatives metrics with automatic provider fallback.
        
        Args:
            symbol: Trading pair symbol (e.g., 'BTC')
            
        Returns:
            Dict with derivatives metrics or empty dict if all providers fail
        """
        # Check if we have a known good provider for this symbol
        if symbol in self.symbol_providers:
            preferred_provider = self.symbol_providers[symbol]
            # Try preferred provider first
            providers_to_try = [(preferred_provider, getattr(self, preferred_provider))]
            # Add others as fallback
            providers_to_try.extend([
                (name, client) for name, client in self.providers 
                if name != preferred_provider
            ])
        else:
            providers_to_try = self.providers
        
        for provider_name, client in providers_to_try:
            try:
                logger.debug(f"📡 Trying {provider_name} for {symbol} derivatives data...")
                
                metrics = await client.get_all_derivatives_metrics(symbol)
                
                self._record_call(provider_name, metrics.get('has_derivatives_data', False))
                
                if metrics.get('has_derivatives_data'):
                    # Success! Cache this provider for this symbol
                    self.symbol_providers[symbol] = provider_name
                    logger.info(f"✅ {provider_name}: Got derivatives data for {symbol}")
                    return metrics
                else:
                    logger.debug(f"⚠️ {provider_name}: No data for {symbol}, trying next provider...")
                    
            except Exception as e:
                self._record_call(provider_name, False)
                logger.debug(f"❌ {provider_name} error for {symbol}: {e}")
                continue
        
        # All providers failed
        logger.warning(f"⚠️ All futures providers failed for {symbol}")
        return {
            'symbol': symbol,
            'has_derivatives_data': False,
            'error': 'All providers failed',
            'timestamp': datetime.now(timezone.utc).timestamp()
        }
