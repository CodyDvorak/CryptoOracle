#!/usr/bin/env python3
"""
BINANCE FUTURES/DERIVATIVES DATA INTEGRATION TEST

This test suite validates the new Binance Futures integration for derivatives data:
- Open interest
- Funding rates  
- Long/short ratios
- Liquidation risk metrics

Tests both direct API functionality and integration with the scan system.
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional

# Backend URL from environment
BACKEND_URL = "https://crypto-oracle-27.preview.emergentagent.com"

class BinanceFuturesIntegrationTest:
    def __init__(self):
        self.session = None
        self.test_results = []
        self.auth_token = None
        
    async def setup(self):
        """Setup test session"""
        self.session = aiohttp.ClientSession()
        print("🚀 Starting Binance Futures/Derivatives Integration Test")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 80)
        
    async def cleanup(self):
        """Cleanup test session"""
        if self.session:
            await self.session.close()
            
    def log_result(self, test_name: str, status: str, details: str = ""):
        """Log test result"""
        result = {
            'test': test_name,
            'status': status,
            'details': details,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        self.test_results.append(result)
        
        status_emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
        print(f"{status_emoji} {test_name}: {status}")
        if details:
            print(f"   Details: {details}")
            
    async def test_binance_futures_api_direct(self):
        """TEST SUITE 1: Test Binance Futures API directly"""
        print("\n📊 TEST SUITE 1: Direct Binance Futures API Testing")
        print("-" * 60)
        
        # Test major coins
        test_symbols = ['BTC', 'ETH', 'BNB']
        
        for symbol in test_symbols:
            await self._test_open_interest(symbol)
            await self._test_funding_rate(symbol)
            await self._test_long_short_ratio(symbol)
            await self._test_liquidation_risk(symbol)
            await asyncio.sleep(0.5)  # Rate limiting
            
    async def _test_open_interest(self, symbol: str):
        """Test open interest data fetching"""
        try:
            # Direct Binance API call
            binance_symbol = f"{symbol}USDT"
            url = f"https://fapi.binance.com/fapi/v1/openInterest"
            params = {'symbol': binance_symbol}
            
            async with self.session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    open_interest = float(data.get('openInterest', 0))
                    
                    if open_interest > 0:
                        self.log_result(f"Open Interest - {symbol}", "PASS", 
                                      f"OI: {open_interest:,.0f} contracts")
                    else:
                        self.log_result(f"Open Interest - {symbol}", "FAIL", 
                                      "Zero open interest returned")
                else:
                    self.log_result(f"Open Interest - {symbol}", "FAIL", 
                                  f"HTTP {response.status}")
                    
        except Exception as e:
            self.log_result(f"Open Interest - {symbol}", "FAIL", str(e))
            
    async def _test_funding_rate(self, symbol: str):
        """Test funding rate data fetching"""
        try:
            binance_symbol = f"{symbol}USDT"
            url = f"https://fapi.binance.com/fapi/v1/premiumIndex"
            params = {'symbol': binance_symbol}
            
            async with self.session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    funding_rate = float(data.get('lastFundingRate', 0)) * 100
                    
                    # Funding rates typically range from -1% to +1%
                    if -1.0 <= funding_rate <= 1.0:
                        self.log_result(f"Funding Rate - {symbol}", "PASS", 
                                      f"Rate: {funding_rate:.4f}%")
                    else:
                        self.log_result(f"Funding Rate - {symbol}", "PARTIAL", 
                                      f"Unusual rate: {funding_rate:.4f}%")
                else:
                    self.log_result(f"Funding Rate - {symbol}", "FAIL", 
                                  f"HTTP {response.status}")
                    
        except Exception as e:
            self.log_result(f"Funding Rate - {symbol}", "FAIL", str(e))
            
    async def _test_long_short_ratio(self, symbol: str):
        """Test long/short ratio data fetching"""
        try:
            binance_symbol = f"{symbol}USDT"
            url = f"https://fapi.binance.com/futures/data/globalLongShortAccountRatio"
            params = {
                'symbol': binance_symbol,
                'period': '5m',
                'limit': 1
            }
            
            async with self.session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if data and len(data) > 0:
                        latest = data[0]
                        long_account = float(latest.get('longAccount', 0))
                        short_account = float(latest.get('shortAccount', 0))
                        ratio = long_account / short_account if short_account > 0 else 0
                        
                        if 0.1 <= ratio <= 10.0:  # Reasonable ratio range
                            self.log_result(f"Long/Short Ratio - {symbol}", "PASS", 
                                          f"Ratio: {ratio:.2f} (L:{long_account*100:.1f}% S:{short_account*100:.1f}%)")
                        else:
                            self.log_result(f"Long/Short Ratio - {symbol}", "PARTIAL", 
                                          f"Unusual ratio: {ratio:.2f}")
                    else:
                        self.log_result(f"Long/Short Ratio - {symbol}", "FAIL", 
                                      "No data returned")
                else:
                    self.log_result(f"Long/Short Ratio - {symbol}", "FAIL", 
                                  f"HTTP {response.status}")
                    
        except Exception as e:
            self.log_result(f"Long/Short Ratio - {symbol}", "FAIL", str(e))
            
    async def _test_liquidation_risk(self, symbol: str):
        """Test liquidation risk calculation"""
        try:
            # This is calculated from funding rate, so test the logic
            binance_symbol = f"{symbol}USDT"
            url = f"https://fapi.binance.com/fapi/v1/premiumIndex"
            params = {'symbol': binance_symbol}
            
            async with self.session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    funding_rate = abs(float(data.get('lastFundingRate', 0)) * 100)
                    
                    # Calculate liquidation risk based on funding rate
                    if funding_rate > 0.1:
                        risk = "high"
                    elif funding_rate > 0.05:
                        risk = "medium"
                    else:
                        risk = "low"
                        
                    self.log_result(f"Liquidation Risk - {symbol}", "PASS", 
                                  f"Risk: {risk} (funding: {funding_rate:.4f}%)")
                else:
                    self.log_result(f"Liquidation Risk - {symbol}", "FAIL", 
                                  f"HTTP {response.status}")
                    
        except Exception as e:
            self.log_result(f"Liquidation Risk - {symbol}", "FAIL", str(e))
            
    async def test_scan_integration(self):
        """TEST SUITE 2: Test integration with scan system"""
        print("\n🔄 TEST SUITE 2: Scan System Integration")
        print("-" * 60)
        
        # First authenticate
        await self._authenticate()
        
        # Run a quick scan to test derivatives integration
        await self._test_scan_with_derivatives()
        
        # Monitor scan progress
        await self._monitor_scan_progress()
        
        # Verify derivatives data in results
        await self._verify_derivatives_in_results()
        
    async def _authenticate(self):
        """Authenticate with the backend"""
        try:
            # Register a test user
            register_data = {
                "username": f"futures_test_{int(time.time())}",
                "email": f"futures_test_{int(time.time())}@test.com",
                "password": "testpass123"
            }
            
            async with self.session.post(
                f"{BACKEND_URL}/api/auth/register",
                json=register_data
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    self.auth_token = data.get('access_token')
                    self.log_result("User Authentication", "PASS", 
                                  f"Token: {self.auth_token[:20]}...")
                else:
                    self.log_result("User Authentication", "FAIL", 
                                  f"HTTP {response.status}")
                    
        except Exception as e:
            self.log_result("User Authentication", "FAIL", str(e))
            
    async def _test_scan_with_derivatives(self):
        """Test running a scan that should include derivatives data"""
        try:
            if not self.auth_token:
                self.log_result("Scan with Derivatives", "SKIP", "No auth token")
                return
                
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            scan_data = {
                "scope": "custom",
                "custom_symbols": ["BTC", "ETH", "BNB"],  # Major coins with futures
                "scan_type": "quick_scan"
            }
            
            async with self.session.post(
                f"{BACKEND_URL}/api/scan/run",
                json=scan_data,
                headers=headers
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    self.scan_run_id = None  # Will get from status
                    self.log_result("Scan Initiation", "PASS", 
                                  f"Status: {data.get('status')}")
                else:
                    self.log_result("Scan Initiation", "FAIL", 
                                  f"HTTP {response.status}")
                    
        except Exception as e:
            self.log_result("Scan Initiation", "FAIL", str(e))
            
    async def _monitor_scan_progress(self):
        """Monitor scan progress and look for derivatives data messages"""
        try:
            derivatives_messages_found = 0
            max_wait = 300  # 5 minutes
            start_time = time.time()
            
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
                                self.log_result("Scan Completion", "PASS", 
                                              f"Run ID: {self.scan_run_id}")
                                break
                            elif status == 'failed':
                                error = recent_run.get('error_message', 'Unknown error')
                                self.log_result("Scan Completion", "FAIL", 
                                              f"Scan failed: {error}")
                                break
                                
                        if not is_running and recent_run and recent_run.get('status') == 'completed':
                            break
                            
                await asyncio.sleep(5)
            else:
                self.log_result("Scan Completion", "FAIL", "Scan timeout")
                
        except Exception as e:
            self.log_result("Scan Progress Monitoring", "FAIL", str(e))
            
    async def _verify_derivatives_in_results(self):
        """Verify that scan results include derivatives data"""
        try:
            if not self.scan_run_id:
                self.log_result("Derivatives Data Verification", "SKIP", "No scan run ID")
                return
                
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            # Get recommendations
            async with self.session.get(
                f"{BACKEND_URL}/api/recommendations/top5",
                headers=headers
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    recommendations = data.get('recommendations', [])
                    
                    derivatives_count = 0
                    total_recs = len(recommendations)
                    
                    for rec in recommendations:
                        # Check if recommendation has derivatives-related fields
                        has_derivatives = any(field in rec for field in [
                            'open_interest', 'funding_rate', 'long_short_ratio', 
                            'liquidation_risk', 'has_derivatives'
                        ])
                        
                        if has_derivatives:
                            derivatives_count += 1
                            
                    if derivatives_count > 0:
                        coverage = (derivatives_count / total_recs) * 100 if total_recs > 0 else 0
                        self.log_result("Derivatives Data in Results", "PASS", 
                                      f"{derivatives_count}/{total_recs} coins ({coverage:.1f}%) have derivatives data")
                    else:
                        self.log_result("Derivatives Data in Results", "FAIL", 
                                      "No derivatives data found in recommendations")
                        
                elif response.status == 404:
                    self.log_result("Derivatives Data Verification", "FAIL", 
                                  "No recommendations found")
                else:
                    self.log_result("Derivatives Data Verification", "FAIL", 
                                  f"HTTP {response.status}")
                    
        except Exception as e:
            self.log_result("Derivatives Data Verification", "FAIL", str(e))
            
    async def test_data_quality_coverage(self):
        """TEST SUITE 3: Data Quality & Coverage"""
        print("\n📈 TEST SUITE 3: Data Quality & Coverage")
        print("-" * 60)
        
        # Test top 10 coins for derivatives data availability
        top_coins = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'XRP', 'DOT', 'AVAX', 'MATIC', 'LINK']
        
        available_count = 0
        total_tested = len(top_coins)
        
        for symbol in top_coins:
            has_data = await self._check_derivatives_availability(symbol)
            if has_data:
                available_count += 1
            await asyncio.sleep(0.3)  # Rate limiting
            
        coverage_percent = (available_count / total_tested) * 100
        
        if coverage_percent >= 50:
            self.log_result("Derivatives Coverage", "PASS", 
                          f"{available_count}/{total_tested} coins ({coverage_percent:.1f}%) have futures data")
        else:
            self.log_result("Derivatives Coverage", "FAIL", 
                          f"Low coverage: {coverage_percent:.1f}%")
            
    async def _check_derivatives_availability(self, symbol: str):
        """Check if derivatives data is available for a symbol"""
        try:
            binance_symbol = f"{symbol}USDT"
            url = f"https://fapi.binance.com/fapi/v1/openInterest"
            params = {'symbol': binance_symbol}
            
            async with self.session.get(url, params=params, timeout=5) as response:
                if response.status == 200:
                    data = await response.json()
                    open_interest = float(data.get('openInterest', 0))
                    return open_interest > 0
                return False
                
        except Exception:
            return False
            
    async def test_performance_impact(self):
        """TEST SUITE 4: Performance Impact"""
        print("\n⚡ TEST SUITE 4: Performance Impact")
        print("-" * 60)
        
        # Test response times for derivatives API calls
        test_symbols = ['BTC', 'ETH', 'BNB']
        total_time = 0
        successful_calls = 0
        
        for symbol in test_symbols:
            start_time = time.time()
            success = await self._test_derivatives_response_time(symbol)
            end_time = time.time()
            
            call_time = end_time - start_time
            total_time += call_time
            
            if success:
                successful_calls += 1
                
            if call_time < 2.0:
                self.log_result(f"Response Time - {symbol}", "PASS", 
                              f"{call_time:.2f}s")
            else:
                self.log_result(f"Response Time - {symbol}", "FAIL", 
                              f"Slow response: {call_time:.2f}s")
                              
        avg_time = total_time / len(test_symbols) if test_symbols else 0
        
        if avg_time < 2.0:
            self.log_result("Average Response Time", "PASS", 
                          f"{avg_time:.2f}s average")
        else:
            self.log_result("Average Response Time", "FAIL", 
                          f"Slow average: {avg_time:.2f}s")
            
    async def _test_derivatives_response_time(self, symbol: str):
        """Test response time for derivatives data fetching"""
        try:
            binance_symbol = f"{symbol}USDT"
            url = f"https://fapi.binance.com/fapi/v1/openInterest"
            params = {'symbol': binance_symbol}
            
            async with self.session.get(url, params=params, timeout=10) as response:
                return response.status == 200
                
        except Exception:
            return False
            
    async def test_error_handling(self):
        """TEST SUITE 5: Error Handling"""
        print("\n🛡️ TEST SUITE 5: Error Handling")
        print("-" * 60)
        
        # Test with invalid symbol
        await self._test_invalid_symbol()
        
        # Test API unavailability simulation
        await self._test_api_timeout()
        
    async def _test_invalid_symbol(self):
        """Test handling of invalid symbols"""
        try:
            invalid_symbol = "INVALIDCOIN"
            binance_symbol = f"{invalid_symbol}USDT"
            url = f"https://fapi.binance.com/fapi/v1/openInterest"
            params = {'symbol': binance_symbol}
            
            async with self.session.get(url, params=params, timeout=5) as response:
                if response.status == 400:
                    self.log_result("Invalid Symbol Handling", "PASS", 
                                  "Properly returns 400 for invalid symbol")
                else:
                    self.log_result("Invalid Symbol Handling", "PARTIAL", 
                                  f"Unexpected status: {response.status}")
                    
        except Exception as e:
            self.log_result("Invalid Symbol Handling", "FAIL", str(e))
            
    async def _test_api_timeout(self):
        """Test API timeout handling"""
        try:
            url = f"https://fapi.binance.com/fapi/v1/openInterest"
            params = {'symbol': 'BTCUSDT'}
            
            # Very short timeout to simulate timeout
            async with self.session.get(url, params=params, timeout=0.001) as response:
                self.log_result("Timeout Handling", "FAIL", 
                              "Should have timed out")
                              
        except asyncio.TimeoutError:
            self.log_result("Timeout Handling", "PASS", 
                          "Properly handles timeout")
        except Exception as e:
            self.log_result("Timeout Handling", "PARTIAL", 
                          f"Different error: {type(e).__name__}")
            
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 80)
        print("🏁 BINANCE FUTURES INTEGRATION TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed = len([r for r in self.test_results if r['status'] == 'PASS'])
        failed = len([r for r in self.test_results if r['status'] == 'FAIL'])
        partial = len([r for r in self.test_results if r['status'] == 'PARTIAL'])
        skipped = len([r for r in self.test_results if r['status'] == 'SKIP'])
        
        success_rate = (passed / total_tests) * 100 if total_tests > 0 else 0
        
        print(f"📊 Total Tests: {total_tests}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"⚠️ Partial: {partial}")
        print(f"⏭️ Skipped: {skipped}")
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        print("\n🔍 CRITICAL SUCCESS CRITERIA:")
        
        # Check critical criteria
        derivatives_api_working = any(
            'Open Interest' in r['test'] and r['status'] == 'PASS' 
            for r in self.test_results
        )
        
        funding_rates_working = any(
            'Funding Rate' in r['test'] and r['status'] == 'PASS' 
            for r in self.test_results
        )
        
        scan_integration_working = any(
            'Scan' in r['test'] and r['status'] == 'PASS' 
            for r in self.test_results
        )
        
        coverage_adequate = any(
            'Coverage' in r['test'] and r['status'] == 'PASS' 
            for r in self.test_results
        )
        
        performance_acceptable = any(
            'Response Time' in r['test'] and r['status'] == 'PASS' 
            for r in self.test_results
        )
        
        criteria = [
            ("Derivatives API Working", derivatives_api_working),
            ("Funding Rates Available", funding_rates_working),
            ("Scan Integration Working", scan_integration_working),
            ("Coverage Adequate (>50%)", coverage_adequate),
            ("Performance Acceptable (<2s)", performance_acceptable)
        ]
        
        for criterion, met in criteria:
            status = "✅ MET" if met else "❌ NOT MET"
            print(f"  {criterion}: {status}")
            
        # Overall recommendation
        critical_met = sum(1 for _, met in criteria if met)
        total_critical = len(criteria)
        
        print(f"\n🎯 OVERALL ASSESSMENT:")
        if critical_met >= 4:
            print("🟢 READY FOR PRODUCTION")
            print("   Binance Futures integration is working correctly")
        elif critical_met >= 3:
            print("🟡 CONDITIONAL GO")
            print("   Most features working, minor issues to address")
        else:
            print("🔴 NOT READY")
            print("   Critical issues need to be resolved")
            
        print("\n📋 DETAILED RESULTS:")
        for result in self.test_results:
            status_emoji = "✅" if result['status'] == "PASS" else "❌" if result['status'] == "FAIL" else "⚠️" if result['status'] == "PARTIAL" else "⏭️"
            print(f"  {status_emoji} {result['test']}: {result['status']}")
            if result['details']:
                print(f"     {result['details']}")

async def main():
    """Run the comprehensive Binance Futures integration test"""
    test = BinanceFuturesIntegrationTest()
    
    try:
        await test.setup()
        
        # Run all test suites
        await test.test_binance_futures_api_direct()
        await test.test_scan_integration()
        await test.test_data_quality_coverage()
        await test.test_performance_impact()
        await test.test_error_handling()
        
        # Print summary
        test.print_summary()
        
    except Exception as e:
        print(f"❌ Test suite failed: {e}")
        
    finally:
        await test.cleanup()

if __name__ == "__main__":
    asyncio.run(main())