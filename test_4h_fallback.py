#!/usr/bin/env python3
"""
Test script for 4h candles multi-provider fallback.
Tests: CoinMarketCap → CoinGecko → CryptoCompare
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, '/app/backend')

from services.multi_provider_client import MultiProviderClient

async def test_4h_candles():
    """Test 4h candles fallback across all providers."""
    print("=" * 70)
    print("Testing 4h Candles Multi-Provider Fallback")
    print("=" * 70)
    
    client = MultiProviderClient()
    
    test_symbols = ['BTC', 'ETH', 'SOL']
    
    for symbol in test_symbols:
        print(f"\n📊 Testing {symbol}...")
        print("-" * 50)
        
        try:
            candles = await client.get_4h_candles(symbol, limit=10)  # Just fetch 10 for testing
            
            if candles:
                print(f"✅ Success! Fetched {len(candles)} 4h candles for {symbol}")
                print(f"   First candle: {candles[0]}")
                print(f"   Last candle: {candles[-1]}")
            else:
                print(f"❌ No candles returned for {symbol}")
                
        except Exception as e:
            print(f"❌ Error fetching 4h candles for {symbol}: {e}")
    
    # Print provider statistics
    print("\n" + "=" * 70)
    print("Provider Statistics")
    print("=" * 70)
    stats = client.get_stats()
    print(f"Current Provider: {stats['current_provider']}")
    print(f"Primary Provider: {stats['primary_provider']}")
    print(f"Backup Provider: {stats['backup_provider']}")
    print("\nCall Statistics:")
    for provider, data in stats['stats'].items():
        print(f"  {provider}:")
        print(f"    Calls: {data['calls']}")
        print(f"    Errors: {data['errors']}")
        print(f"    Rate Limits: {data['rate_limits']}")
    
    # Close client
    await client.close()
    print("\n✅ Test complete!")

if __name__ == '__main__':
    asyncio.run(test_4h_candles())
