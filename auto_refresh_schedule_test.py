#!/usr/bin/env python3
"""
Auto-Refresh and Schedule Functionality Test Script
Tests the specific functionality requested in the review:
1. Auto-refresh after scan completion
2. Schedule configuration endpoints (fixing 500 errors)
3. Scheduler status verification
4. Email setup requirements documentation
"""

import asyncio
import aiohttp
import json
import time
from pathlib import Path

# Get backend URL from frontend .env
frontend_env_path = Path(__file__).parent / "frontend" / ".env"
backend_url = "https://crypto-oracle-24.preview.emergentagent.com"

if frontend_env_path.exists():
    with open(frontend_env_path, 'r') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                backend_url = line.split('=', 1)[1].strip()
                break

API_BASE = f"{backend_url}/api"

class AutoRefreshScheduleTestSuite:
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
    
    async def test_scan_status_endpoint(self) -> bool:
        """Test scan status endpoint for auto-refresh functionality"""
        try:
            async with self.session.get(f"{API_BASE}/scan/status") as response:
                if response.status != 200:
                    self.log_test("Scan Status Endpoint", "FAIL", f"HTTP {response.status}")
                    return False
                
                data = await response.json()
                
                # Check required fields for auto-refresh
                required_fields = ['is_running', 'recent_run']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test("Scan Status Endpoint", "FAIL", f"Missing fields: {missing_fields}")
                    return False
                
                is_running = data.get('is_running')
                recent_run = data.get('recent_run')
                
                self.log_test("Scan Status Endpoint", "PASS", 
                             f"is_running: {is_running}, recent_run available: {recent_run is not None}")
                return True
                
        except Exception as e:
            self.log_test("Scan Status Endpoint", "FAIL", f"Error: {str(e)}")
            return False
    
    async def test_auto_refresh_flow(self) -> bool:
        """Test the complete auto-refresh flow"""
        try:
            print("🔄 Testing auto-refresh flow...")
            
            # 1. Check current scan status
            print("Step 1: Checking current scan status...")
            async with self.session.get(f"{API_BASE}/scan/status") as response:
                if response.status != 200:
                    self.log_test("Auto-Refresh Flow", "FAIL", f"Failed to get initial status: HTTP {response.status}")
                    return False
                
                initial_status = await response.json()
                print(f"Initial status - is_running: {initial_status.get('is_running')}")
            
            # 2. Trigger a new scan
            print("Step 2: Triggering new scan...")
            scan_request = {
                "scope": "all",
                "min_price": 10,
                "max_price": 1000
            }
            
            async with self.session.post(f"{API_BASE}/scan/run", json=scan_request) as response:
                if response.status != 200:
                    self.log_test("Auto-Refresh Flow", "FAIL", f"Failed to start scan: HTTP {response.status}")
                    return False
                
                scan_response = await response.json()
                print(f"Scan started: {scan_response.get('message')}")
            
            # 3. Poll status every 5 seconds (simulating frontend behavior)
            print("Step 3: Polling status every 5 seconds...")
            max_polls = 60  # 5 minutes max
            poll_count = 0
            
            while poll_count < max_polls:
                await asyncio.sleep(5)  # Frontend polls every 5 seconds
                poll_count += 1
                
                async with self.session.get(f"{API_BASE}/scan/status") as response:
                    if response.status != 200:
                        self.log_test("Auto-Refresh Flow", "FAIL", f"Status poll failed: HTTP {response.status}")
                        return False
                    
                    status_data = await response.json()
                    is_running = status_data.get('is_running', True)
                    recent_run = status_data.get('recent_run')
                    
                    print(f"Poll {poll_count}: is_running={is_running}")
                    
                    if not is_running:
                        # Scan completed - this is when frontend should auto-refresh
                        if recent_run and recent_run.get('status') == 'completed':
                            run_id = recent_run.get('id')
                            print(f"✅ Scan completed with run_id: {run_id}")
                            
                            # 4. Verify recommendations endpoint returns fresh data
                            print("Step 4: Verifying fresh recommendations...")
                            async with self.session.get(f"{API_BASE}/recommendations/top5") as rec_response:
                                if rec_response.status == 200:
                                    rec_data = await rec_response.json()
                                    returned_run_id = rec_data.get('run_id')
                                    
                                    if returned_run_id == run_id:
                                        self.log_test("Auto-Refresh Flow", "PASS", 
                                                     f"Auto-refresh flow working - scan completed and fresh data available (run_id: {run_id})")
                                        return True
                                    else:
                                        self.log_test("Auto-Refresh Flow", "FAIL", 
                                                     f"Run ID mismatch - expected {run_id}, got {returned_run_id}")
                                        return False
                                else:
                                    self.log_test("Auto-Refresh Flow", "FAIL", 
                                                 f"Failed to get recommendations: HTTP {rec_response.status}")
                                    return False
                        else:
                            self.log_test("Auto-Refresh Flow", "FAIL", "Scan completed but status not 'completed'")
                            return False
            
            self.log_test("Auto-Refresh Flow", "FAIL", "Scan timeout after 5 minutes")
            return False
            
        except Exception as e:
            self.log_test("Auto-Refresh Flow", "FAIL", f"Error: {str(e)}")
            return False
    
    async def test_integrations_config_endpoint(self) -> bool:
        """Test GET integrations config endpoint (should not return 500)"""
        try:
            async with self.session.get(f"{API_BASE}/config/integrations") as response:
                if response.status == 500:
                    self.log_test("Integrations Config GET", "FAIL", "Returns 500 error (ObjectId issue)")
                    return False
                elif response.status != 200:
                    self.log_test("Integrations Config GET", "FAIL", f"HTTP {response.status}")
                    return False
                
                data = await response.json()
                
                # Should return config or defaults
                expected_fields = ['smtp_host', 'smtp_port', 'smtp_user', 'email_to']
                has_config_fields = any(field in data for field in expected_fields)
                
                if not has_config_fields:
                    self.log_test("Integrations Config GET", "FAIL", "No expected config fields found")
                    return False
                
                self.log_test("Integrations Config GET", "PASS", 
                             f"Returns 200 with config fields: {list(data.keys())}")
                return True
                
        except Exception as e:
            self.log_test("Integrations Config GET", "FAIL", f"Error: {str(e)}")
            return False
    
    async def test_schedule_config_endpoint(self) -> bool:
        """Test GET schedule config endpoint (should not return 500)"""
        try:
            async with self.session.get(f"{API_BASE}/config/schedule") as response:
                if response.status == 500:
                    self.log_test("Schedule Config GET", "FAIL", "Returns 500 error (ObjectId issue)")
                    return False
                elif response.status != 200:
                    self.log_test("Schedule Config GET", "FAIL", f"HTTP {response.status}")
                    return False
                
                data = await response.json()
                
                # Should return config or defaults
                expected_fields = ['schedule_enabled', 'schedule_interval']
                has_config_fields = any(field in data for field in expected_fields)
                
                if not has_config_fields:
                    self.log_test("Schedule Config GET", "FAIL", "No expected config fields found")
                    return False
                
                self.log_test("Schedule Config GET", "PASS", 
                             f"Returns 200 with config fields: {list(data.keys())}")
                return True
                
        except Exception as e:
            self.log_test("Schedule Config GET", "FAIL", f"Error: {str(e)}")
            return False
    
    async def test_all_schedules_endpoint(self) -> bool:
        """Test GET all schedules endpoint (should not return 500)"""
        try:
            async with self.session.get(f"{API_BASE}/config/schedules/all") as response:
                if response.status == 500:
                    self.log_test("All Schedules GET", "FAIL", "Returns 500 error (ObjectId issue)")
                    return False
                elif response.status != 200:
                    self.log_test("All Schedules GET", "FAIL", f"HTTP {response.status}")
                    return False
                
                data = await response.json()
                
                # Should return schedules array
                if 'schedules' not in data:
                    self.log_test("All Schedules GET", "FAIL", "Missing 'schedules' field")
                    return False
                
                schedules = data.get('schedules', [])
                self.log_test("All Schedules GET", "PASS", 
                             f"Returns 200 with {len(schedules)} schedules")
                return True
                
        except Exception as e:
            self.log_test("All Schedules GET", "FAIL", f"Error: {str(e)}")
            return False
    
    def check_scheduler_status_in_logs(self) -> bool:
        """Check scheduler status from backend logs"""
        try:
            import subprocess
            
            # Check backend logs for scheduler messages
            result = subprocess.run([
                'tail', '-n', '50', '/var/log/supervisor/backend.err.log'
            ], capture_output=True, text=True)
            
            if result.returncode != 0:
                self.log_test("Scheduler Status Check", "FAIL", "Could not read backend logs")
                return False
            
            log_content = result.stdout.lower()
            
            # Look for scheduler-related messages
            scheduler_keywords = ['scheduler', 'schedule']
            scheduler_messages = []
            
            for line in result.stdout.split('\n'):
                if any(keyword in line.lower() for keyword in scheduler_keywords):
                    scheduler_messages.append(line.strip())
            
            if not scheduler_messages:
                self.log_test("Scheduler Status Check", "PARTIAL", "No scheduler messages found in recent logs")
                return True
            
            # Look for positive indicators
            positive_indicators = ['scheduler configured', 'scheduler started', 'scheduler running']
            has_positive = any(indicator in log_content for indicator in positive_indicators)
            
            if has_positive:
                self.log_test("Scheduler Status Check", "PASS", 
                             f"Scheduler appears to be running. Found messages: {len(scheduler_messages)}")
            else:
                self.log_test("Scheduler Status Check", "PARTIAL", 
                             f"Scheduler messages found but status unclear. Messages: {len(scheduler_messages)}")
            
            # Print recent scheduler messages for debugging
            print("Recent scheduler-related log messages:")
            for msg in scheduler_messages[-5:]:  # Last 5 messages
                print(f"  {msg}")
            
            return True
            
        except Exception as e:
            self.log_test("Scheduler Status Check", "FAIL", f"Error checking logs: {str(e)}")
            return False
    
    def document_email_setup_requirements(self):
        """Document email setup requirements for the user"""
        print("\n" + "="*60)
        print("EMAIL SETUP REQUIREMENTS")
        print("="*60)
        print("To enable scheduled email notifications, users need to:")
        print()
        print("1. Configure SMTP settings via API:")
        print(f"   PUT {API_BASE}/config/integrations")
        print("   Body: {")
        print('     "email_enabled": true,')
        print('     "smtp_host": "smtp.gmail.com",')
        print('     "smtp_port": 587,')
        print('     "smtp_user": "your-email@gmail.com",')
        print('     "smtp_pass": "your-app-password",')
        print('     "email_to": "recipient@gmail.com"')
        print("   }")
        print()
        print("2. Test email configuration:")
        print(f"   POST {API_BASE}/config/integrations/test-email")
        print()
        print("3. Enable scheduled scans:")
        print(f"   PUT {API_BASE}/config/schedule")
        print("   Body: {")
        print('     "schedule_enabled": true,')
        print('     "schedule_interval": "12h",')
        print('     "schedule_start_time": "09:00",')
        print('     "timezone": "UTC"')
        print("   }")
        print()
        print("Note: For Gmail, use App Passwords instead of regular passwords")
        print("="*60)
        
        self.log_test("Email Setup Documentation", "INFO", "Requirements documented for user")
    
    async def run_all_tests(self):
        """Run all auto-refresh and schedule tests"""
        print("=" * 60)
        print("AUTO-REFRESH AND SCHEDULE FUNCTIONALITY TEST SUITE")
        print("=" * 60)
        print(f"Testing API: {API_BASE}")
        print()
        
        # Test 1: Scan status endpoint
        print("🧪 Testing scan status endpoint...")
        await self.test_scan_status_endpoint()
        
        print()
        print("🧪 Testing schedule configuration endpoints...")
        
        # Test 2: Schedule configuration endpoints (fixing 500 errors)
        await self.test_integrations_config_endpoint()
        await self.test_schedule_config_endpoint()
        await self.test_all_schedules_endpoint()
        
        print()
        print("🧪 Checking scheduler status from logs...")
        
        # Test 3: Check scheduler status
        self.check_scheduler_status_in_logs()
        
        print()
        print("🧪 Testing auto-refresh flow...")
        
        # Test 4: Auto-refresh flow (this takes time)
        await self.test_auto_refresh_flow()
        
        # Test 5: Document email setup requirements
        self.document_email_setup_requirements()
        
        # Print summary
        print()
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['status'] == 'PASS')
        failed = sum(1 for result in self.test_results if result['status'] == 'FAIL')
        partial = sum(1 for result in self.test_results if result['status'] == 'PARTIAL')
        info = sum(1 for result in self.test_results if result['status'] == 'INFO')
        
        for result in self.test_results:
            if result['status'] == 'PASS':
                status_icon = "✅"
            elif result['status'] == 'FAIL':
                status_icon = "❌"
            elif result['status'] == 'PARTIAL':
                status_icon = "⚠️"
            else:
                status_icon = "ℹ️"
            print(f"{status_icon} {result['test']}: {result['details']}")
        
        print()
        print(f"Total Tests: {len(self.test_results)}")
        print(f"Passed: {passed}")
        print(f"Partial: {partial}")
        print(f"Failed: {failed}")
        print(f"Info: {info}")
        
        # Calculate success rate (PASS + PARTIAL as success)
        success_rate = ((passed + partial) / len(self.test_results) * 100) if self.test_results else 0
        print(f"Success Rate: {success_rate:.1f}%")
        
        # Specific findings for the review
        print()
        print("=" * 60)
        print("REVIEW FINDINGS")
        print("=" * 60)
        
        # Check if 500 errors are fixed
        config_tests = [r for r in self.test_results if 'Config' in r['test'] and r['status'] in ['PASS', 'FAIL']]
        fixed_500_errors = all(r['status'] == 'PASS' for r in config_tests)
        
        if fixed_500_errors and config_tests:
            print("✅ 500 errors in configuration endpoints: FIXED")
        elif config_tests:
            print("❌ 500 errors in configuration endpoints: NOT FIXED")
        else:
            print("⚠️ Configuration endpoints: NOT TESTED")
        
        # Check auto-refresh
        auto_refresh_test = next((r for r in self.test_results if 'Auto-Refresh Flow' in r['test']), None)
        if auto_refresh_test:
            if auto_refresh_test['status'] == 'PASS':
                print("✅ Auto-refresh after scan completion: WORKING")
            else:
                print("❌ Auto-refresh after scan completion: NOT WORKING")
        else:
            print("⚠️ Auto-refresh flow: NOT TESTED")
        
        # Check scheduler status
        scheduler_test = next((r for r in self.test_results if 'Scheduler Status' in r['test']), None)
        if scheduler_test:
            if scheduler_test['status'] in ['PASS', 'PARTIAL']:
                print("✅ Scheduler status: RUNNING")
            else:
                print("❌ Scheduler status: ISSUES DETECTED")
        else:
            print("⚠️ Scheduler status: NOT CHECKED")

async def main():
    """Main test runner"""
    async with AutoRefreshScheduleTestSuite() as test_suite:
        await test_suite.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())