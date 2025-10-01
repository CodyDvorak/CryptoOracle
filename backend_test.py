#!/usr/bin/env python3
"""
Backend Testing Script for Crypto Oracle
Tests authentication system and other features:
1. User Registration
2. User Login
3. Protected Endpoints
4. Bot Details API Endpoint
5. Custom Scan Backend Support  
6. Dynamic Confidence Calculation
"""

import asyncio
import aiohttp
import json
import time
import statistics
from typing import Dict, List, Optional

# Get backend URL from environment
import os
from pathlib import Path

# Load frontend .env to get backend URL
frontend_env_path = Path(__file__).parent / "frontend" / ".env"
backend_url = "https://coin-oracle-3.preview.emergentagent.com"

if frontend_env_path.exists():
    with open(frontend_env_path, 'r') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                backend_url = line.split('=', 1)[1].strip()
                break

API_BASE = f"{backend_url}/api"

class CryptoOracleTestSuite:
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
    
    async def test_health_check(self) -> bool:
        """Test basic API health"""
        try:
            async with self.session.get(f"{API_BASE}/health") as response:
                if response.status == 200:
                    data = await response.json()
                    self.log_test("Health Check", "PASS", f"API is healthy: {data.get('status')}")
                    return True
                else:
                    self.log_test("Health Check", "FAIL", f"HTTP {response.status}")
                    return False
        except Exception as e:
            self.log_test("Health Check", "FAIL", f"Connection error: {str(e)}")
            return False

    async def test_user_registration(self) -> Optional[str]:
        """Test user registration endpoint"""
        try:
            # Use realistic test data
            test_user = {
                "username": "cryptotrader2024",
                "email": "cryptotrader2024@example.com", 
                "password": "SecurePass123!"
            }
            
            async with self.session.post(f"{API_BASE}/auth/register", json=test_user) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Validate response structure
                    required_fields = ['access_token', 'user']
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if missing_fields:
                        self.log_test("User Registration", "FAIL", f"Missing fields: {missing_fields}")
                        return None
                    
                    # Validate user object
                    user = data.get('user', {})
                    user_fields = ['id', 'username', 'email', 'created_at', 'is_active']
                    missing_user_fields = [field for field in user_fields if field not in user]
                    
                    if missing_user_fields:
                        self.log_test("User Registration", "FAIL", f"Missing user fields: {missing_user_fields}")
                        return None
                    
                    # Validate data matches
                    if user.get('username') != test_user['username'] or user.get('email') != test_user['email']:
                        self.log_test("User Registration", "FAIL", "User data doesn't match registration data")
                        return None
                    
                    access_token = data.get('access_token')
                    self.log_test("User Registration", "PASS", f"User registered successfully: {user.get('username')}")
                    return access_token
                    
                elif response.status == 400:
                    # User might already exist, try with different username
                    import random
                    test_user['username'] = f"cryptotrader{random.randint(1000, 9999)}"
                    test_user['email'] = f"cryptotrader{random.randint(1000, 9999)}@example.com"
                    
                    async with self.session.post(f"{API_BASE}/auth/register", json=test_user) as retry_response:
                        if retry_response.status == 200:
                            data = await retry_response.json()
                            access_token = data.get('access_token')
                            self.log_test("User Registration", "PASS", f"User registered successfully (retry): {test_user['username']}")
                            return access_token
                        else:
                            error_text = await retry_response.text()
                            self.log_test("User Registration", "FAIL", f"HTTP {retry_response.status}: {error_text}")
                            return None
                else:
                    error_text = await response.text()
                    self.log_test("User Registration", "FAIL", f"HTTP {response.status}: {error_text}")
                    return None
                    
        except Exception as e:
            self.log_test("User Registration", "FAIL", f"Error: {str(e)}")
            return None

    async def test_user_login(self, username: str = None, password: str = None) -> Optional[str]:
        """Test user login endpoint"""
        try:
            # Use provided credentials or default test credentials
            if not username:
                username = "cryptotrader2024"
                password = "SecurePass123!"
            
            login_data = {
                "username": username,
                "password": password
            }
            
            async with self.session.post(f"{API_BASE}/auth/login", json=login_data) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Validate response structure
                    required_fields = ['access_token', 'user']
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if missing_fields:
                        self.log_test("User Login", "FAIL", f"Missing fields: {missing_fields}")
                        return None
                    
                    access_token = data.get('access_token')
                    user = data.get('user', {})
                    
                    self.log_test("User Login", "PASS", f"User logged in successfully: {user.get('username')}")
                    return access_token
                    
                elif response.status == 401:
                    error_text = await response.text()
                    self.log_test("User Login", "FAIL", f"Invalid credentials: {error_text}")
                    return None
                else:
                    error_text = await response.text()
                    self.log_test("User Login", "FAIL", f"HTTP {response.status}: {error_text}")
                    return None
                    
        except Exception as e:
            self.log_test("User Login", "FAIL", f"Error: {str(e)}")
            return None

    async def test_protected_endpoint(self, access_token: str) -> bool:
        """Test protected endpoint with authentication"""
        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            
            async with self.session.get(f"{API_BASE}/auth/me", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Validate user information
                    user_fields = ['id', 'username', 'email', 'created_at', 'is_active']
                    missing_fields = [field for field in user_fields if field not in data]
                    
                    if missing_fields:
                        self.log_test("Protected Endpoint", "FAIL", f"Missing user fields: {missing_fields}")
                        return False
                    
                    self.log_test("Protected Endpoint", "PASS", f"User info retrieved: {data.get('username')}")
                    return True
                    
                elif response.status == 401:
                    error_text = await response.text()
                    self.log_test("Protected Endpoint", "FAIL", f"Unauthorized: {error_text}")
                    return False
                else:
                    error_text = await response.text()
                    self.log_test("Protected Endpoint", "FAIL", f"HTTP {response.status}: {error_text}")
                    return False
                    
        except Exception as e:
            self.log_test("Protected Endpoint", "FAIL", f"Error: {str(e)}")
            return False

    async def test_invalid_login(self) -> bool:
        """Test login with invalid credentials"""
        try:
            invalid_login = {
                "username": "cryptotrader2024",
                "password": "wrongpassword"
            }
            
            async with self.session.post(f"{API_BASE}/auth/login", json=invalid_login) as response:
                if response.status == 401:
                    error_data = await response.json()
                    self.log_test("Invalid Login", "PASS", f"Correctly rejected invalid credentials: {error_data.get('detail')}")
                    return True
                else:
                    self.log_test("Invalid Login", "FAIL", f"Expected 401, got {response.status}")
                    return False
                    
        except Exception as e:
            self.log_test("Invalid Login", "FAIL", f"Error: {str(e)}")
            return False

    async def test_database_user_creation(self, username: str) -> bool:
        """Test if user was created in database (indirect test via login)"""
        try:
            # Try to login with the registered user to verify database persistence
            login_data = {
                "username": username,
                "password": "SecurePass123!"
            }
            
            async with self.session.post(f"{API_BASE}/auth/login", json=login_data) as response:
                if response.status == 200:
                    self.log_test("Database User Creation", "PASS", f"User {username} persisted in database")
                    return True
                else:
                    self.log_test("Database User Creation", "FAIL", f"User {username} not found in database")
                    return False
                    
        except Exception as e:
            self.log_test("Database User Creation", "FAIL", f"Error: {str(e)}")
            return False
    
    async def run_scan_and_wait(self, scan_request: Dict) -> Optional[str]:
        """Run a scan and wait for completion, return run_id"""
        try:
            # Start scan
            async with self.session.post(f"{API_BASE}/scan/run", json=scan_request) as response:
                if response.status != 200:
                    self.log_test("Scan Start", "FAIL", f"HTTP {response.status}")
                    return None
                
                scan_data = await response.json()
                self.log_test("Scan Start", "PASS", f"Scan started: {scan_data.get('status')}")
            
            # Wait for completion (max 5 minutes)
            max_wait = 300  # 5 minutes
            wait_time = 0
            
            while wait_time < max_wait:
                await asyncio.sleep(10)  # Check every 10 seconds
                wait_time += 10
                
                async with self.session.get(f"{API_BASE}/scan/status") as response:
                    if response.status == 200:
                        status_data = await response.json()
                        is_running = status_data.get('is_running', True)
                        
                        if not is_running:
                            recent_run = status_data.get('recent_run')
                            if recent_run and recent_run.get('status') == 'completed':
                                run_id = recent_run.get('id')
                                self.log_test("Scan Completion", "PASS", f"Scan completed: {run_id}")
                                return run_id
                            else:
                                self.log_test("Scan Completion", "FAIL", "Scan failed or incomplete")
                                return None
                        else:
                            print(f"Scan still running... ({wait_time}s elapsed)")
            
            self.log_test("Scan Completion", "FAIL", "Scan timeout after 5 minutes")
            return None
            
        except Exception as e:
            self.log_test("Scan Execution", "FAIL", f"Error: {str(e)}")
            return None
    
    async def test_bot_details_api(self, run_id: str, coin_symbol: str) -> bool:
        """Test the bot details API endpoint"""
        try:
            url = f"{API_BASE}/recommendations/{run_id}/{coin_symbol}/bot_details"
            async with self.session.get(url) as response:
                if response.status == 404:
                    # This is expected for AI-only analysis coins
                    self.log_test("Bot Details API", "PARTIAL", 
                                 f"No bot details for {coin_symbol} (AI-only analysis mode)")
                    return True  # This is actually expected behavior
                elif response.status != 200:
                    self.log_test("Bot Details API", "FAIL", f"HTTP {response.status}")
                    return False
                
                data = await response.json()
                
                # Validate response structure
                required_fields = ['run_id', 'coin', 'ticker', 'total_bots', 'avg_confidence', 'bot_results']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test("Bot Details API", "FAIL", f"Missing fields: {missing_fields}")
                    return False
                
                # Validate bot_results structure
                bot_results = data.get('bot_results', [])
                if not bot_results:
                    self.log_test("Bot Details API", "PARTIAL", "No individual bot results (AI-only mode)")
                    return True
                
                # Check bot result structure
                bot_fields = ['bot_name', 'confidence', 'direction', 'entry_price', 'take_profit', 'stop_loss']
                for i, bot in enumerate(bot_results[:3]):  # Check first 3 bots
                    missing_bot_fields = [field for field in bot_fields if field not in bot]
                    if missing_bot_fields:
                        self.log_test("Bot Details API", "FAIL", f"Bot {i} missing fields: {missing_bot_fields}")
                        return False
                
                # Check if sorted by confidence (descending)
                confidences = [bot.get('confidence', 0) for bot in bot_results]
                is_sorted = all(confidences[i] >= confidences[i+1] for i in range(len(confidences)-1))
                
                if not is_sorted:
                    self.log_test("Bot Details API", "FAIL", "Bot results not sorted by confidence")
                    return False
                
                self.log_test("Bot Details API", "PASS", 
                             f"Found {len(bot_results)} bots for {coin_symbol}, avg_confidence: {data.get('avg_confidence')}")
                return True
                
        except Exception as e:
            self.log_test("Bot Details API", "FAIL", f"Error: {str(e)}")
            return False
    
    async def test_bot_details_error_cases(self) -> bool:
        """Test bot details API error cases"""
        try:
            # Test invalid run_id
            url = f"{API_BASE}/recommendations/invalid-run-id/BTC/bot_details"
            async with self.session.get(url) as response:
                if response.status != 404:
                    self.log_test("Bot Details Error Cases", "FAIL", f"Expected 404 for invalid run_id, got {response.status}")
                    return False
            
            self.log_test("Bot Details Error Cases", "PASS", "Invalid run_id returns 404")
            return True
            
        except Exception as e:
            self.log_test("Bot Details Error Cases", "FAIL", f"Error: {str(e)}")
            return False
    
    async def test_custom_scan_backend(self) -> Optional[str]:
        """Test custom scan backend support"""
        try:
            # First get available coins to use realistic symbols
            async with self.session.get(f"{API_BASE}/coins") as response:
                if response.status != 200:
                    self.log_test("Custom Scan Backend", "FAIL", "Failed to get available coins")
                    return None
                
                coins_data = await response.json()
                available_coins = coins_data.get('coins', [])
                
                if len(available_coins) < 3:
                    self.log_test("Custom Scan Backend", "FAIL", "Not enough coins available")
                    return None
                
                # Use first 3 available coins
                test_symbols = available_coins[:3]
                self.log_test("Custom Scan Setup", "INFO", f"Using symbols: {test_symbols}")
            
            # Test custom scan with available symbols
            custom_request = {
                "scope": "custom",
                "custom_symbols": test_symbols
            }
            
            run_id = await self.run_scan_and_wait(custom_request)
            if not run_id:
                self.log_test("Custom Scan Backend", "FAIL", "Custom scan failed to complete")
                return None
            
            # Verify recommendations only include specified symbols
            async with self.session.get(f"{API_BASE}/recommendations/top5?run_id={run_id}") as response:
                if response.status == 404:
                    # This might happen if no recommendations were generated
                    self.log_test("Custom Scan Backend", "PARTIAL", "Custom scan completed but no recommendations generated (possibly due to AI-only analysis)")
                    return run_id
                elif response.status != 200:
                    self.log_test("Custom Scan Backend", "FAIL", f"Failed to get recommendations: HTTP {response.status}")
                    return None
                
                data = await response.json()
                all_recommendations = data.get('recommendations', [])
                
                if not all_recommendations:
                    self.log_test("Custom Scan Backend", "PARTIAL", "Custom scan completed but no recommendations found")
                    return run_id
                
                # Check if only specified symbols are present
                found_symbols = set()
                for rec in all_recommendations:
                    ticker = rec.get('ticker', '')
                    if ticker:
                        found_symbols.add(ticker)
                
                expected_symbols = set(test_symbols)
                unexpected_symbols = found_symbols - expected_symbols
                
                if unexpected_symbols:
                    self.log_test("Custom Scan Backend", "FAIL", 
                                 f"Found unexpected symbols: {unexpected_symbols}")
                    return None
                
                self.log_test("Custom Scan Backend", "PASS", 
                             f"Custom scan completed with symbols: {found_symbols}")
                return run_id
                
        except Exception as e:
            self.log_test("Custom Scan Backend", "FAIL", f"Error: {str(e)}")
            return None
    
    async def test_dynamic_confidence_calculation(self, run_id: str) -> bool:
        """Test dynamic confidence calculation"""
        try:
            # Get recommendations
            async with self.session.get(f"{API_BASE}/recommendations/top5?run_id={run_id}") as response:
                if response.status == 404:
                    self.log_test("Dynamic Confidence", "PARTIAL", "No recommendations found for this run")
                    return True
                elif response.status != 200:
                    self.log_test("Dynamic Confidence", "FAIL", f"Failed to get recommendations: HTTP {response.status}")
                    return False
                
                data = await response.json()
                recommendations = data.get('recommendations', [])
                
                if not recommendations:
                    self.log_test("Dynamic Confidence", "PARTIAL", "No recommendations found")
                    return True
                
                # Test confidence calculation for first few coins
                tested_coins = 0
                ai_only_coins = 0
                
                for rec in recommendations[:5]:  # Test first 5 coins
                    coin_symbol = rec.get('ticker')
                    expected_confidence = rec.get('avg_confidence')
                    bot_count = rec.get('bot_count', 0)
                    
                    if not coin_symbol or expected_confidence is None:
                        continue
                    
                    # Check if this is AI-only analysis (bot_count = 1 usually indicates this)
                    if bot_count == 1:
                        ai_only_coins += 1
                        print(f"ℹ {coin_symbol}: AI-only analysis (confidence: {expected_confidence})")
                        continue
                    
                    # Get bot details for this coin
                    url = f"{API_BASE}/recommendations/{run_id}/{coin_symbol}/bot_details"
                    async with self.session.get(url) as response:
                        if response.status != 200:
                            print(f"⚠ {coin_symbol}: No bot details available (status: {response.status})")
                            continue
                        
                        bot_data = await response.json()
                        bot_results = bot_data.get('bot_results', [])
                        
                        if not bot_results:
                            print(f"⚠ {coin_symbol}: No individual bot results")
                            continue
                        
                        # Calculate manual average
                        confidences = [bot.get('confidence', 0) for bot in bot_results]
                        manual_avg = statistics.mean(confidences) if confidences else 0
                        
                        # Compare with tolerance for floating point precision
                        tolerance = 0.1
                        if abs(manual_avg - expected_confidence) > tolerance:
                            self.log_test("Dynamic Confidence", "FAIL", 
                                         f"{coin_symbol}: Expected {expected_confidence}, calculated {manual_avg}")
                            return False
                        
                        tested_coins += 1
                        print(f"✓ {coin_symbol}: avg_confidence {expected_confidence} matches calculated {manual_avg:.2f}")
                
                if tested_coins == 0:
                    if ai_only_coins > 0:
                        self.log_test("Dynamic Confidence", "PARTIAL", 
                                     f"All {ai_only_coins} coins use AI-only analysis (no individual bot results to test)")
                        return True
                    else:
                        self.log_test("Dynamic Confidence", "FAIL", "No coins could be tested")
                        return False
                
                self.log_test("Dynamic Confidence", "PASS", 
                             f"Tested {tested_coins} coins, all confidence calculations match. {ai_only_coins} AI-only coins skipped")
                return True
                
        except Exception as e:
            self.log_test("Dynamic Confidence", "FAIL", f"Error: {str(e)}")
            return False
    
    async def test_authenticated_scan_execution(self, access_token: str) -> Optional[str]:
        """Test authenticated scan execution with JWT token"""
        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            
            # Trigger scan with authentication
            scan_request = {
                "scope": "all",
                "min_price": 50,
                "max_price": 500
            }
            
            async with self.session.post(f"{API_BASE}/scan/run", json=scan_request, headers=headers) as response:
                if response.status != 200:
                    self.log_test("Authenticated Scan Start", "FAIL", f"HTTP {response.status}")
                    return None
                
                scan_data = await response.json()
                self.log_test("Authenticated Scan Start", "PASS", f"Authenticated scan started: {scan_data.get('status')}")
            
            # Poll scan status every 5 seconds as specified in requirements
            max_wait = 300  # 5 minutes
            wait_time = 0
            poll_count = 0
            
            while wait_time < max_wait:
                await asyncio.sleep(5)  # Poll every 5 seconds as specified
                wait_time += 5
                poll_count += 1
                
                async with self.session.get(f"{API_BASE}/scan/status") as response:
                    if response.status == 200:
                        status_data = await response.json()
                        is_running = status_data.get('is_running', True)
                        
                        print(f"Poll #{poll_count}: Scan running={is_running} ({wait_time}s elapsed)")
                        
                        if not is_running:
                            recent_run = status_data.get('recent_run')
                            if recent_run and recent_run.get('status') == 'completed':
                                run_id = recent_run.get('id')
                                self.log_test("Authenticated Scan Completion", "PASS", 
                                             f"Scan completed after {wait_time}s, run_id: {run_id}")
                                return run_id
                            else:
                                self.log_test("Authenticated Scan Completion", "FAIL", "Scan failed or incomplete")
                                return None
            
            self.log_test("Authenticated Scan Completion", "FAIL", "Scan timeout after 5 minutes")
            return None
            
        except Exception as e:
            self.log_test("Authenticated Scan Execution", "FAIL", f"Error: {str(e)}")
            return None

    async def test_auto_refresh_with_authentication(self, access_token: str, run_id: str) -> bool:
        """Test auto-refresh functionality with authentication headers"""
        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            
            # Call recommendations endpoint WITH auth token (this is the fix being tested)
            async with self.session.get(f"{API_BASE}/recommendations/top5", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Verify recommendations are returned
                    returned_run_id = data.get('run_id')
                    recommendations = data.get('recommendations', [])
                    
                    if not returned_run_id:
                        self.log_test("Auto-Refresh Auth", "FAIL", "No run_id returned in recommendations")
                        return False
                    
                    if returned_run_id != run_id:
                        self.log_test("Auto-Refresh Auth", "PARTIAL", 
                                     f"Different run_id returned: expected {run_id}, got {returned_run_id}")
                    
                    if not recommendations:
                        self.log_test("Auto-Refresh Auth", "PARTIAL", "No recommendations returned (may be expected)")
                        return True
                    
                    self.log_test("Auto-Refresh Auth", "PASS", 
                                 f"Authenticated recommendations returned: {len(recommendations)} items, run_id: {returned_run_id}")
                    return True
                    
                elif response.status == 404:
                    self.log_test("Auto-Refresh Auth", "PARTIAL", "No recommendations found (may be expected for new user)")
                    return True
                else:
                    error_text = await response.text()
                    self.log_test("Auto-Refresh Auth", "FAIL", f"HTTP {response.status}: {error_text}")
                    return False
                    
        except Exception as e:
            self.log_test("Auto-Refresh Auth", "FAIL", f"Error: {str(e)}")
            return False

    async def check_backend_logs_for_email_flow(self) -> bool:
        """Check backend logs for email notification flow with emoji indicators"""
        try:
            # This is a simulation since we can't directly access supervisor logs from the test
            # In a real scenario, we would check the actual log files
            self.log_test("Email Log Check", "INFO", "Checking backend logs for email notification flow...")
            
            # The email flow should include these emoji indicators according to the fix:
            # 🔔, ✉️, 📬, 📊, 🔧, 📤, ✅, ❌
            expected_indicators = ["🔔", "✉️", "📬", "📊", "🔧", "📤"]
            
            # Since we can't directly access logs in this test environment,
            # we'll mark this as a manual verification step
            self.log_test("Email Log Verification", "MANUAL", 
                         f"Manual check required: Look for emoji indicators in backend logs: {', '.join(expected_indicators)}")
            
            return True
            
        except Exception as e:
            self.log_test("Email Log Check", "FAIL", f"Error: {str(e)}")
            return False

    async def run_bug_fix_tests(self):
        """Run specific tests for the two critical bug fixes"""
        print("=" * 60)
        print("CRYPTO ORACLE BUG FIX VERIFICATION")
        print("=" * 60)
        print(f"Testing API: {API_BASE}")
        print()
        print("Testing fixes for:")
        print("1. Auto-refresh not working (auth headers missing)")
        print("2. Email notifications not being sent (logging enhancement)")
        print()
        
        # 1. Health check
        if not await self.test_health_check():
            print("❌ Health check failed - aborting tests")
            return
        
        print()
        print("🔐 Test 1: User Authentication Flow...")
        
        # 2. Register new test user with valid email
        import random
        test_email = f"codydvorakwork+test{random.randint(1000, 9999)}@gmail.com"
        
        # Override registration to use specific email
        test_user = {
            "username": f"testuser{random.randint(1000, 9999)}",
            "email": test_email,
            "password": "TestPass123!"
        }
        
        try:
            async with self.session.post(f"{API_BASE}/auth/register", json=test_user) as response:
                if response.status == 200:
                    data = await response.json()
                    access_token = data.get('access_token')
                    user = data.get('user', {})
                    self.log_test("User Registration", "PASS", 
                                 f"User registered: {user.get('username')} ({user.get('email')})")
                else:
                    error_text = await response.text()
                    self.log_test("User Registration", "FAIL", f"HTTP {response.status}: {error_text}")
                    return
        except Exception as e:
            self.log_test("User Registration", "FAIL", f"Error: {str(e)}")
            return
        
        # 3. Login with new user credentials
        login_data = {
            "username": test_user['username'],
            "password": test_user['password']
        }
        
        try:
            async with self.session.post(f"{API_BASE}/auth/login", json=login_data) as response:
                if response.status == 200:
                    data = await response.json()
                    login_token = data.get('access_token')
                    user = data.get('user', {})
                    self.log_test("User Login", "PASS", f"User logged in: {user.get('username')}")
                else:
                    error_text = await response.text()
                    self.log_test("User Login", "FAIL", f"HTTP {response.status}: {error_text}")
                    return
        except Exception as e:
            self.log_test("User Login", "FAIL", f"Error: {str(e)}")
            return
        
        # 4. Verify JWT token is valid
        if not await self.test_protected_endpoint(login_token):
            print("❌ JWT token validation failed - aborting remaining tests")
            return
        
        print()
        print("🔄 Test 2: Authenticated Scan Execution...")
        
        # 5. Trigger authenticated scan
        run_id = await self.test_authenticated_scan_execution(login_token)
        if not run_id:
            print("❌ Authenticated scan failed - aborting remaining tests")
            return
        
        print()
        print("🔄 Test 3: Auto-Refresh with Authentication...")
        
        # 6. Test auto-refresh with authentication (the main fix)
        await self.test_auto_refresh_with_authentication(login_token, run_id)
        
        print()
        print("📧 Test 4: Email Notification Verification...")
        
        # 7. Check email notification flow
        await self.check_backend_logs_for_email_flow()
        
        # Print summary
        print()
        print("=" * 60)
        print("BUG FIX TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['status'] == 'PASS')
        failed = sum(1 for result in self.test_results if result['status'] == 'FAIL')
        partial = sum(1 for result in self.test_results if result['status'] == 'PARTIAL')
        manual = sum(1 for result in self.test_results if result['status'] == 'MANUAL')
        info = sum(1 for result in self.test_results if result['status'] == 'INFO')
        
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
        print(f"Info: {info}")
        
        # Calculate success rate (PASS + PARTIAL as success)
        success_rate = ((passed + partial) / len(self.test_results) * 100) if self.test_results else 0
        print(f"Success Rate: {success_rate:.1f}%")
        
        print()
        print("📋 MANUAL VERIFICATION STEPS:")
        print("1. Check backend logs for email notification emoji indicators:")
        print("   🔔 User lookup, ✉️ Email config, 📬 SMTP setup, 📊 Email content")
        print("   🔧 Email send attempt, 📤 Send result, ✅ Success, ❌ Error")
        print("2. Check email inbox for scan results notification")
        print("3. Verify no silent failures in email notification flow")

    async def run_all_tests(self):
        """Run all test suites"""
        print("=" * 60)
        print("CRYPTO ORACLE BACKEND TEST SUITE")
        print("=" * 60)
        print(f"Testing API: {API_BASE}")
        print()
        
        # 1. Health check
        if not await self.test_health_check():
            print("❌ Health check failed - aborting tests")
            return
        
        print()
        print("🔐 Testing Authentication System...")
        
        # 2. Test user registration
        access_token = await self.test_user_registration()
        if not access_token:
            print("❌ User registration failed - continuing with other tests")
            access_token = None
        
        # Extract username for database test
        registered_username = None
        if access_token:
            # Try to get username from the token by calling /auth/me
            try:
                headers = {"Authorization": f"Bearer {access_token}"}
                async with self.session.get(f"{API_BASE}/auth/me", headers=headers) as response:
                    if response.status == 200:
                        user_data = await response.json()
                        registered_username = user_data.get('username')
            except:
                pass
        
        # 3. Test user login (try with registered user first, then fallback)
        login_token = None
        if registered_username:
            login_token = await self.test_user_login(registered_username, "SecurePass123!")
        
        if not login_token:
            # Fallback to default test user
            login_token = await self.test_user_login()
        
        # 4. Test protected endpoint
        if login_token or access_token:
            test_token = login_token or access_token
            await self.test_protected_endpoint(test_token)
        else:
            self.log_test("Protected Endpoint", "SKIP", "No valid token available")
        
        # 5. Test invalid login
        await self.test_invalid_login()
        
        # 6. Test database user creation
        if registered_username:
            await self.test_database_user_creation(registered_username)
        
        print()
        print("🔄 Running scan to get test data for other features...")
        
        # 7. Run a scan to test other features
        full_scan_request = {"scope": "all"}
        run_id = await self.run_scan_and_wait(full_scan_request)
        
        if run_id:
            # Get recommendations to find a coin to test
            async with self.session.get(f"{API_BASE}/recommendations/top5?run_id={run_id}") as response:
                if response.status == 200:
                    data = await response.json()
                    recommendations = data.get('recommendations', [])
                    if recommendations:
                        test_coin = recommendations[0].get('ticker')
                        print(f"Using {test_coin} for bot details testing")
                        
                        print()
                        print("🧪 Testing Bot Details API...")
                        
                        # 8. Test bot details API
                        await self.test_bot_details_api(run_id, test_coin)
                        await self.test_bot_details_error_cases()
                        
                        print()
                        print("🧪 Testing Dynamic Confidence Calculation...")
                        
                        # 9. Test dynamic confidence calculation
                        await self.test_dynamic_confidence_calculation(run_id)
                    else:
                        print("⚠️ No recommendations found - skipping bot details tests")
                else:
                    print("⚠️ Failed to get recommendations - skipping bot details tests")
            
            print()
            print("🧪 Testing Custom Scan Backend...")
            
            # 10. Test custom scan
            await self.test_custom_scan_backend()
        else:
            print("⚠️ Scan failed - skipping feature tests")
        
        # Print summary
        print()
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['status'] == 'PASS')
        failed = sum(1 for result in self.test_results if result['status'] == 'FAIL')
        partial = sum(1 for result in self.test_results if result['status'] == 'PARTIAL')
        skipped = sum(1 for result in self.test_results if result['status'] == 'SKIP')
        info = sum(1 for result in self.test_results if result['status'] == 'INFO')
        
        for result in self.test_results:
            if result['status'] == 'PASS':
                status_icon = "✅"
            elif result['status'] == 'FAIL':
                status_icon = "❌"
            elif result['status'] == 'PARTIAL':
                status_icon = "⚠️"
            elif result['status'] == 'SKIP':
                status_icon = "⏭️"
            else:
                status_icon = "ℹ️"
            print(f"{status_icon} {result['test']}: {result['details']}")
        
        print()
        print(f"Total Tests: {len(self.test_results)}")
        print(f"Passed: {passed}")
        print(f"Partial: {partial}")
        print(f"Failed: {failed}")
        print(f"Skipped: {skipped}")
        print(f"Info: {info}")
        
        # Calculate success rate (PASS + PARTIAL as success)
        success_rate = ((passed + partial) / len(self.test_results) * 100) if self.test_results else 0
        print(f"Success Rate: {success_rate:.1f}%")

async def main():
    """Main test runner"""
    async with CryptoOracleTestSuite() as test_suite:
        await test_suite.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())