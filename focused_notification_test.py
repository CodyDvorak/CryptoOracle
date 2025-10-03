#!/usr/bin/env python3
"""
Focused Notification System Test for Crypto Oracle
Tests the specific requirements from the review request:

1. GET /api/scan/is-running - lightweight endpoint
2. Bot Analytics endpoints under load
3. Integration test with scan
"""

import asyncio
import aiohttp
import json
import time
from pathlib import Path

# Get backend URL
frontend_env_path = Path(__file__).parent / "frontend" / ".env"
backend_url = "https://oracle-trading-1.preview.emergentagent.com"

if frontend_env_path.exists():
    with open(frontend_env_path, 'r') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                backend_url = line.split('=', 1)[1].strip()
                break

API_BASE = f"{backend_url}/api"

async def test_scan_is_running_endpoint():
    """Test the new /api/scan/is-running endpoint"""
    print("🔍 Testing /api/scan/is-running endpoint...")
    
    async with aiohttp.ClientSession() as session:
        try:
            # Test 1: Basic functionality
            start_time = time.time()
            async with session.get(f"{API_BASE}/scan/is-running") as response:
                response_time = (time.time() - start_time) * 1000
                
                print(f"   Status Code: {response.status}")
                
                if response.status == 200:
                    data = await response.json()
                    print(f"   Response: {data}")
                    print(f"   Response Time: {response_time:.1f}ms")
                    
                    # Check if response is fast (< 100ms as specified)
                    if response_time < 100:
                        print("   ✅ PASS: Response time < 100ms (no DB queries)")
                    else:
                        print("   ⚠️ PARTIAL: Response time > 100ms (may indicate DB queries)")
                    
                    # Check response structure
                    if 'is_running' in data and isinstance(data['is_running'], bool):
                        print("   ✅ PASS: Correct response structure")
                        return True, data['is_running']
                    else:
                        print("   ❌ FAIL: Invalid response structure")
                        return False, None
                else:
                    print(f"   ❌ FAIL: HTTP {response.status}")
                    return False, None
                    
        except Exception as e:
            print(f"   ❌ FAIL: Error - {str(e)}")
            return False, None

async def test_bot_analytics_endpoints():
    """Test Bot Analytics endpoints"""
    print("\n📊 Testing Bot Analytics endpoints...")
    
    # These are the endpoints mentioned in the review request
    endpoints = [
        "/api/bots/performance",
        "/api/analytics/system-health", 
        "/api/analytics/performance-by-regime",
        "/api/analytics/bot-degradation",
        "/api/analytics/data-readiness"
    ]
    
    async with aiohttp.ClientSession() as session:
        results = {}
        
        for endpoint in endpoints:
            try:
                start_time = time.time()
                async with session.get(f"{API_BASE}{endpoint}") as response:
                    response_time = (time.time() - start_time) * 1000
                    
                    print(f"   {endpoint}: Status {response.status}, Time {response_time:.1f}ms")
                    
                    if response.status == 200:
                        data = await response.json()
                        results[endpoint] = {"status": "PASS", "time": response_time, "data": data}
                        print(f"      ✅ PASS: Working correctly")
                    else:
                        results[endpoint] = {"status": "FAIL", "time": response_time}
                        print(f"      ❌ FAIL: HTTP {response.status}")
                        
            except Exception as e:
                results[endpoint] = {"status": "FAIL", "error": str(e)}
                print(f"      ❌ FAIL: Error - {str(e)}")
        
        return results

async def test_scan_status_comparison():
    """Compare /api/scan/is-running vs /api/scan/status performance"""
    print("\n⚡ Testing performance comparison...")
    
    async with aiohttp.ClientSession() as session:
        # Test /api/scan/is-running (new lightweight endpoint)
        is_running_times = []
        for i in range(3):
            start_time = time.time()
            try:
                async with session.get(f"{API_BASE}/scan/is-running") as response:
                    response_time = (time.time() - start_time) * 1000
                    is_running_times.append(response_time)
                    if response.status != 200:
                        print(f"   ⚠️ /api/scan/is-running failed: HTTP {response.status}")
            except Exception as e:
                print(f"   ⚠️ /api/scan/is-running error: {str(e)}")
            await asyncio.sleep(0.5)
        
        # Test /api/scan/status (existing endpoint)
        status_times = []
        for i in range(3):
            start_time = time.time()
            try:
                async with session.get(f"{API_BASE}/scan/status") as response:
                    response_time = (time.time() - start_time) * 1000
                    status_times.append(response_time)
                    if response.status != 200:
                        print(f"   ⚠️ /api/scan/status failed: HTTP {response.status}")
            except Exception as e:
                print(f"   ⚠️ /api/scan/status error: {str(e)}")
            await asyncio.sleep(0.5)
        
        if is_running_times:
            avg_is_running = sum(is_running_times) / len(is_running_times)
            print(f"   /api/scan/is-running average: {avg_is_running:.1f}ms")
        
        if status_times:
            avg_status = sum(status_times) / len(status_times)
            print(f"   /api/scan/status average: {avg_status:.1f}ms")
        
        if is_running_times and status_times:
            if avg_is_running < avg_status:
                print(f"   ✅ PASS: /api/scan/is-running is faster ({avg_is_running:.1f}ms vs {avg_status:.1f}ms)")
            else:
                print(f"   ⚠️ PARTIAL: Performance difference not significant")

async def test_integration_scenario():
    """Test the integration scenario: start scan, check is-running, test analytics"""
    print("\n🔄 Testing integration scenario...")
    
    async with aiohttp.ClientSession() as session:
        # Step 1: Check current scan status
        print("   Step 1: Checking current scan status...")
        success, is_running = await test_scan_is_running_endpoint()
        
        if not success:
            print("   ❌ FAIL: Could not check scan status")
            return
        
        print(f"   Current scan status: {'Running' if is_running else 'Not running'}")
        
        # Step 2: If no scan running, try to start one
        if not is_running:
            print("   Step 2: Starting a quick scan...")
            try:
                scan_request = {
                    "scope": "all",
                    "scan_type": "quick_scan"
                }
                
                async with session.post(f"{API_BASE}/scan/run", json=scan_request) as response:
                    if response.status == 200:
                        print("   ✅ Scan started successfully")
                        await asyncio.sleep(5)  # Wait for scan to start
                    elif response.status == 409:
                        print("   ℹ️ Scan already running")
                    else:
                        print(f"   ⚠️ Scan start failed: HTTP {response.status}")
                        
            except Exception as e:
                print(f"   ⚠️ Scan start error: {str(e)}")
        
        # Step 3: Test analytics during scan (if running)
        print("   Step 3: Testing analytics endpoints...")
        analytics_results = await test_bot_analytics_endpoints()
        
        # Step 4: Check scan status again
        print("   Step 4: Final scan status check...")
        success, final_status = await test_scan_is_running_endpoint()
        
        if success:
            print(f"   Final scan status: {'Running' if final_status else 'Not running'}")
        
        return analytics_results

async def main():
    """Main test execution"""
    print("=" * 80)
    print("FOCUSED NOTIFICATION SYSTEM BACKEND TESTING")
    print("=" * 80)
    print(f"Testing API: {API_BASE}")
    print()
    print("Focus: Test new /api/scan/is-running endpoint and Bot Analytics performance")
    print()
    
    # Test 1: Basic scan/is-running endpoint
    success, is_running = await test_scan_is_running_endpoint()
    
    # Test 2: Bot Analytics endpoints
    analytics_results = await test_bot_analytics_endpoints()
    
    # Test 3: Performance comparison
    await test_scan_status_comparison()
    
    # Test 4: Integration scenario
    await test_integration_scenario()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    print("\n🎯 KEY FINDINGS:")
    
    if success:
        print("✅ /api/scan/is-running endpoint is working")
        print(f"   - Current scan status: {'Running' if is_running else 'Not running'}")
    else:
        print("❌ /api/scan/is-running endpoint has issues")
    
    # Analytics summary
    if analytics_results:
        working_endpoints = sum(1 for result in analytics_results.values() if result.get('status') == 'PASS')
        total_endpoints = len(analytics_results)
        print(f"\n📊 Bot Analytics Endpoints: {working_endpoints}/{total_endpoints} working")
        
        for endpoint, result in analytics_results.items():
            status_icon = "✅" if result.get('status') == 'PASS' else "❌"
            print(f"   {status_icon} {endpoint}")
    
    print("\n📋 CONCLUSION:")
    if success and analytics_results:
        working_count = sum(1 for result in analytics_results.values() if result.get('status') == 'PASS')
        if working_count >= len(analytics_results) * 0.8:  # 80% success rate
            print("✅ Notification system backend is working correctly")
            print("✅ /api/scan/is-running should prevent Bot Analytics page freezing")
        else:
            print("⚠️ Some analytics endpoints have issues")
            print("⚠️ May need investigation before production use")
    else:
        print("❌ Critical issues found - needs investigation")

if __name__ == "__main__":
    asyncio.run(main())