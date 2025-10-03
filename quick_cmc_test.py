#!/usr/bin/env python3
"""
Quick CoinMarketCap Integration Verification
Tests the key requirements from the review request
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime

API_BASE = "https://smarttrade-ai-43.preview.emergentagent.com/api"

async def test_cmc_integration():
    """Test CoinMarketCap integration and provider status"""
    print("🔍 COINMARKETCAP PRIMARY PROVIDER VERIFICATION")
    print("=" * 60)
    
    async with aiohttp.ClientSession() as session:
        
        # Test 1: CoinMarketCap API Direct Access
        print("1. Testing CoinMarketCap API with key: 2bd6bec9-9bf0-4907-9c67-f8d5f43e3b2d")
        try:
            cmc_headers = {
                'X-CMC_PRO_API_KEY': '2bd6bec9-9bf0-4907-9c67-f8d5f43e3b2d',
                'Accept': 'application/json'
            }
            async with session.get(
                "https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest",
                headers=cmc_headers,
                params={'limit': 10}
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"   ✅ CoinMarketCap API accessible - fetched {len(data.get('data', []))} coins")
                else:
                    print(f"   ❌ CoinMarketCap API error: HTTP {response.status}")
        except Exception as e:
            print(f"   ❌ CoinMarketCap API error: {e}")
        
        print()
        
        # Test 2: Provider Status Hierarchy
        print("2. Testing provider status hierarchy...")
        try:
            async with session.get(f"{API_BASE}/api-providers/status") as response:
                if response.status == 200:
                    data = await response.json()
                    current = data.get('current_provider')
                    providers = data.get('providers', {})
                    
                    # Check hierarchy
                    cmc_role = providers.get('coinmarketcap', {}).get('role')
                    cg_role = providers.get('coingecko', {}).get('role')
                    cc_role = providers.get('cryptocompare', {}).get('role')
                    
                    print(f"   Current Provider: {current}")
                    print(f"   CoinMarketCap: {cmc_role} ({'✅' if cmc_role == 'Primary' else '❌'})")
                    print(f"   CoinGecko: {cg_role} ({'✅' if cg_role == 'Backup' else '❌'})")
                    print(f"   CryptoCompare: {cc_role} ({'✅' if cc_role == 'Tertiary' else '❌'})")
                    
                    # Check usage stats
                    cmc_calls = providers.get('coinmarketcap', {}).get('calls', 0)
                    cmc_errors = providers.get('coinmarketcap', {}).get('errors', 0)
                    print(f"   CoinMarketCap Usage: {cmc_calls} calls, {cmc_errors} errors")
                    
                else:
                    print(f"   ❌ Provider status error: HTTP {response.status}")
        except Exception as e:
            print(f"   ❌ Provider status error: {e}")
        
        print()
        
        # Test 3: Futures Provider Status
        print("3. Testing futures provider status (OKX Primary + Coinalyze Backup)...")
        try:
            async with session.get(f"{API_BASE}/futures-providers/status") as response:
                if response.status == 200:
                    data = await response.json()
                    providers = data.get('providers', {})
                    
                    okx_role = providers.get('okx', {}).get('role')
                    coinalyze_role = providers.get('coinalyze', {}).get('role')
                    
                    print(f"   OKX: {okx_role} ({'✅' if okx_role == 'Primary' else '❌'})")
                    print(f"   Coinalyze: {coinalyze_role} ({'✅' if coinalyze_role == 'Backup' else '❌'})")
                    
                    # Check success rates
                    okx_success = providers.get('okx', {}).get('success_rate', 0)
                    total_calls = data.get('total_calls', 0)
                    overall_success = data.get('overall_success_rate', 0)
                    
                    print(f"   OKX Success Rate: {okx_success:.1f}%")
                    print(f"   Total Calls: {total_calls}")
                    print(f"   Overall Success Rate: {overall_success:.1f}%")
                    
                else:
                    print(f"   ❌ Futures provider status error: HTTP {response.status}")
        except Exception as e:
            print(f"   ❌ Futures provider status error: {e}")
        
        print()
        
        # Test 4: Current Scan Status
        print("4. Checking current scan status...")
        try:
            async with session.get(f"{API_BASE}/scan/status") as response:
                if response.status == 200:
                    data = await response.json()
                    is_running = data.get('is_running')
                    recent_run = data.get('recent_run', {})
                    
                    if is_running:
                        started_at = recent_run.get('started_at')
                        scan_type = recent_run.get('scan_type')
                        total_bots = recent_run.get('total_bots')
                        
                        if started_at:
                            start_time = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
                            duration = (datetime.now(start_time.tzinfo) - start_time).total_seconds() / 60
                            print(f"   🔄 Scan running: {scan_type} ({duration:.1f} minutes)")
                            print(f"   🤖 Total bots: {total_bots}")
                        else:
                            print(f"   🔄 Scan running: {scan_type}")
                    else:
                        status = recent_run.get('status')
                        completed_at = recent_run.get('completed_at')
                        print(f"   ✅ Last scan: {status} at {completed_at}")
                        
                else:
                    print(f"   ❌ Scan status error: HTTP {response.status}")
        except Exception as e:
            print(f"   ❌ Scan status error: {e}")
        
        print()
        
        # Test 5: Health Check
        print("5. API Health Check...")
        try:
            async with session.get(f"{API_BASE}/health") as response:
                if response.status == 200:
                    data = await response.json()
                    status = data.get('status')
                    services = data.get('services', {})
                    print(f"   ✅ API Status: {status}")
                    print(f"   Database: {services.get('database')}")
                    print(f"   Scheduler: {services.get('scheduler')}")
                else:
                    print(f"   ❌ Health check error: HTTP {response.status}")
        except Exception as e:
            print(f"   ❌ Health check error: {e}")

if __name__ == "__main__":
    asyncio.run(test_cmc_integration())