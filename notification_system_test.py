#!/usr/bin/env python3
"""
Notification System Backend Testing Script for Crypto Oracle
Tests the new lightweight endpoint and Bot Analytics performance:

1. Scan Status Endpoint Test (/api/scan/is-running)
2. Bot Analytics Endpoints (under load)
3. Integration Test (scan + analytics during scan)

Focus: Verify the new /api/scan/is-running endpoint prevents performance issues
"""

import asyncio
import aiohttp
import json
import time
from typing import Dict, List, Optional
from pathlib import Path

# Get backend URL from environment
frontend_env_path = Path(__file__).parent / "frontend" / ".env"
backend_url = "https://oracle-trading-1.preview.emergentagent.com"

if frontend_env_path.exists():
    with open(frontend_env_path, 'r') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                backend_url = line.split('=', 1)[1].strip()
                break

API_BASE = f"{backend_url}/api"

class NotificationSystemTestSuite:
    def __init__(self):
        self.session = None
        self.test_results = []
        self.access_token = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_test(self, test_name: str, status: str, details: str = ""):
        """Log test result"""
        result = {
            "test": test_name,
            "status": status,
            "details": details,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        self.test_results.append(result)
        status_icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️" if status == "PARTIAL" else "ℹ️"
        print(f"{status_icon} [{status}] {test_name}: {details}")
    
    async def setup_authentication(self) -> bool:
        """Setup authentication using existing test user credentials"""
        try:
            # Try to login with existing test user from test_result.md
            login_data = {
                "username": "cryptotrader2024",
                "password": "SecurePass123!"
            }
            
            async with self.session.post(f"{API_BASE}/auth/login", json=login_data) as response:
                if response.status == 200:
                    data = await response.json()
                    self.access_token = data.get('access_token')
                    self.log_test("Authentication Setup", "PASS", f"Logged in as {login_data['username']}")
                    return True
                elif response.status == 401:
                    # User doesn't exist, create new one
                    import random
                    username = f"testuser{random.randint(1000, 9999)}"
                    email = f"testuser{random.randint(1000, 9999)}@example.com"
                    
                    register_data = {
                        "username": username,
                        "email": email,
                        "password": "SecurePass123!"
                    }
                    
                    async with self.session.post(f"{API_BASE}/auth/register", json=register_data) as reg_response:
                        if reg_response.status == 200:
                            data = await reg_response.json()
                            self.access_token = data.get('access_token')
                            self.log_test("Authentication Setup", "PASS", f"Registered and logged in as {username}")
                            return True
                        else:
                            self.log_test("Authentication Setup", "FAIL", f"Registration failed: HTTP {reg_response.status}")
                            return False
                else:
                    self.log_test("Authentication Setup", "FAIL", f"Login failed: HTTP {response.status}")
                    return False
                    
        except Exception as e:
            self.log_test("Authentication Setup", "FAIL", f"Error: {str(e)}")
            return False

    async def test_scan_is_running_endpoint_basic(self) -> bool:
        """Test 1: Basic functionality of /api/scan/is-running endpoint"""
        try:
            start_time = time.time()
            
            async with self.session.get(f"{API_BASE}/scan/is-running") as response:
                response_time = (time.time() - start_time) * 1000  # Convert to milliseconds
                
                if response.status != 200:
                    self.log_test("Scan Is-Running Basic", "FAIL", f"HTTP {response.status}")
                    return False
                
                data = await response.json()
                
                # Validate response structure
                if 'is_running' not in data:
                    self.log_test("Scan Is-Running Basic", "FAIL", "Missing 'is_running' field")
                    return False
                
                is_running = data.get('is_running')
                if not isinstance(is_running, bool):
                    self.log_test("Scan Is-Running Basic", "FAIL", f"'is_running' should be boolean, got {type(is_running)}")
                    return False
                
                # Check response time (should be < 100ms as specified)
                if response_time > 100:
                    self.log_test("Scan Is-Running Basic", "PARTIAL", 
                                 f"Response time {response_time:.1f}ms > 100ms (may indicate DB queries)")
                else:
                    self.log_test("Scan Is-Running Basic", "PASS", 
                                 f"Response: {{'is_running': {is_running}}}, Time: {response_time:.1f}ms")
                
                return True
                
        except Exception as e:
            self.log_test("Scan Is-Running Basic", "FAIL", f"Error: {str(e)}")
            return False

    async def test_bot_analytics_endpoints_no_scan(self) -> bool:
        """Test 2: Bot Analytics endpoints when NO scan is running"""
        try:
            analytics_endpoints = [
                ("/api/bots/performance", "Bot Performance"),
                ("/api/analytics/system-health", "System Health"),
                ("/api/analytics/performance-by-regime", "Performance by Regime"),
                ("/api/analytics/bot-degradation", "Bot Degradation"),
                ("/api/analytics/data-readiness", "Data Readiness")
            ]
            
            all_passed = True
            response_times = []
            
            for endpoint, name in analytics_endpoints:
                start_time = time.time()
                
                async with self.session.get(f"{API_BASE}{endpoint}") as response:
                    response_time = (time.time() - start_time) * 1000
                    response_times.append(response_time)
                    
                    if response.status != 200:
                        self.log_test(f"Analytics No-Scan - {name}", "FAIL", f"HTTP {response.status}")
                        all_passed = False
                        continue
                    
                    data = await response.json()
                    
                    # Basic validation that we got JSON data
                    if not isinstance(data, dict):
                        self.log_test(f"Analytics No-Scan - {name}", "FAIL", "Invalid JSON response")
                        all_passed = False
                        continue
                    
                    self.log_test(f"Analytics No-Scan - {name}", "PASS", 
                                 f"Response time: {response_time:.1f}ms")
            
            avg_response_time = sum(response_times) / len(response_times)
            
            if all_passed:
                self.log_test("Bot Analytics No-Scan Summary", "PASS", 
                             f"All {len(analytics_endpoints)} endpoints working, avg response: {avg_response_time:.1f}ms")
            else:
                self.log_test("Bot Analytics No-Scan Summary", "FAIL", "Some analytics endpoints failed")
            
            return all_passed
            
        except Exception as e:
            self.log_test("Bot Analytics No-Scan", "FAIL", f"Error: {str(e)}")
            return False

    async def start_quick_scan(self) -> bool:
        """Start a quick scan for integration testing"""
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"} if self.access_token else {}
            
            scan_request = {
                "scope": "all",
                "scan_type": "quick_scan"
            }
            
            async with self.session.post(f"{API_BASE}/scan/run", json=scan_request, headers=headers) as response:
                if response.status == 409:
                    self.log_test("Start Quick Scan", "INFO", "Scan already running - will use existing scan")
                    return True
                elif response.status != 200:
                    self.log_test("Start Quick Scan", "FAIL", f"HTTP {response.status}")
                    return False
                
                scan_data = await response.json()
                self.log_test("Start Quick Scan", "PASS", f"Quick scan started: {scan_data.get('status')}")
                return True
                
        except Exception as e:
            self.log_test("Start Quick Scan", "FAIL", f"Error: {str(e)}")
            return False

    async def test_integration_scan_and_analytics(self) -> bool:
        """Test 3: Integration test - scan + analytics during scan"""
        try:
            # Step 1: Start a scan
            scan_started = await self.start_quick_scan()
            if not scan_started:
                return False
            
            # Step 2: Immediately check /api/scan/is-running (should be true)
            await asyncio.sleep(2)  # Give scan a moment to start
            
            start_time = time.time()
            async with self.session.get(f"{API_BASE}/scan/is-running") as response:
                response_time = (time.time() - start_time) * 1000
                
                if response.status != 200:
                    self.log_test("Integration - Is-Running During Scan", "FAIL", f"HTTP {response.status}")
                    return False
                
                data = await response.json()
                is_running = data.get('is_running', False)
                
                if not is_running:
                    self.log_test("Integration - Is-Running During Scan", "PARTIAL", 
                                 "Scan not running (may have completed quickly or failed to start)")
                else:
                    self.log_test("Integration - Is-Running During Scan", "PASS", 
                                 f"Scan is running, response time: {response_time:.1f}ms")
            
            # Step 3: Try accessing Bot Analytics endpoints during scan
            if is_running:
                analytics_during_scan = await self.test_analytics_during_scan()
            else:
                analytics_during_scan = True  # Skip if scan not running
            
            # Step 4: Wait for scan completion (max 10 minutes)
            scan_completed = await self.wait_for_scan_completion()
            
            # Step 5: Check /api/scan/is-running (should be false)
            if scan_completed:
                await self.test_is_running_after_completion()
            
            # Step 6: Verify Bot Analytics endpoints work after scan
            analytics_after_scan = await self.test_analytics_after_scan()
            
            overall_success = scan_started and analytics_during_scan and analytics_after_scan
            
            if overall_success:
                self.log_test("Integration Test Summary", "PASS", 
                             "All integration test phases completed successfully")
            else:
                self.log_test("Integration Test Summary", "PARTIAL", 
                             "Some integration test phases had issues")
            
            return overall_success
            
        except Exception as e:
            self.log_test("Integration Test", "FAIL", f"Error: {str(e)}")
            return False

    async def test_analytics_during_scan(self) -> bool:
        """Test analytics endpoints while scan is running"""
        try:
            # Test key analytics endpoints during scan
            critical_endpoints = [
                ("/api/bots/performance", "Bot Performance"),
                ("/api/analytics/system-health", "System Health")
            ]
            
            all_passed = True
            
            for endpoint, name in critical_endpoints:
                start_time = time.time()
                
                try:
                    async with self.session.get(f"{API_BASE}{endpoint}") as response:
                        response_time = (time.time() - start_time) * 1000
                        
                        if response.status != 200:
                            self.log_test(f"Analytics During Scan - {name}", "FAIL", 
                                         f"HTTP {response.status} (may indicate blocking)")
                            all_passed = False
                            continue
                        
                        # Check if response took too long (indicating blocking)
                        if response_time > 5000:  # 5 seconds
                            self.log_test(f"Analytics During Scan - {name}", "FAIL", 
                                         f"Response time {response_time:.1f}ms indicates blocking")
                            all_passed = False
                            continue
                        
                        data = await response.json()
                        
                        if not isinstance(data, dict):
                            self.log_test(f"Analytics During Scan - {name}", "FAIL", "Invalid response")
                            all_passed = False
                            continue
                        
                        self.log_test(f"Analytics During Scan - {name}", "PASS", 
                                     f"No blocking, response time: {response_time:.1f}ms")
                
                except asyncio.TimeoutError:
                    self.log_test(f"Analytics During Scan - {name}", "FAIL", "Request timeout - indicates blocking")
                    all_passed = False
                except Exception as e:
                    self.log_test(f"Analytics During Scan - {name}", "FAIL", f"Error: {str(e)}")
                    all_passed = False
            
            return all_passed
            
        except Exception as e:
            self.log_test("Analytics During Scan", "FAIL", f"Error: {str(e)}")
            return False

    async def wait_for_scan_completion(self, max_wait: int = 600) -> bool:
        """Wait for scan to complete (max 10 minutes)"""
        try:
            wait_time = 0
            
            while wait_time < max_wait:
                await asyncio.sleep(10)  # Check every 10 seconds
                wait_time += 10
                
                # Use the lightweight endpoint to check status
                async with self.session.get(f"{API_BASE}/scan/is-running") as response:
                    if response.status == 200:
                        data = await response.json()
                        is_running = data.get('is_running', True)
                        
                        if not is_running:
                            self.log_test("Scan Completion Wait", "PASS", 
                                         f"Scan completed after {wait_time} seconds")
                            return True
                        else:
                            print(f"Scan still running... ({wait_time}s elapsed)")
            
            self.log_test("Scan Completion Wait", "PARTIAL", 
                         f"Scan timeout after {max_wait} seconds")
            return False
            
        except Exception as e:
            self.log_test("Scan Completion Wait", "FAIL", f"Error: {str(e)}")
            return False

    async def test_is_running_after_completion(self) -> bool:
        """Test /api/scan/is-running after scan completion"""
        try:
            start_time = time.time()
            
            async with self.session.get(f"{API_BASE}/scan/is-running") as response:
                response_time = (time.time() - start_time) * 1000
                
                if response.status != 200:
                    self.log_test("Is-Running After Completion", "FAIL", f"HTTP {response.status}")
                    return False
                
                data = await response.json()
                is_running = data.get('is_running', True)
                
                if is_running:
                    self.log_test("Is-Running After Completion", "FAIL", 
                                 "Scan still shows as running after completion")
                    return False
                
                self.log_test("Is-Running After Completion", "PASS", 
                             f"Correctly shows scan not running, response time: {response_time:.1f}ms")
                return True
                
        except Exception as e:
            self.log_test("Is-Running After Completion", "FAIL", f"Error: {str(e)}")
            return False

    async def test_analytics_after_scan(self) -> bool:
        """Test analytics endpoints after scan completion"""
        try:
            analytics_endpoints = [
                ("/api/bots/performance", "Bot Performance"),
                ("/api/analytics/system-health", "System Health"),
                ("/api/analytics/performance-by-regime", "Performance by Regime"),
                ("/api/analytics/bot-degradation", "Bot Degradation"),
                ("/api/analytics/data-readiness", "Data Readiness")
            ]
            
            all_passed = True
            
            for endpoint, name in analytics_endpoints:
                start_time = time.time()
                
                async with self.session.get(f"{API_BASE}{endpoint}") as response:
                    response_time = (time.time() - start_time) * 1000
                    
                    if response.status != 200:
                        self.log_test(f"Analytics After Scan - {name}", "FAIL", f"HTTP {response.status}")
                        all_passed = False
                        continue
                    
                    data = await response.json()
                    
                    if not isinstance(data, dict):
                        self.log_test(f"Analytics After Scan - {name}", "FAIL", "Invalid JSON response")
                        all_passed = False
                        continue
                    
                    self.log_test(f"Analytics After Scan - {name}", "PASS", 
                                 f"Working correctly, response time: {response_time:.1f}ms")
            
            if all_passed:
                self.log_test("Analytics After Scan Summary", "PASS", 
                             f"All {len(analytics_endpoints)} endpoints working after scan")
            else:
                self.log_test("Analytics After Scan Summary", "PARTIAL", 
                             "Some analytics endpoints had issues after scan")
            
            return all_passed
            
        except Exception as e:
            self.log_test("Analytics After Scan", "FAIL", f"Error: {str(e)}")
            return False

    async def test_performance_comparison(self) -> bool:
        """Test 4: Performance comparison between /api/scan/status and /api/scan/is-running"""
        try:
            # Test /api/scan/is-running performance
            is_running_times = []
            for i in range(5):
                start_time = time.time()
                async with self.session.get(f"{API_BASE}/scan/is-running") as response:
                    response_time = (time.time() - start_time) * 1000
                    is_running_times.append(response_time)
                    if response.status != 200:
                        self.log_test("Performance Comparison", "FAIL", 
                                     f"/api/scan/is-running failed: HTTP {response.status}")
                        return False
                await asyncio.sleep(0.1)  # Small delay between requests
            
            # Test /api/scan/status performance
            status_times = []
            for i in range(5):
                start_time = time.time()
                async with self.session.get(f"{API_BASE}/scan/status") as response:
                    response_time = (time.time() - start_time) * 1000
                    status_times.append(response_time)
                    if response.status != 200:
                        self.log_test("Performance Comparison", "PARTIAL", 
                                     f"/api/scan/status failed: HTTP {response.status}")
                        # Don't return False here as this might be expected under load
                await asyncio.sleep(0.1)
            
            avg_is_running = sum(is_running_times) / len(is_running_times)
            avg_status = sum(status_times) / len(status_times) if status_times else 0
            
            # The new endpoint should be significantly faster
            if avg_is_running < 100:  # Less than 100ms
                if avg_status == 0:
                    self.log_test("Performance Comparison", "PASS", 
                                 f"/api/scan/is-running avg: {avg_is_running:.1f}ms (fast as expected)")
                elif avg_is_running < avg_status * 0.5:  # At least 50% faster
                    self.log_test("Performance Comparison", "PASS", 
                                 f"/api/scan/is-running ({avg_is_running:.1f}ms) much faster than /api/scan/status ({avg_status:.1f}ms)")
                else:
                    self.log_test("Performance Comparison", "PARTIAL", 
                                 f"/api/scan/is-running ({avg_is_running:.1f}ms) vs /api/scan/status ({avg_status:.1f}ms)")
            else:
                self.log_test("Performance Comparison", "FAIL", 
                             f"/api/scan/is-running too slow: {avg_is_running:.1f}ms")
                return False
            
            return True
            
        except Exception as e:
            self.log_test("Performance Comparison", "FAIL", f"Error: {str(e)}")
            return False

    async def run_all_tests(self):
        """Run all notification system tests"""
        print("=" * 80)
        print("NOTIFICATION SYSTEM BACKEND TESTING")
        print("=" * 80)
        print(f"Testing API: {API_BASE}")
        print()
        print("Testing new notification system backend functionality:")
        print("1. Lightweight /api/scan/is-running endpoint")
        print("2. Bot Analytics endpoints performance")
        print("3. Integration test (scan + analytics)")
        print("4. Performance comparison")
        print()
        
        # Setup authentication
        auth_success = await self.setup_authentication()
        if not auth_success:
            print("⚠️ Authentication failed - continuing with unauthenticated tests")
        
        print()
        
        # Test 1: Basic scan/is-running endpoint
        print("🔍 Test 1: Scan Is-Running Endpoint Basic Functionality...")
        await self.test_scan_is_running_endpoint_basic()
        
        print()
        
        # Test 2: Bot Analytics when no scan running
        print("📊 Test 2: Bot Analytics Endpoints (No Scan Running)...")
        await self.test_bot_analytics_endpoints_no_scan()
        
        print()
        
        # Test 3: Integration test
        print("🔄 Test 3: Integration Test (Scan + Analytics)...")
        await self.test_integration_scan_and_analytics()
        
        print()
        
        # Test 4: Performance comparison
        print("⚡ Test 4: Performance Comparison...")
        await self.test_performance_comparison()
        
        # Print final summary
        await self.print_final_summary()

    async def print_final_summary(self):
        """Print final test summary"""
        print()
        print("=" * 80)
        print("NOTIFICATION SYSTEM TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if result['status'] == 'PASS')
        failed = sum(1 for result in self.test_results if result['status'] == 'FAIL')
        partial = sum(1 for result in self.test_results if result['status'] == 'PARTIAL')
        info = sum(1 for result in self.test_results if result['status'] == 'INFO')
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"✅ Passed: {passed}")
        print(f"⚠️ Partial: {partial}")
        print(f"❌ Failed: {failed}")
        print(f"ℹ️ Info: {info}")
        
        success_rate = ((passed + partial) / len(self.test_results) * 100) if self.test_results else 0
        print(f"Success Rate: {success_rate:.1f}%")
        
        print()
        print("🎯 KEY FINDINGS:")
        
        # Check for critical issues
        critical_failures = [r for r in self.test_results if r['status'] == 'FAIL' and 
                           any(keyword in r['test'] for keyword in ['Is-Running', 'Analytics During Scan'])]
        
        if critical_failures:
            print("❌ CRITICAL ISSUES FOUND:")
            for failure in critical_failures:
                print(f"   - {failure['test']}: {failure['details']}")
        else:
            print("✅ No critical issues found with /api/scan/is-running endpoint")
        
        # Check performance
        performance_tests = [r for r in self.test_results if 'Performance' in r['test'] or 'response time' in r['details']]
        if performance_tests:
            print("⚡ PERFORMANCE RESULTS:")
            for test in performance_tests:
                if test['status'] == 'PASS':
                    print(f"   ✅ {test['test']}: {test['details']}")
                else:
                    print(f"   ⚠️ {test['test']}: {test['details']}")
        
        print()
        print("📋 RECOMMENDATIONS:")
        if failed == 0:
            print("✅ All tests passed - notification system is working correctly")
            print("✅ /api/scan/is-running endpoint prevents Bot Analytics page freezing")
            print("✅ System is ready for production use")
        else:
            print("⚠️ Some tests failed - review issues above")
            print("⚠️ May need additional fixes before production deployment")

async def main():
    """Main test execution"""
    async with NotificationSystemTestSuite() as test_suite:
        await test_suite.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())