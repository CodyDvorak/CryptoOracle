#!/usr/bin/env python3
"""
Quick Multi-Tiered Scan Types Test for Crypto Oracle
Tests the 8 different scan types without waiting for full completion
"""

import asyncio
import aiohttp
import json
import time
from pathlib import Path

# Get backend URL from environment
frontend_env_path = Path(__file__).parent / "frontend" / ".env"
backend_url = "https://smarttrade-ai-42.preview.emergentagent.com"

if frontend_env_path.exists():
    with open(frontend_env_path, 'r') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                backend_url = line.split('=', 1)[1].strip()
                break

API_BASE = f"{backend_url}/api"

class QuickScanTest:
    def __init__(self):
        self.session = None
        self.test_results = []
        
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
        print(f"[{status}] {test_name}: {details}")

    async def register_test_user(self) -> str:
        """Register a test user and return access token"""
        try:
            import random
            test_user = {
                "username": f"scantest{random.randint(1000, 9999)}",
                "email": f"scantest{random.randint(1000, 9999)}@example.com",
                "password": "TestPass123!"
            }
            
            async with self.session.post(f"{API_BASE}/auth/register", json=test_user) as response:
                if response.status == 200:
                    data = await response.json()
                    access_token = data.get('access_token')
                    self.log_test("User Registration", "PASS", f"User registered: {test_user['username']}")
                    return access_token
                else:
                    error_text = await response.text()
                    self.log_test("User Registration", "FAIL", f"HTTP {response.status}: {error_text}")
                    return None
        except Exception as e:
            self.log_test("User Registration", "FAIL", f"Error: {str(e)}")
            return None

    async def test_scan_type_validation(self, access_token: str):
        """Test all 8 scan types are recognized"""
        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            
            scan_types = [
                "quick_scan", "focused_scan", "fast_parallel", "full_scan_lite",
                "heavy_speed_run", "complete_market_scan", "speed_run", "full_scan"
            ]
            
            valid_types = []
            invalid_types = []
            
            for scan_type in scan_types:
                try:
                    scan_request = {
                        "scan_type": scan_type,
                        "scope": "all",
                        "filter_scope": "all"
                    }
                    
                    async with self.session.post(f"{API_BASE}/scan/run", json=scan_request, headers=headers) as response:
                        if response.status == 200:
                            valid_types.append(scan_type)
                            print(f"✅ {scan_type}: Accepted")
                        elif response.status == 409:
                            valid_types.append(scan_type)
                            print(f"✅ {scan_type}: Accepted (scan already running)")
                        elif response.status == 422:
                            invalid_types.append(scan_type)
                            print(f"❌ {scan_type}: Not recognized")
                        else:
                            error_text = await response.text()
                            print(f"⚠️ {scan_type}: HTTP {response.status} - {error_text}")
                            
                except Exception as e:
                    print(f"⚠️ {scan_type}: Error - {str(e)}")
                    invalid_types.append(scan_type)
                
                await asyncio.sleep(0.5)
            
            if len(valid_types) == 8:
                self.log_test("Scan Type Validation", "PASS", f"All 8 scan types recognized: {', '.join(valid_types)}")
            elif len(valid_types) > 0:
                self.log_test("Scan Type Validation", "PARTIAL", 
                             f"{len(valid_types)}/8 scan types valid. Invalid: {', '.join(invalid_types)}")
            else:
                self.log_test("Scan Type Validation", "FAIL", f"No scan types recognized")
                
        except Exception as e:
            self.log_test("Scan Type Validation", "FAIL", f"Error: {str(e)}")

    async def test_speed_run_scan(self, access_token: str):
        """Test speed_run scan (fastest option)"""
        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            
            scan_request = {
                "scan_type": "speed_run",
                "filter_scope": "all",
                "scope": "all"
            }
            
            print(f"Starting speed_run scan...")
            start_time = time.time()
            
            async with self.session.post(f"{API_BASE}/scan/run", json=scan_request, headers=headers) as response:
                if response.status == 409:
                    self.log_test("Speed Run Scan", "PARTIAL", "Another scan already running")
                    return
                elif response.status != 200:
                    error_text = await response.text()
                    self.log_test("Speed Run Scan", "FAIL", f"Failed to start: HTTP {response.status}")
                    return
                
                self.log_test("Speed Run Start", "PASS", "Speed run scan started successfully")
            
            # Wait for completion (max 4 minutes for speed_run)
            max_wait = 240
            wait_time = 0
            
            while wait_time < max_wait:
                await asyncio.sleep(10)
                wait_time += 10
                
                async with self.session.get(f"{API_BASE}/scan/status") as response:
                    if response.status == 200:
                        status_data = await response.json()
                        is_running = status_data.get('is_running', True)
                        
                        if not is_running:
                            recent_run = status_data.get('recent_run')
                            if recent_run and recent_run.get('status') == 'completed':
                                run_id = recent_run.get('id')
                                completion_time = int(time.time() - start_time)
                                
                                self.log_test("Speed Run Completion", "PASS", 
                                             f"Completed in {completion_time}s, run_id: {run_id}")
                                
                                # Check recommendations
                                await self.check_recommendations(run_id, "speed_run")
                                return
                            else:
                                self.log_test("Speed Run Completion", "FAIL", "Scan failed")
                                return
                        else:
                            print(f"Speed run still running... ({wait_time}s elapsed)")
            
            self.log_test("Speed Run Completion", "FAIL", "Timeout after 4 minutes")
            
        except Exception as e:
            self.log_test("Speed Run Scan", "FAIL", f"Error: {str(e)}")

    async def check_recommendations(self, run_id: str, scan_type: str):
        """Check if recommendations were generated"""
        try:
            async with self.session.get(f"{API_BASE}/recommendations/top5?run_id={run_id}") as response:
                if response.status == 200:
                    data = await response.json()
                    recommendations = data.get('recommendations', [])
                    
                    if recommendations:
                        first_rec = recommendations[0]
                        bot_count = first_rec.get('bot_count', 0)
                        coin_symbol = first_rec.get('ticker', 'Unknown')
                        
                        self.log_test(f"{scan_type.title()} Recommendations", "PASS", 
                                     f"Generated {len(recommendations)} recommendations, {coin_symbol}: {bot_count} bots")
                    else:
                        self.log_test(f"{scan_type.title()} Recommendations", "PARTIAL", "No recommendations generated")
                elif response.status == 404:
                    self.log_test(f"{scan_type.title()} Recommendations", "PARTIAL", "No recommendations found")
                else:
                    self.log_test(f"{scan_type.title()} Recommendations", "FAIL", f"HTTP {response.status}")
                    
        except Exception as e:
            self.log_test(f"{scan_type.title()} Recommendations", "FAIL", f"Error: {str(e)}")

    async def check_backend_logs(self):
        """Check backend logs for scan activity"""
        try:
            # This is a manual verification step
            self.log_test("Backend Logs Check", "MANUAL", 
                         "Manual verification: Check /var/log/supervisor/backend.*.log for scan activity and email notifications")
        except Exception as e:
            self.log_test("Backend Logs Check", "FAIL", f"Error: {str(e)}")

    async def run_tests(self):
        """Run all multi-tiered scan tests"""
        print("=" * 80)
        print("MULTI-TIERED SCAN TYPES QUICK TEST")
        print("=" * 80)
        print(f"Testing API: {API_BASE}")
        print()
        
        # Test 1: Health check
        try:
            async with self.session.get(f"{API_BASE}/health") as response:
                if response.status == 200:
                    self.log_test("Health Check", "PASS", "API is healthy")
                else:
                    self.log_test("Health Check", "FAIL", f"HTTP {response.status}")
                    return
        except Exception as e:
            self.log_test("Health Check", "FAIL", f"Connection error: {str(e)}")
            return
        
        print()
        print("🔐 Setting up authentication...")
        
        # Test 2: Register test user
        access_token = await self.register_test_user()
        if not access_token:
            print("❌ Authentication failed - aborting tests")
            return
        
        print()
        print("🔍 Testing scan type validation...")
        
        # Test 3: Validate all 8 scan types
        await self.test_scan_type_validation(access_token)
        
        print()
        print("⚡ Testing speed_run scan...")
        
        # Test 4: Test speed_run scan (fastest)
        await self.test_speed_run_scan(access_token)
        
        print()
        print("📋 Manual verification steps...")
        
        # Test 5: Backend logs check
        await self.check_backend_logs()
        
        # Print summary
        print()
        print("=" * 80)
        print("MULTI-TIERED SCAN TYPES TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if result['status'] == 'PASS')
        failed = sum(1 for result in self.test_results if result['status'] == 'FAIL')
        partial = sum(1 for result in self.test_results if result['status'] == 'PARTIAL')
        manual = sum(1 for result in self.test_results if result['status'] == 'MANUAL')
        
        for result in self.test_results:
            if result['status'] == 'PASS':
                status_icon = "✅"
            elif result['status'] == 'FAIL':
                status_icon = "❌"
            elif result['status'] == 'PARTIAL':
                status_icon = "⚠️"
            elif result['status'] == 'MANUAL':
                status_icon = "📋"
            else:
                status_icon = "ℹ️"
            print(f"{status_icon} {result['test']}: {result['details']}")
        
        print()
        print(f"Total Tests: {len(self.test_results)}")
        print(f"Passed: {passed}")
        print(f"Partial: {partial}")
        print(f"Failed: {failed}")
        print(f"Manual Verification: {manual}")
        
        success_rate = ((passed + partial) / len(self.test_results) * 100) if self.test_results else 0
        print(f"Success Rate: {success_rate:.1f}%")
        
        print()
        print("📋 MANUAL VERIFICATION STEPS:")
        print("1. Check backend logs at /var/log/supervisor/backend.*.log for:")
        print("   - Scan type processing")
        print("   - Bot count execution")
        print("   - Email notification flow")
        print("2. Verify scan completion times match expected performance")
        print("3. Check email inbox for scan completion notifications")

async def main():
    async with QuickScanTest() as test_suite:
        await test_suite.run_tests()

if __name__ == "__main__":
    asyncio.run(main())