import asyncio
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timezone
import logging
import os

from services.coinmarketcap_client import CoinMarketCapClient
from services.coingecko_client import CoinGeckoClient
from services.cryptocompare_client import CryptoCompareClient

logger = logging.getLogger(__name__)

class MultiProviderClient:
    """Multi-provider crypto data client with automatic fallback.
    
    Features:
    - Primary and backup provider configuration
    - Automatic failover on rate limits or errors
    - Provider health tracking
    - Usage statistics
    """
    
    def __init__(self):
        # Initialize providers
        self.coinmarketcap = CoinMarketCapClient(api_key=os.getenv('COINMARKETCAP_API_KEY'))
        self.coingecko = CoinGeckoClient(api_key=os.getenv('COINGECKO_API_KEY'))
        self.cryptocompare = CryptoCompareClient(api_key=os.getenv('CRYPTOCOMPARE_API_KEY'))
        
        # Configuration
        self.primary_provider = os.getenv('PRIMARY_PROVIDER', 'coinmarketcap')
        self.backup_provider = os.getenv('BACKUP_PROVIDER', 'coingecko')
        
        # Provider mapping
        self.providers = {
            'coinmarketcap': self.coinmarketcap,
            'coingecko': self.coingecko,
            'cryptocompare': self.cryptocompare
        }
        
        # Statistics tracking
        self.stats = {
            'coinmarketcap': {'calls': 0, 'errors': 0, 'rate_limits': 0},
            'coingecko': {'calls': 0, 'errors': 0, 'rate_limits': 0},
            'cryptocompare': {'calls': 0, 'errors': 0, 'rate_limits': 0}
        }
        
        # Current active provider
        self.current_provider = self.primary_provider
        
        logger.info(f"🔄 MultiProviderClient initialized: Primary={self.primary_provider}, Backup={self.backup_provider}")
    
    async def close(self):
        """Close all provider sessions."""
        await self.coinmarketcap.close()
        await self.coingecko.close()
        await self.cryptocompare.close()
    
    def _get_provider(self, provider_name: str):
        """Get provider instance by name."""
        return self.providers.get(provider_name)
    
    def _record_call(self, provider_name: str):
        """Record successful API call."""
        if provider_name in self.stats:
            self.stats[provider_name]['calls'] += 1
    
    def _record_error(self, provider_name: str, is_rate_limit: bool = False):
        """Record API error."""
        if provider_name in self.stats:
            self.stats[provider_name]['errors'] += 1
            if is_rate_limit:
                self.stats[provider_name]['rate_limits'] += 1
    
    def _switch_provider(self):
        """Switch to backup provider."""
        if self.current_provider == self.primary_provider:
            self.current_provider = self.backup_provider
            logger.warning(f"🔄 Switching from {self.primary_provider} to {self.backup_provider}")
        else:
            logger.error(f"⚠️ Backup provider {self.backup_provider} also failed!")
    
    def get_stats(self) -> Dict:
        """Get provider usage statistics."""
        return {
            'current_provider': self.current_provider,
            'primary_provider': self.primary_provider,
            'backup_provider': self.backup_provider,
            'stats': self.stats
        }
    
    async def get_all_coins(self, max_coins: int = 100) -> List[tuple]:
        """Fetch top coins with automatic provider fallback and timeout protection.
        
        Args:
            max_coins: Maximum number of coins to fetch
        
        Returns list of tuples: (symbol, name, current_price_usd)
        """
        providers_to_try = [self.current_provider]
        
        # If current is primary, also try backup
        if self.current_provider == self.primary_provider:
            providers_to_try.append(self.backup_provider)
        
        for provider_name in providers_to_try:
            provider = self._get_provider(provider_name)
            if not provider:
                continue
            
            try:
                logger.info(f"📡 Fetching coins from {provider_name}...")
                coins = await provider.get_all_coins(max_coins)
                
                self._record_call(provider_name)
                
                if coins and len(coins) > 0:
                    logger.info(f"✅ Success: {len(coins)} coins from {provider_name}")
                    self.current_provider = provider_name  # Update current provider
                    return coins
                else:
                    logger.warning(f"⚠️ {provider_name} returned no coins")
                    self._record_error(provider_name)
                    
            except Exception as e:
                error_msg = str(e).lower()
                is_rate_limit = 'rate limit' in error_msg or '429' in error_msg
                
                self._record_error(provider_name, is_rate_limit)
                
                if is_rate_limit:
                    logger.warning(f"⚠️ {provider_name} rate limit exceeded")
                else:
                    logger.error(f"❌ {provider_name} error: {e}")
                
                # Try next provider
                continue
        
        # All providers failed
        logger.error("❌ All providers failed to fetch coins!")
        raise Exception("All crypto data providers failed")
    
    async def get_historical_data(self, symbol: str, days: int = 30) -> List[tuple]:
        """Fetch historical data with automatic provider fallback.
        
        Args:
            symbol: Coin symbol (e.g., 'BTC')
            days: Number of days of historical data
        
        Returns list of tuples: (timestamp, close_price, high, low, open)
        """
        providers_to_try = [self.current_provider]
        
        # If current is primary, also try backup
        if self.current_provider == self.primary_provider:
            providers_to_try.append(self.backup_provider)
        
        for provider_name in providers_to_try:
            provider = self._get_provider(provider_name)
            if not provider:
                continue
            
            try:
                data = await provider.get_historical_data(symbol, days)
                
                self._record_call(provider_name)
                
                if data and len(data) > 0:
                    return data
                else:
                    logger.warning(f"⚠️ {provider_name} returned no historical data for {symbol}")
                    self._record_error(provider_name)
                    
            except Exception as e:
                error_msg = str(e).lower()
                is_rate_limit = 'rate limit' in error_msg or '429' in error_msg
                
                self._record_error(provider_name, is_rate_limit)
                
                if is_rate_limit:
                    logger.warning(f"⚠️ {provider_name} rate limit exceeded for historical data")
                else:
                    logger.error(f"❌ {provider_name} historical data error: {e}")
                
                # Try next provider
                continue
        
        # All providers failed - return empty list
        logger.warning(f"⚠️ All providers failed to fetch historical data for {symbol}")
        return []
    
    async def get_4h_candles(self, symbol: str, limit: int = 168) -> List[Dict]:
        """Fetch 4-hour candles with automatic provider fallback.
        
        Phase 4: Multi-timeframe analysis
        Fallback order: CoinMarketCap → CoinGecko → CryptoCompare
        
        Args:
            symbol: Coin symbol (e.g., 'BTC')
            limit: Number of 4h candles to fetch (default 168 = 7 days)
        
        Returns list of dicts with OHLCV data for 4h timeframe
        """
        # Try all providers in order: primary → backup → tertiary (cryptocompare)
        providers_to_try = [self.current_provider]
        
        # Add backup provider if not already in list
        if self.backup_provider != self.current_provider and self.backup_provider not in providers_to_try:
            providers_to_try.append(self.backup_provider)
        
        # Always try cryptocompare as last resort for 4h candles
        if 'cryptocompare' not in providers_to_try:
            providers_to_try.append('cryptocompare')
        
        for provider_name in providers_to_try:
            provider = self._get_provider(provider_name)
            if not provider:
                continue
            
            # Check if provider supports 4h candles
            if not hasattr(provider, 'get_4h_candles'):
                logger.debug(f"⚠️ {provider_name} does not support 4h candles")
                continue
            
            try:
                logger.debug(f"📊 Fetching 4h candles from {provider_name} for {symbol}...")
                candles = await provider.get_4h_candles(symbol, limit)
                
                self._record_call(provider_name)
                
                if candles and len(candles) > 0:
                    logger.info(f"✅ Success: {len(candles)} 4h candles from {provider_name} for {symbol}")
                    return candles
                else:
                    logger.warning(f"⚠️ {provider_name} returned no 4h candles for {symbol}")
                    self._record_error(provider_name)
                    
            except Exception as e:
                error_msg = str(e).lower()
                is_rate_limit = 'rate limit' in error_msg or '429' in error_msg
                
                self._record_error(provider_name, is_rate_limit)
                
                if is_rate_limit:
                    logger.warning(f"⚠️ {provider_name} rate limit exceeded for 4h candles")
                else:
                    logger.error(f"❌ {provider_name} 4h candles error: {e}")
                
                # Try next provider
                continue
        
        # All providers failed - return empty list
        logger.warning(f"⚠️ All providers failed to fetch 4h candles for {symbol}")
        return []