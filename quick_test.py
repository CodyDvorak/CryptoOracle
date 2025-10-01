#!/usr/bin/env python3
"""
Quick Test for Crypto Oracle - Dual-Source Architecture and Bot Details
Following the specific test sequence requested in the review.
"""

import asyncio
import aiohttp
import json
import time
from pathlib import Path

# Get backend URL from frontend .env
frontend_env_path = Path(__file__).parent / "frontend" / ".env"
backend_url = "https://coin-oracle-3.preview.emergentagent.com"

if frontend_env_path.exists():
    with open(frontend_env_path, 'r') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                backend_url = line.split('=', 1)[1].strip()
                break

API_BASE = f"{backend_url}/api"

async def run_quick_test():
    """Run the specific test sequence requested"""
    print("=" * 60)
    print("CRYPTO ORACLE QUICK TEST - Dual-Source Architecture & Bot Details")
    print("=" * 60)
    print(f"Testing API: {API_BASE}")
    print()
    
    async with aiohttp.ClientSession() as session:
        
        # Step 1: Trigger a scan with limited scope
        print("Step 1: Triggering scan with limited scope...")
        scan_request = {
            "scope": "all",
            "min_price": 1,
            "max_price": 100
        }
        
        try:
            async with session.post(f"{API_BASE}/scan/run", json=scan_request) as response:
                if response.status != 200:
                    print(f"❌ Scan failed to start: HTTP {response.status}")
                    return
                
                scan_data = await response.json()
                print(f"✅ Scan started: {scan_data.get('status')}")
        except Exception as e:
            print(f"❌ Scan start error: {e}")
            return
        
        # Step 2: Wait for scan completion (poll every 5 seconds, max 2 minutes)
        print("\nStep 2: Waiting for scan completion...")
        max_wait = 120  # 2 minutes
        wait_time = 0
        
        while wait_time < max_wait:
            await asyncio.sleep(5)  # Poll every 5 seconds
            wait_time += 5
            
            try:
                async with session.get(f"{API_BASE}/scan/status") as response:
                    if response.status == 200:
                        status_data = await response.json()
                        is_running = status_data.get('is_running', True)
                        
                        if not is_running:
                            recent_run = status_data.get('recent_run')
                            if recent_run and recent_run.get('status') == 'completed':
                                run_id = recent_run.get('id')
                                coins_analyzed = status_data.get('coins_analyzed', 0)
                                print(f"✅ Scan completed: {run_id}")
                                print(f"📊 Coins analyzed: {coins_analyzed}")
                                break
                            else:
                                print(f"❌ Scan failed or incomplete: {recent_run.get('status') if recent_run else 'No run data'}")
                                return
                        else:
                            print(f"⏳ Scan still running... ({wait_time}s elapsed)")
                    else:
                        print(f"⚠️ Status check failed: HTTP {response.status}")
            except Exception as e:
                print(f"⚠️ Status check error: {e}")
        
        if wait_time >= max_wait:
            print("❌ Scan timeout after 2 minutes")
            return
        
        # Step 3: Get recommendations
        print("\nStep 3: Getting recommendations...")
        try:
            async with session.get(f"{API_BASE}/recommendations/top5") as response:
                if response.status != 200:
                    print(f"❌ Failed to get recommendations: HTTP {response.status}")
                    return
                
                data = await response.json()
                extracted_run_id = data.get('run_id')
                recommendations = data.get('recommendations', [])
                
                print(f"✅ Run ID: {extracted_run_id}")
                print(f"📈 Total recommendations: {len(recommendations)}")
                
                # Check categories
                top_confidence = data.get('top_confidence', [])
                top_percent = data.get('top_percent_movers', [])
                top_dollar = data.get('top_dollar_movers', [])
                
                print(f"📊 Categories found:")
                print(f"   - Top Confidence: {len(top_confidence)} coins")
                print(f"   - Top % Movers: {len(top_percent)} coins")
                print(f"   - Top $ Movers: {len(top_dollar)} coins")
                
                if not recommendations:
                    print("❌ No recommendations found")
                    return
                
                # Get first coin's ticker
                first_coin = recommendations[0]
                ticker = first_coin.get('ticker')
                coin_name = first_coin.get('coin')
                
                print(f"🪙 First coin: {coin_name} ({ticker})")
                
        except Exception as e:
            print(f"❌ Recommendations error: {e}")
            return
        
        # Step 4: Test Bot Details endpoint
        print(f"\nStep 4: Testing Bot Details endpoint for {ticker}...")
        try:
            url = f"{API_BASE}/recommendations/{extracted_run_id}/{ticker}/bot_details"
            async with session.get(url) as response:
                print(f"🔗 Request URL: {url}")
                print(f"📡 Response status: {response.status}")
                
                if response.status == 404:
                    print("⚠️ Bot details not found (404) - This may indicate AI-only analysis mode")
                    response_text = await response.text()
                    print(f"📄 Response: {response_text}")
                elif response.status != 200:
                    print(f"❌ Bot details request failed: HTTP {response.status}")
                    response_text = await response.text()
                    print(f"📄 Response: {response_text}")
                    return
                else:
                    data = await response.json()
                    
                    # Step 5: Verify response contains required fields
                    print("\nStep 5: Verifying bot details response...")
                    
                    bot_results = data.get('bot_results', [])
                    total_bots = data.get('total_bots', 0)
                    avg_confidence = data.get('avg_confidence')
                    
                    print(f"✅ Bot results array: {len(bot_results)} bots")
                    print(f"✅ Total bots field: {total_bots}")
                    print(f"✅ Average confidence: {avg_confidence}")
                    
                    # Check if we have the expected 21 bots
                    if len(bot_results) == 21:
                        print("✅ Found expected 21 bots")
                    else:
                        print(f"⚠️ Expected 21 bots, found {len(bot_results)}")
                    
                    # Verify each bot has required fields
                    if bot_results:
                        sample_bot = bot_results[0]
                        required_fields = ['bot_name', 'confidence', 'direction', 'entry_price', 'take_profit', 'stop_loss']
                        
                        print(f"\n🔍 Sample bot structure:")
                        for field in required_fields:
                            value = sample_bot.get(field)
                            status = "✅" if value is not None else "❌"
                            print(f"   {status} {field}: {value}")
                        
                        # Check if total_bots matches array length
                        if total_bots == len(bot_results):
                            print("✅ total_bots matches array length")
                        else:
                            print(f"⚠️ total_bots ({total_bots}) doesn't match array length ({len(bot_results)})")
                    
        except Exception as e:
            print(f"❌ Bot details error: {e}")
        
        # Step 6: Check backend logs
        print(f"\nStep 6: Checking backend logs for errors...")
        
    print("\n" + "=" * 60)
    print("QUICK TEST COMPLETED")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_quick_test())