#!/usr/bin/env python3
"""
Quick Coinalyze API Test - Verify API accessibility and basic functionality
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime, timedelta, timezone

# Test configuration
COINALYZE_API_KEY = "f6967ffe-6773-4e5c-8772-d11900fe37e8"
TEST_COINS = ['BTC', 'ETH', 'SOL']
API_BASE = "https://crypto-oracle-27.preview.emergentagent.com/api"

async def test_coinalyze_apis():
    """Test Coinalyze API endpoints"""
    print("🔍 COINALYZE API QUICK TEST")
    print("=" * 50)
    
    async with aiohttp.ClientSession() as session:
        headers = {'api_key': COINALYZE_API_KEY}
        
        for coin in TEST_COINS:
            print(f"\n📊 Testing {coin}:")
            
            # Test Open Interest
            try:
                url = 'https://api.coinalyze.net/v1/open-interest'
                params = {'symbols': f'{coin.upper()}USDT_PERP.A'}
                
                async with session.get(url, headers=headers, params=params, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data and len(data) > 0:
                            oi = float(data[0].get('value', 0))
                            print(f"  ✅ Open Interest: {oi:,.2f}")
                        else:
                            print(f"  ⚠️ Open Interest: No data")
                    else:
                        print(f"  ❌ Open Interest: HTTP {response.status}")
            except Exception as e:
                print(f"  ❌ Open Interest: Error {e}")
            
            # Test Funding Rate
            try:
                url = 'https://api.coinalyze.net/v1/funding-rate'
                params = {'symbols': f'{coin.upper()}USDT_PERP.A'}
                
                async with session.get(url, headers=headers, params=params, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data and len(data) > 0:
                            fr = float(data[0].get('value', 0)) * 100
                            print(f"  ✅ Funding Rate: {fr:.4f}%")
                        else:
                            print(f"  ⚠️ Funding Rate: No data")
                    else:
                        print(f"  ❌ Funding Rate: HTTP {response.status}")
            except Exception as e:
                print(f"  ❌ Funding Rate: Error {e}")
            
            # Test Long/Short Ratio (with time parameters)
            try:
                url = 'https://api.coinalyze.net/v1/long-short-ratio'
                now = datetime.now(timezone.utc)
                from_time = int((now - timedelta(hours=1)).timestamp())
                to_time = int(now.timestamp())
                
                params = {
                    'symbols': f'{coin.upper()}USDT_PERP.A',
                    'interval': '1hour',
                    'from': from_time,
                    'to': to_time
                }
                
                async with session.get(url, headers=headers, params=params, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data and len(data) > 0:
                            ratio = float(data[-1].get('value', 1.0))
                            print(f"  ✅ Long/Short Ratio: {ratio:.3f}")
                        else:
                            print(f"  ⚠️ Long/Short Ratio: No data")
                    else:
                        error_text = await response.text()
                        print(f"  ❌ Long/Short Ratio: HTTP {response.status} - {error_text[:50]}")
            except Exception as e:
                print(f"  ❌ Long/Short Ratio: Error {e}")

async def test_backend_futures_status():
    """Test backend futures provider status"""
    print("\n🔧 BACKEND FUTURES PROVIDER STATUS")
    print("=" * 50)
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(f"{API_BASE}/futures-providers/status") as response:
                if response.status == 200:
                    data = await response.json()
                    providers = data.get('providers', {})
                    
                    print(f"Total providers: {len(providers)}")
                    for name, info in providers.items():
                        role = info.get('role', 'Unknown')
                        calls = info.get('calls', 0)
                        success = info.get('success', 0)
                        success_rate = info.get('success_rate', 0)
                        print(f"  {name.upper()}: {role} - {calls} calls, {success} success ({success_rate:.1f}%)")
                else:
                    print(f"❌ HTTP {response.status}")
        except Exception as e:
            print(f"❌ Error: {e}")

async def test_scan_status():
    """Check current scan status"""
    print("\n⚡ SCAN STATUS")
    print("=" * 50)
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(f"{API_BASE}/scan/status") as response:
                if response.status == 200:
                    data = await response.json()
                    is_running = data.get('is_running', False)
                    recent_run = data.get('recent_run', {})
                    
                    print(f"Scan running: {is_running}")
                    if recent_run:
                        print(f"Recent run ID: {recent_run.get('id', 'N/A')}")
                        print(f"Status: {recent_run.get('status', 'N/A')}")
                        print(f"Scan type: {recent_run.get('scan_type', 'N/A')}")
                        print(f"Total bots: {recent_run.get('total_bots', 'N/A')}")
                else:
                    print(f"❌ HTTP {response.status}")
        except Exception as e:
            print(f"❌ Error: {e}")

async def main():
    """Run all tests"""
    await test_coinalyze_apis()
    await test_backend_futures_status()
    await test_scan_status()
    
    print("\n" + "=" * 50)
    print("✅ Quick test complete!")

if __name__ == "__main__":
    asyncio.run(main())