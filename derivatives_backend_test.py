#!/usr/bin/env python3
"""
DERIVATIVES BACKEND INTEGRATION TEST

Test the backend's derivatives integration by checking:
1. If derivatives data is being fetched during scans
2. If derivatives data is included in bot features
3. If derivatives data appears in recommendations
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime, timezone

BACKEND_URL = "https://oracle-trading-1.preview.emergentagent.com"

class DerivativesBackendTest:
    def __init__(self):
        self.session = None
        self.auth_token = None
        self.scan_run_id = None
        
    async def setup(self):
        self.session = aiohttp.ClientSession()
        print("🔍 Testing Backend Derivatives Integration")
        print("=" * 60)
        
    async def cleanup(self):
        if self.session:
            await self.session.close()
            
    async def authenticate(self):
        """Authenticate with backend"""
        try:
            register_data = {
                "username": f"deriv_test_{int(time.time())}",
                "email": f"deriv_test_{int(time.time())}@test.com", 
                "password": "testpass123"
            }
            
            async with self.session.post(
                f"{BACKEND_URL}/api/auth/register",
                json=register_data
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    self.auth_token = data.get('access_token')
                    print(f"✅ Authenticated successfully")
                    return True
                else:
                    print(f"❌ Authentication failed: HTTP {response.status}")
                    return False
                    
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return False
            
    async def run_test_scan(self):
        """Run a scan with major coins that should have derivatives data"""
        try:
            if not self.auth_token:
                print("❌ No auth token available")
                return False
                
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            scan_data = {
                "scope": "custom",
                "custom_symbols": ["BTC", "ETH"],  # Major coins with futures
                "scan_type": "quick_scan"
            }
            
            print("🚀 Starting test scan with BTC and ETH...")
            async with self.session.post(
                f"{BACKEND_URL}/api/scan/run",
                json=scan_data,
                headers=headers
            ) as response:
                if response.status == 200:
                    print("✅ Scan initiated successfully")
                    return await self.wait_for_scan_completion()
                else:
                    print(f"❌ Scan initiation failed: HTTP {response.status}")
                    return False
                    
        except Exception as e:
            print(f"❌ Scan error: {e}")
            return False
            
    async def wait_for_scan_completion(self):
        """Wait for scan to complete and get run ID"""
        try:
            max_wait = 300  # 5 minutes
            start_time = time.time()
            
            print("⏳ Waiting for scan completion...")
            
            while time.time() - start_time < max_wait:
                async with self.session.get(f"{BACKEND_URL}/api/scan/status") as response:
                    if response.status == 200:
                        data = await response.json()
                        is_running = data.get('is_running', False)
                        recent_run = data.get('recent_run')
                        
                        if recent_run:
                            self.scan_run_id = recent_run.get('id')
                            status = recent_run.get('status')
                            
                            if status == 'completed':
                                print(f"✅ Scan completed: {self.scan_run_id}")
                                return True
                            elif status == 'failed':
                                error = recent_run.get('error_message', 'Unknown error')
                                print(f"❌ Scan failed: {error}")
                                return False
                                
                        if not is_running and recent_run and recent_run.get('status') == 'completed':
                            return True
                            
                await asyncio.sleep(5)
                print(".", end="", flush=True)
                
            print(f"\n❌ Scan timeout after {max_wait} seconds")
            return False
            
        except Exception as e:
            print(f"❌ Error waiting for scan: {e}")
            return False
            
    async def check_recommendations_for_derivatives(self):
        """Check if recommendations contain derivatives data"""
        try:
            if not self.auth_token or not self.scan_run_id:
                print("❌ Missing auth token or scan run ID")
                return False
                
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            print("\n🔍 Checking recommendations for derivatives data...")
            
            async with self.session.get(
                f"{BACKEND_URL}/api/recommendations/top5",
                headers=headers
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    recommendations = data.get('recommendations', [])
                    
                    print(f"📊 Found {len(recommendations)} recommendations")
                    
                    derivatives_fields = [
                        'open_interest', 'funding_rate', 'long_short_ratio',
                        'liquidation_risk', 'has_derivatives', 'funding_direction',
                        'long_account_percent', 'short_account_percent'
                    ]
                    
                    derivatives_found = False
                    
                    for i, rec in enumerate(recommendations):
                        coin = rec.get('coin', 'Unknown')
                        ticker = rec.get('ticker', 'Unknown')
                        
                        print(f"\n📈 Recommendation {i+1}: {coin} ({ticker})")
                        
                        found_fields = []
                        for field in derivatives_fields:
                            if field in rec:
                                found_fields.append(f"{field}: {rec[field]}")
                                derivatives_found = True
                                
                        if found_fields:
                            print(f"   ✅ Derivatives data: {', '.join(found_fields)}")
                        else:
                            print(f"   ❌ No derivatives data found")
                            
                    if derivatives_found:
                        print(f"\n✅ SUCCESS: Derivatives data found in recommendations!")
                        return True
                    else:
                        print(f"\n❌ FAILURE: No derivatives data found in any recommendations")
                        return False
                        
                elif response.status == 404:
                    print("❌ No recommendations found")
                    return False
                else:
                    print(f"❌ Error fetching recommendations: HTTP {response.status}")
                    return False
                    
        except Exception as e:
            print(f"❌ Error checking recommendations: {e}")
            return False
            
    async def check_bot_details_for_derivatives(self):
        """Check if bot details contain derivatives-enhanced analysis"""
        try:
            if not self.auth_token or not self.scan_run_id:
                print("❌ Missing auth token or scan run ID")
                return False
                
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            print("\n🤖 Checking bot details for derivatives-enhanced analysis...")
            
            # Try to get bot details for BTC
            async with self.session.get(
                f"{BACKEND_URL}/api/recommendations/{self.scan_run_id}/BTC/bot_details",
                headers=headers
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    bot_results = data.get('bot_results', [])
                    
                    print(f"🤖 Found {len(bot_results)} bot results for BTC")
                    
                    # Check if any bot rationales mention derivatives concepts
                    derivatives_keywords = [
                        'funding', 'open interest', 'liquidation', 'long/short',
                        'futures', 'derivatives', 'leverage'
                    ]
                    
                    enhanced_bots = 0
                    
                    for bot in bot_results[:5]:  # Check first 5 bots
                        bot_name = bot.get('bot_name', 'Unknown')
                        rationale = bot.get('rationale', '').lower()
                        
                        derivatives_mentions = [kw for kw in derivatives_keywords if kw in rationale]
                        
                        if derivatives_mentions:
                            enhanced_bots += 1
                            print(f"   ✅ {bot_name}: Mentions {', '.join(derivatives_mentions)}")
                        else:
                            print(f"   ❌ {bot_name}: No derivatives mentions")
                            
                    if enhanced_bots > 0:
                        print(f"\n✅ SUCCESS: {enhanced_bots}/{len(bot_results[:5])} bots show derivatives-enhanced analysis")
                        return True
                    else:
                        print(f"\n❌ No bots show derivatives-enhanced analysis")
                        return False
                        
                elif response.status == 404:
                    print("❌ No bot details found for BTC")
                    return False
                else:
                    print(f"❌ Error fetching bot details: HTTP {response.status}")
                    return False
                    
        except Exception as e:
            print(f"❌ Error checking bot details: {e}")
            return False
            
    async def test_direct_binance_access(self):
        """Test if the backend can access Binance Futures API"""
        print("\n🌐 Testing Binance Futures API accessibility...")
        
        # Test from the same environment as the backend
        try:
            # Test open interest endpoint
            async with self.session.get(
                "https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT",
                timeout=10
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    oi = data.get('openInterest', 0)
                    print(f"✅ Binance API accessible: BTC Open Interest = {oi}")
                    return True
                elif response.status == 451:
                    print("❌ Binance API blocked (HTTP 451 - Legal restrictions)")
                    return False
                else:
                    print(f"❌ Binance API error: HTTP {response.status}")
                    return False
                    
        except Exception as e:
            print(f"❌ Binance API connection error: {e}")
            return False
            
    async def run_comprehensive_test(self):
        """Run comprehensive derivatives integration test"""
        print("🚀 Starting Comprehensive Derivatives Integration Test")
        print("=" * 80)
        
        results = {
            'authentication': False,
            'binance_access': False,
            'scan_completion': False,
            'derivatives_in_recommendations': False,
            'derivatives_in_bot_analysis': False
        }
        
        # Test 1: Authentication
        results['authentication'] = await self.authenticate()
        
        # Test 2: Binance API Access
        results['binance_access'] = await self.test_direct_binance_access()
        
        # Test 3: Scan Completion
        if results['authentication']:
            results['scan_completion'] = await self.run_test_scan()
            
        # Test 4: Derivatives in Recommendations
        if results['scan_completion']:
            results['derivatives_in_recommendations'] = await self.check_recommendations_for_derivatives()
            
        # Test 5: Derivatives in Bot Analysis
        if results['scan_completion']:
            results['derivatives_in_bot_analysis'] = await self.check_bot_details_for_derivatives()
            
        # Print Summary
        print("\n" + "=" * 80)
        print("📊 DERIVATIVES INTEGRATION TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(results)
        passed_tests = sum(1 for result in results.values() if result)
        success_rate = (passed_tests / total_tests) * 100
        
        print(f"📈 Success Rate: {success_rate:.1f}% ({passed_tests}/{total_tests})")
        print()
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {test_name.replace('_', ' ').title()}: {status}")
            
        print("\n🎯 CRITICAL FINDINGS:")
        
        if not results['binance_access']:
            print("  🚨 CRITICAL: Binance Futures API is not accessible from this environment")
            print("     This explains why derivatives data is not being fetched")
            
        if results['scan_completion'] and not results['derivatives_in_recommendations']:
            print("  ⚠️  WARNING: Scans complete but no derivatives data in results")
            print("     Integration may be implemented but not working due to API access")
            
        if results['authentication'] and results['scan_completion']:
            print("  ✅ POSITIVE: Backend scan system is working correctly")
            
        print("\n📋 RECOMMENDATIONS:")
        
        if not results['binance_access']:
            print("  1. Check if Binance Futures API is blocked in this region/environment")
            print("  2. Consider using a VPN or proxy for Binance API access")
            print("  3. Implement fallback derivatives data source (e.g., CoinGlass, Coinalyze)")
            print("  4. Add proper error handling for blocked API access")
            
        if results['binance_access'] and not results['derivatives_in_recommendations']:
            print("  1. Check if derivatives data fetching is properly integrated in scan flow")
            print("  2. Verify that derivatives data is being passed to bots")
            print("  3. Check for errors in derivatives data processing")
            
        overall_status = "🟢 READY" if passed_tests >= 4 else "🟡 PARTIAL" if passed_tests >= 2 else "🔴 NOT READY"
        print(f"\n🏁 OVERALL STATUS: {overall_status}")
        
        return results

async def main():
    test = DerivativesBackendTest()
    
    try:
        await test.setup()
        results = await test.run_comprehensive_test()
        
    except Exception as e:
        print(f"❌ Test suite failed: {e}")
        
    finally:
        await test.cleanup()

if __name__ == "__main__":
    asyncio.run(main())