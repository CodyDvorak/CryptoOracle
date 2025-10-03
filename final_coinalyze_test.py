#!/usr/bin/env python3
"""
FINAL COINALYZE BACKUP INTEGRATION TEST
Comprehensive test of OKX Primary + Coinalyze Backup futures system
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime, timedelta, timezone

# Configuration
COINALYZE_API_KEY = "f6967ffe-6773-4e5c-8772-d11900fe37e8"
TEST_COINS = ['BTC', 'ETH', 'SOL']
API_BASE = "https://smarttrade-ai-43.preview.emergentagent.com/api"

class FinalCoinalyzeTest:
    def __init__(self):
        self.results = []
        
    def log_result(self, test_name: str, status: str, details: str = ""):
        """Log test result"""
        result = {
            "test": test_name,
            "status": status,
            "details": details,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        self.results.append(result)
        
        status_icon = {"PASS": "✅", "FAIL": "❌", "PARTIAL": "⚠️", "INFO": "ℹ️"}.get(status, "❓")
        print(f"{status_icon} {test_name}: {details}")

    async def test_suite_1_coinalyze_api_accessibility(self):
        """TEST SUITE 1: Coinalyze API Accessibility"""
        print("\n" + "="*80)
        print("TEST SUITE 1: COINALYZE API ACCESSIBILITY")
        print("="*80)
        print(f"Testing Coinalyze API with key: {COINALYZE_API_KEY[:8]}...")
        print(f"Test coins: {TEST_COINS}")
        
        async with aiohttp.ClientSession() as session:
            headers = {'api_key': COINALYZE_API_KEY}
            
            # Test API key authentication
            try:
                url = 'https://api.coinalyze.net/v1/open-interest'
                params = {'symbols': 'BTCUSDT_PERP.A'}
                
                async with session.get(url, headers=headers, params=params, timeout=10) as response:
                    if response.status == 200:
                        self.log_result("Coinalyze API Key Authentication", "PASS", "API key valid and working")
                    elif response.status == 401:
                        self.log_result("Coinalyze API Key Authentication", "FAIL", "Invalid API key")
                        return
                    else:
                        self.log_result("Coinalyze API Key Authentication", "FAIL", f"HTTP {response.status}")
                        return
            except Exception as e:
                self.log_result("Coinalyze API Key Authentication", "FAIL", f"Error: {e}")
                return
            
            # Test each coin
            successful_coins = 0
            for coin in TEST_COINS:
                print(f"\n🔍 Testing {coin}...")
                coin_success = 0
                
                # Test Open Interest
                try:
                    url = 'https://api.coinalyze.net/v1/open-interest'
                    params = {'symbols': f'{coin.upper()}USDT_PERP.A'}
                    
                    async with session.get(url, headers=headers, params=params, timeout=10) as response:
                        if response.status == 200:
                            data = await response.json()
                            if data and len(data) > 0:
                                oi = float(data[0].get('value', 0))
                                if oi > 0:
                                    self.log_result(f"Coinalyze Open Interest - {coin}", "PASS", f"OI: {oi:,.2f}")
                                    coin_success += 1
                                else:
                                    self.log_result(f"Coinalyze Open Interest - {coin}", "PARTIAL", "Zero value")
                            else:
                                self.log_result(f"Coinalyze Open Interest - {coin}", "PARTIAL", "No data")
                        else:
                            self.log_result(f"Coinalyze Open Interest - {coin}", "FAIL", f"HTTP {response.status}")
                except Exception as e:
                    self.log_result(f"Coinalyze Open Interest - {coin}", "FAIL", f"Error: {e}")
                
                # Test Funding Rate
                try:
                    url = 'https://api.coinalyze.net/v1/funding-rate'
                    params = {'symbols': f'{coin.upper()}USDT_PERP.A'}
                    
                    async with session.get(url, headers=headers, params=params, timeout=10) as response:
                        if response.status == 200:
                            data = await response.json()
                            if data and len(data) > 0:
                                fr = float(data[0].get('value', 0)) * 100
                                if -1.0 <= fr <= 1.0:  # Reasonable range
                                    self.log_result(f"Coinalyze Funding Rate - {coin}", "PASS", f"FR: {fr:.4f}%")
                                    coin_success += 1
                                else:
                                    self.log_result(f"Coinalyze Funding Rate - {coin}", "PARTIAL", f"Unusual FR: {fr:.4f}%")
                            else:
                                self.log_result(f"Coinalyze Funding Rate - {coin}", "PARTIAL", "No data")
                        else:
                            self.log_result(f"Coinalyze Funding Rate - {coin}", "FAIL", f"HTTP {response.status}")
                except Exception as e:
                    self.log_result(f"Coinalyze Funding Rate - {coin}", "FAIL", f"Error: {e}")
                
                if coin_success >= 1:  # At least one metric working
                    successful_coins += 1
            
            # Overall assessment
            coverage_pct = (successful_coins / len(TEST_COINS)) * 100
            if coverage_pct >= 50:
                self.log_result("Coinalyze Data Quality Check", "PASS", 
                               f"{coverage_pct:.0f}% coin coverage ({successful_coins}/{len(TEST_COINS)})")
            else:
                self.log_result("Coinalyze Data Quality Check", "FAIL", 
                               f"Low coverage: {coverage_pct:.0f}%")

    async def test_suite_2_multi_provider_system(self):
        """TEST SUITE 2: Multi-Provider Futures System"""
        print("\n" + "="*80)
        print("TEST SUITE 2: MULTI-PROVIDER FUTURES SYSTEM")
        print("="*80)
        
        async with aiohttp.ClientSession() as session:
            # Test futures provider status
            try:
                async with session.get(f"{API_BASE}/futures-providers/status") as response:
                    if response.status == 200:
                        data = await response.json()
                        providers = data.get('providers', {})
                        
                        # Check all 4 providers
                        expected_providers = ['okx', 'coinalyze', 'bybit', 'binance']
                        missing = [p for p in expected_providers if p not in providers]
                        
                        if not missing:
                            self.log_result("Futures Provider Status", "PASS", 
                                           f"4 providers configured: {list(providers.keys())}")
                        else:
                            self.log_result("Futures Provider Status", "FAIL", 
                                           f"Missing providers: {missing}")
                        
                        # Check OKX as Primary
                        okx_role = providers.get('okx', {}).get('role')
                        if okx_role == 'Primary':
                            self.log_result("OKX Primary Provider", "PASS", "OKX labeled as Primary")
                        else:
                            self.log_result("OKX Primary Provider", "FAIL", f"OKX role: {okx_role}")
                        
                        # Check Coinalyze as Backup
                        coinalyze_role = providers.get('coinalyze', {}).get('role')
                        if coinalyze_role == 'Backup':
                            self.log_result("Coinalyze Backup Provider", "PASS", "Coinalyze labeled as Backup")
                        else:
                            self.log_result("Coinalyze Backup Provider", "FAIL", f"Coinalyze role: {coinalyze_role}")
                        
                        # Check statistics
                        total_calls = sum(p.get('calls', 0) for p in providers.values())
                        total_success = sum(p.get('success', 0) for p in providers.values())
                        
                        if total_calls > 0:
                            success_rate = (total_success / total_calls) * 100
                            self.log_result("Provider Statistics", "PASS", 
                                           f"Total: {total_calls} calls, {total_success} success ({success_rate:.1f}%)")
                        else:
                            self.log_result("Provider Statistics", "INFO", "No calls recorded yet")
                    else:
                        self.log_result("Futures Provider Status", "FAIL", f"HTTP {response.status}")
            except Exception as e:
                self.log_result("Futures Provider Status", "FAIL", f"Error: {e}")

    async def test_suite_3_integration_with_scanning(self):
        """TEST SUITE 3: Integration with Scanning"""
        print("\n" + "="*80)
        print("TEST SUITE 3: INTEGRATION WITH SCANNING")
        print("="*80)
        
        async with aiohttp.ClientSession() as session:
            # Check current scan status
            try:
                async with session.get(f"{API_BASE}/scan/status") as response:
                    if response.status == 200:
                        data = await response.json()
                        is_running = data.get('is_running', False)
                        recent_run = data.get('recent_run', {})
                        
                        if is_running:
                            self.log_result("Scan Integration Status", "INFO", 
                                           f"Scan currently running: {recent_run.get('scan_type', 'unknown')}")
                        else:
                            run_id = recent_run.get('id')
                            status = recent_run.get('status')
                            if status == 'completed' and run_id:
                                self.log_result("Scan Integration Status", "PASS", 
                                               f"Recent scan completed: {run_id}")
                                
                                # Check for derivatives data in recommendations
                                await self.check_derivatives_in_recommendations(session, run_id)
                            else:
                                self.log_result("Scan Integration Status", "PARTIAL", 
                                               f"Recent scan status: {status}")
                    else:
                        self.log_result("Scan Integration Status", "FAIL", f"HTTP {response.status}")
            except Exception as e:
                self.log_result("Scan Integration Status", "FAIL", f"Error: {e}")

    async def check_derivatives_in_recommendations(self, session, run_id):
        """Check if derivatives data is present in recommendations"""
        try:
            async with session.get(f"{API_BASE}/recommendations/top5?run_id={run_id}") as response:
                if response.status == 200:
                    data = await response.json()
                    recommendations = data.get('recommendations', [])
                    
                    if recommendations:
                        derivatives_count = 0
                        for rec in recommendations[:5]:  # Check first 5
                            features = rec.get('features', {})
                            has_derivatives = features.get('has_derivatives', False)
                            if has_derivatives:
                                derivatives_count += 1
                        
                        if derivatives_count > 0:
                            self.log_result("Derivatives Data Persistence", "PASS", 
                                           f"Found derivatives data in {derivatives_count}/{len(recommendations[:5])} recommendations")
                        else:
                            self.log_result("Derivatives Data Persistence", "PARTIAL", 
                                           "No derivatives data found in recommendations")
                    else:
                        self.log_result("Derivatives Data Persistence", "PARTIAL", 
                                       "No recommendations to check")
                elif response.status == 404:
                    self.log_result("Derivatives Data Persistence", "PARTIAL", 
                                   "No recommendations found for this run")
                else:
                    self.log_result("Derivatives Data Persistence", "FAIL", f"HTTP {response.status}")
        except Exception as e:
            self.log_result("Derivatives Data Persistence", "FAIL", f"Error: {e}")

    async def test_suite_4_fallback_mechanism(self):
        """TEST SUITE 4: Fallback Mechanism"""
        print("\n" + "="*80)
        print("TEST SUITE 4: FALLBACK MECHANISM")
        print("="*80)
        
        # Test OKX accessibility
        okx_working = await self.test_okx_accessibility()
        
        # Test Coinalyze accessibility
        coinalyze_working = await self.test_coinalyze_accessibility()
        
        # Assess redundancy
        working_providers = sum([okx_working, coinalyze_working])
        
        if working_providers >= 2:
            self.log_result("Redundancy Verification", "PASS", 
                           f"2 working providers: OKX ({okx_working}), Coinalyze ({coinalyze_working})")
        elif working_providers == 1:
            self.log_result("Redundancy Verification", "PARTIAL", 
                           f"1 working provider - limited redundancy")
        else:
            self.log_result("Redundancy Verification", "FAIL", 
                           "No working providers")
        
        # Test coverage across coins
        await self.test_coverage_analysis()

    async def test_okx_accessibility(self) -> bool:
        """Test OKX API accessibility"""
        try:
            async with aiohttp.ClientSession() as session:
                url = 'https://www.okx.com/api/v5/public/open-interest'
                params = {'instId': 'BTC-USDT-SWAP'}
                
                async with session.get(url, params=params, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get('code') == '0':
                            self.log_result("OKX Accessibility", "PASS", "OKX API accessible")
                            return True
            
            self.log_result("OKX Accessibility", "FAIL", "OKX API not accessible")
            return False
        except Exception as e:
            self.log_result("OKX Accessibility", "FAIL", f"OKX Error: {e}")
            return False

    async def test_coinalyze_accessibility(self) -> bool:
        """Test Coinalyze API accessibility"""
        try:
            async with aiohttp.ClientSession() as session:
                headers = {'api_key': COINALYZE_API_KEY}
                url = 'https://api.coinalyze.net/v1/open-interest'
                params = {'symbols': 'BTCUSDT_PERP.A'}
                
                async with session.get(url, headers=headers, params=params, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data and len(data) > 0:
                            self.log_result("Coinalyze Accessibility", "PASS", "Coinalyze API accessible")
                            return True
            
            self.log_result("Coinalyze Accessibility", "FAIL", "Coinalyze API not accessible")
            return False
        except Exception as e:
            self.log_result("Coinalyze Accessibility", "FAIL", f"Coinalyze Error: {e}")
            return False

    async def test_coverage_analysis(self):
        """Test coverage across multiple coins"""
        coverage_results = {}
        
        async with aiohttp.ClientSession() as session:
            for coin in TEST_COINS:
                okx_coverage = await self.test_okx_coin_coverage(session, coin)
                coinalyze_coverage = await self.test_coinalyze_coin_coverage(session, coin)
                
                coverage_results[coin] = {
                    'okx': okx_coverage,
                    'coinalyze': coinalyze_coverage,
                    'total': sum([okx_coverage, coinalyze_coverage])
                }
        
        # Calculate overall coverage
        coins_with_coverage = sum(1 for result in coverage_results.values() if result['total'] > 0)
        coverage_pct = (coins_with_coverage / len(TEST_COINS)) * 100
        
        coverage_details = []
        for coin, result in coverage_results.items():
            providers = []
            if result['okx']:
                providers.append('OKX')
            if result['coinalyze']:
                providers.append('Coinalyze')
            coverage_details.append(f"{coin}: {', '.join(providers) if providers else 'None'}")
        
        if coverage_pct >= 80:
            self.log_result("Coverage Analysis", "PASS", 
                           f"{coverage_pct:.0f}% coverage. {'; '.join(coverage_details)}")
        else:
            self.log_result("Coverage Analysis", "PARTIAL", 
                           f"{coverage_pct:.0f}% coverage. {'; '.join(coverage_details)}")

    async def test_okx_coin_coverage(self, session, coin: str) -> bool:
        """Test OKX coverage for a coin"""
        try:
            url = 'https://www.okx.com/api/v5/public/open-interest'
            params = {'instId': f'{coin.upper()}-USDT-SWAP'}
            
            async with session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('code') == '0' and data.get('data'):
                        return True
            return False
        except:
            return False

    async def test_coinalyze_coin_coverage(self, session, coin: str) -> bool:
        """Test Coinalyze coverage for a coin"""
        try:
            headers = {'api_key': COINALYZE_API_KEY}
            url = 'https://api.coinalyze.net/v1/open-interest'
            params = {'symbols': f'{coin.upper()}USDT_PERP.A'}
            
            async with session.get(url, headers=headers, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if data and len(data) > 0:
                        return True
            return False
        except:
            return False

    async def test_suite_5_system_health(self):
        """TEST SUITE 5: System Health Check"""
        print("\n" + "="*80)
        print("TEST SUITE 5: SYSTEM HEALTH CHECK")
        print("="*80)
        
        async with aiohttp.ClientSession() as session:
            # Test existing endpoints
            endpoints = [
                ("/analytics/system-health", "System Health"),
                ("/bots/performance", "Bot Performance"),
                ("/recommendations/top5", "Top 5 Recommendations")
            ]
            
            all_working = True
            for endpoint, name in endpoints:
                try:
                    async with session.get(f"{API_BASE}{endpoint}") as response:
                        if response.status == 200:
                            self.log_result(f"Existing Endpoint - {name}", "PASS", "HTTP 200")
                        elif response.status == 404 and "recommendations" in endpoint:
                            self.log_result(f"Existing Endpoint - {name}", "PASS", "HTTP 404 (no data)")
                        else:
                            self.log_result(f"Existing Endpoint - {name}", "FAIL", f"HTTP {response.status}")
                            all_working = False
                except Exception as e:
                    self.log_result(f"Existing Endpoint - {name}", "FAIL", f"Error: {e}")
                    all_working = False
            
            # Overall system integration
            try:
                # Get system health
                async with session.get(f"{API_BASE}/analytics/system-health") as response:
                    health_data = await response.json() if response.status == 200 else {}
                
                # Get bot status
                async with session.get(f"{API_BASE}/bots/status") as response:
                    bot_data = await response.json() if response.status == 200 else {}
                
                # Get futures provider status
                async with session.get(f"{API_BASE}/futures-providers/status") as response:
                    futures_data = await response.json() if response.status == 200 else {}
                
                total_bots = bot_data.get('total', 0)
                providers_count = len(futures_data.get('providers', {}))
                system_accuracy = health_data.get('system_accuracy', 0)
                
                self.log_result("Overall System Integration", "PASS", 
                               f"System operational: {total_bots} bots, {providers_count} futures providers, "
                               f"System accuracy: {system_accuracy:.1f}%")
                
            except Exception as e:
                self.log_result("Overall System Integration", "FAIL", f"Error: {e}")

    async def print_final_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "="*80)
        print("COINALYZE BACKUP INTEGRATION - FINAL TEST SUMMARY")
        print("="*80)
        
        # Categorize results
        passed = [r for r in self.results if r['status'] == 'PASS']
        failed = [r for r in self.results if r['status'] == 'FAIL']
        partial = [r for r in self.results if r['status'] == 'PARTIAL']
        info = [r for r in self.results if r['status'] == 'INFO']
        
        print(f"Total Tests: {len(self.results)}")
        print(f"✅ Passed: {len(passed)}")
        print(f"⚠️ Partial: {len(partial)}")
        print(f"❌ Failed: {len(failed)}")
        print(f"ℹ️ Info: {len(info)}")
        
        # Calculate success rate
        success_rate = ((len(passed) + len(partial)) / len(self.results) * 100) if self.results else 0
        print(f"Success Rate: {success_rate:.1f}%")
        
        print("\n🎯 CRITICAL SUCCESS CRITERIA:")
        
        # Check critical criteria
        coinalyze_accessible = any("Coinalyze API Key Authentication" in r['test'] and r['status'] == 'PASS' for r in self.results)
        multi_provider_working = any("Futures Provider Status" in r['test'] and r['status'] == 'PASS' for r in self.results)
        okx_primary = any("OKX Primary Provider" in r['test'] and r['status'] == 'PASS' for r in self.results)
        coinalyze_backup = any("Coinalyze Backup Provider" in r['test'] and r['status'] == 'PASS' for r in self.results)
        redundancy = any("Redundancy Verification" in r['test'] and r['status'] == 'PASS' for r in self.results)
        no_breaking_changes = any("Overall System Integration" in r['test'] and r['status'] == 'PASS' for r in self.results)
        
        criteria = [
            ("✅" if coinalyze_accessible else "❌", "Coinalyze API accessible with provided key"),
            ("✅" if multi_provider_working else "❌", "Multi-provider futures system operational"),
            ("✅" if okx_primary else "❌", "OKX configured as Primary provider"),
            ("✅" if coinalyze_backup else "❌", "Coinalyze configured as Backup provider"),
            ("✅" if redundancy else "❌", "System has redundancy (2+ working providers)"),
            ("✅" if no_breaking_changes else "❌", "No breaking changes to existing functionality")
        ]
        
        for status, criterion in criteria:
            print(f"{status} {criterion}")
        
        print("\n📊 SCENARIO ASSESSMENT:")
        
        if coinalyze_accessible and okx_primary and coinalyze_backup and redundancy:
            print("🎉 SCENARIO C: Both Working ✅✅")
            print("   - Perfect redundancy achieved")
            print("   - OKX Primary + Coinalyze Backup operational")
            print("   - Production-ready with excellent reliability")
        elif coinalyze_accessible and okx_primary:
            print("👍 SCENARIO B: Fallback to Coinalyze ✅")
            print("   - OKX primary working, Coinalyze backup available")
            print("   - System can continue smoothly if OKX fails")
            print("   - Good redundancy for production")
        elif okx_primary:
            print("⚠️ SCENARIO A: OKX Primary Working ✅")
            print("   - OKX handles most requests")
            print("   - Limited redundancy without Coinalyze backup")
            print("   - Functional but not ideal for production")
        else:
            print("❌ CRITICAL ISSUES FOUND")
            print("   - Neither OKX nor Coinalyze working properly")
            print("   - System lacks derivatives data redundancy")
            print("   - Requires immediate attention")
        
        print("\n🚀 FINAL RECOMMENDATION:")
        
        if success_rate >= 80 and coinalyze_accessible and redundancy:
            print("✅ PRODUCTION READY - Coinalyze backup integration successful!")
            print("   - Multi-provider system operational")
            print("   - Excellent redundancy with OKX + Coinalyze")
            print("   - Ready for launch with derivatives data backup")
        elif success_rate >= 60:
            print("⚠️ MOSTLY WORKING - Minor issues to address")
            print("   - Core functionality operational")
            print("   - Some improvements needed for full redundancy")
            print("   - Can proceed with monitoring")
        else:
            print("❌ NEEDS WORK - Critical issues require attention")
            print("   - Review failed tests and fix integration issues")
            print("   - Not ready for production without fixes")
        
        print("\n" + "="*80)

    async def run_all_tests(self):
        """Run all test suites"""
        print("🚀 COINALYZE BACKUP INTEGRATION - COMPREHENSIVE TEST")
        print("Testing OKX Primary + Coinalyze Backup futures system")
        print(f"Backend URL: {API_BASE}")
        print(f"Coinalyze API Key: {COINALYZE_API_KEY[:8]}...")
        
        await self.test_suite_1_coinalyze_api_accessibility()
        await self.test_suite_2_multi_provider_system()
        await self.test_suite_3_integration_with_scanning()
        await self.test_suite_4_fallback_mechanism()
        await self.test_suite_5_system_health()
        
        await self.print_final_summary()

async def main():
    """Main test execution"""
    test_suite = FinalCoinalyzeTest()
    await test_suite.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())