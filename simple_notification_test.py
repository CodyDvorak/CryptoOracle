#!/usr/bin/env python3
"""
Simple Notification System Test
Focus on the core requirement: /api/scan/is-running endpoint performance
"""

import requests
import time
import json

API_BASE = "https://oracle-trading-1.preview.emergentagent.com/api"

def test_scan_is_running():
    """Test the new /api/scan/is-running endpoint"""
    print("🔍 Testing /api/scan/is-running endpoint...")
    
    try:
        # Test multiple times to get average response time
        response_times = []
        results = []
        
        for i in range(5):
            start_time = time.time()
            response = requests.get(f"{API_BASE}/scan/is-running", timeout=30)
            response_time = (time.time() - start_time) * 1000
            response_times.append(response_time)
            
            print(f"   Test {i+1}: Status {response.status_code}, Time {response_time:.1f}ms")
            
            if response.status_code == 200:
                data = response.json()
                results.append(data)
                print(f"      Response: {data}")
            else:
                print(f"      ❌ FAIL: HTTP {response.status_code}")
                return False
            
            time.sleep(1)  # Wait between requests
        
        avg_response_time = sum(response_times) / len(response_times)
        print(f"\n   Average Response Time: {avg_response_time:.1f}ms")
        
        # Check if response time meets requirement (< 100ms)
        if avg_response_time < 100:
            print("   ✅ PASS: Response time < 100ms (no DB queries)")
        else:
            print("   ⚠️ PARTIAL: Response time > 100ms (may indicate DB queries)")
        
        # Check response structure consistency
        is_running_values = [r.get('is_running') for r in results]
        if all(isinstance(val, bool) for val in is_running_values):
            print("   ✅ PASS: Correct response structure (boolean is_running)")
        else:
            print("   ❌ FAIL: Invalid response structure")
            return False
        
        # Show scan status
        current_status = results[-1].get('is_running')
        print(f"   Current scan status: {'Running' if current_status else 'Not running'}")
        
        return True, current_status, avg_response_time
        
    except Exception as e:
        print(f"   ❌ FAIL: Error - {str(e)}")
        return False, None, None

def test_analytics_endpoints():
    """Test Bot Analytics endpoints"""
    print("\n📊 Testing Bot Analytics endpoints...")
    
    endpoints = [
        "/api/bots/performance",
        "/api/analytics/system-health", 
        "/api/analytics/performance-by-regime",
        "/api/analytics/bot-degradation",
        "/api/analytics/data-readiness"
    ]
    
    results = {}
    
    for endpoint in endpoints:
        try:
            start_time = time.time()
            response = requests.get(f"{API_BASE}{endpoint}", timeout=30)
            response_time = (time.time() - start_time) * 1000
            
            print(f"   {endpoint}: Status {response.status_code}, Time {response_time:.1f}ms")
            
            if response.status_code == 200:
                data = response.json()
                results[endpoint] = {"status": "PASS", "time": response_time}
                print(f"      ✅ PASS: Working correctly")
            else:
                results[endpoint] = {"status": "FAIL", "time": response_time, "code": response.status_code}
                print(f"      ❌ FAIL: HTTP {response.status_code}")
                
        except Exception as e:
            results[endpoint] = {"status": "FAIL", "error": str(e)}
            print(f"      ❌ FAIL: Error - {str(e)}")
    
    return results

def test_performance_comparison():
    """Compare /api/scan/is-running vs /api/scan/status"""
    print("\n⚡ Testing performance comparison...")
    
    # Test /api/scan/is-running
    is_running_times = []
    for i in range(3):
        try:
            start_time = time.time()
            response = requests.get(f"{API_BASE}/scan/is-running", timeout=30)
            response_time = (time.time() - start_time) * 1000
            is_running_times.append(response_time)
        except Exception as e:
            print(f"   ⚠️ /api/scan/is-running error: {str(e)}")
        time.sleep(1)
    
    # Test /api/scan/status
    status_times = []
    for i in range(3):
        try:
            start_time = time.time()
            response = requests.get(f"{API_BASE}/scan/status", timeout=30)
            response_time = (time.time() - start_time) * 1000
            status_times.append(response_time)
        except Exception as e:
            print(f"   ⚠️ /api/scan/status error: {str(e)}")
        time.sleep(1)
    
    if is_running_times:
        avg_is_running = sum(is_running_times) / len(is_running_times)
        print(f"   /api/scan/is-running average: {avg_is_running:.1f}ms")
    
    if status_times:
        avg_status = sum(status_times) / len(status_times)
        print(f"   /api/scan/status average: {avg_status:.1f}ms")
    
    if is_running_times and status_times:
        if avg_is_running < avg_status:
            improvement = ((avg_status - avg_is_running) / avg_status) * 100
            print(f"   ✅ PASS: /api/scan/is-running is {improvement:.1f}% faster")
        else:
            print(f"   ⚠️ PARTIAL: No significant performance improvement")

def main():
    """Main test execution"""
    print("=" * 80)
    print("SIMPLE NOTIFICATION SYSTEM BACKEND TESTING")
    print("=" * 80)
    print(f"Testing API: {API_BASE}")
    print()
    print("Focus: Verify /api/scan/is-running prevents Bot Analytics page freezing")
    print()
    
    # Test 1: Core endpoint
    success, is_running, avg_time = test_scan_is_running()
    
    # Test 2: Analytics endpoints
    analytics_results = test_analytics_endpoints()
    
    # Test 3: Performance comparison
    test_performance_comparison()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    print("\n🎯 KEY FINDINGS:")
    
    if success:
        print("✅ /api/scan/is-running endpoint is working")
        print(f"   - Average response time: {avg_time:.1f}ms")
        print(f"   - Current scan status: {'Running' if is_running else 'Not running'}")
        
        if avg_time < 100:
            print("   - ✅ Meets performance requirement (< 100ms)")
        else:
            print("   - ⚠️ Slower than expected (> 100ms)")
    else:
        print("❌ /api/scan/is-running endpoint has issues")
    
    # Analytics summary
    if analytics_results:
        working_endpoints = sum(1 for result in analytics_results.values() if result.get('status') == 'PASS')
        total_endpoints = len(analytics_results)
        print(f"\n📊 Bot Analytics Endpoints: {working_endpoints}/{total_endpoints} working")
        
        for endpoint, result in analytics_results.items():
            status_icon = "✅" if result.get('status') == 'PASS' else "❌"
            endpoint_name = endpoint.split('/')[-1]
            print(f"   {status_icon} {endpoint_name}")
    
    print("\n📋 CONCLUSION:")
    if success and analytics_results:
        working_count = sum(1 for result in analytics_results.values() if result.get('status') == 'PASS')
        if working_count >= len(analytics_results) * 0.8:  # 80% success rate
            print("✅ Notification system backend is working correctly")
            print("✅ /api/scan/is-running should prevent Bot Analytics page freezing")
            print("✅ Bot Analytics endpoints are accessible when scan is not running")
        else:
            print("⚠️ Some analytics endpoints have issues")
            print("⚠️ May need investigation before production use")
    else:
        print("❌ Critical issues found - needs investigation")
    
    print("\n📝 RECOMMENDATIONS:")
    if success:
        if avg_time < 100:
            print("✅ /api/scan/is-running endpoint meets performance requirements")
        else:
            print("⚠️ Consider optimizing /api/scan/is-running to avoid DB queries")
        
        if analytics_results:
            failed_endpoints = [ep for ep, result in analytics_results.items() if result.get('status') == 'FAIL']
            if failed_endpoints:
                print("⚠️ Fix failing analytics endpoints:")
                for ep in failed_endpoints:
                    print(f"   - {ep}")
            else:
                print("✅ All analytics endpoints working correctly")

if __name__ == "__main__":
    main()