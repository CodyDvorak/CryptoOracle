#!/usr/bin/env python3
"""
Authentication System Test for Crypto Oracle
Tests the authentication endpoints as requested in the review.
"""

import asyncio
import aiohttp
import json
import time
from pathlib import Path

# Get backend URL from environment
frontend_env_path = Path(__file__).parent / "frontend" / ".env"
backend_url = "https://crypto-oracle-24.preview.emergentagent.com"

if frontend_env_path.exists():
    with open(frontend_env_path, 'r') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                backend_url = line.split('=', 1)[1].strip()
                break

API_BASE = f"{backend_url}/api"

class AuthTestSuite:
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
        status_icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
        print(f"{status_icon} {test_name}: {details}")
    
    async def test_user_registration(self):
        """Test user registration endpoint"""
        print("\n🔐 Testing User Registration...")
        try:
            # Use realistic test data
            import random
            user_id = random.randint(1000, 9999)
            test_user = {
                "username": f"cryptotrader{user_id}",
                "email": f"cryptotrader{user_id}@example.com", 
                "password": "testpass123"
            }
            
            async with self.session.post(f"{API_BASE}/auth/register", json=test_user) as response:
                print(f"Status Code: {response.status}")
                
                if response.status == 200:
                    data = await response.json()
                    print(f"Response: {json.dumps(data, indent=2)}")
                    
                    # Validate response structure
                    required_fields = ['access_token', 'user']
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if missing_fields:
                        self.log_test("User Registration", "FAIL", f"Missing fields: {missing_fields}")
                        return None, None
                    
                    # Validate user object
                    user = data.get('user', {})
                    user_fields = ['id', 'username', 'email', 'created_at', 'is_active']
                    missing_user_fields = [field for field in user_fields if field not in user]
                    
                    if missing_user_fields:
                        self.log_test("User Registration", "FAIL", f"Missing user fields: {missing_user_fields}")
                        return None, None
                    
                    # Validate data matches
                    if user.get('username') != test_user['username'] or user.get('email') != test_user['email']:
                        self.log_test("User Registration", "FAIL", "User data doesn't match registration data")
                        return None, None
                    
                    access_token = data.get('access_token')
                    self.log_test("User Registration", "PASS", f"User registered successfully: {user.get('username')}")
                    return access_token, test_user
                    
                elif response.status == 400:
                    error_data = await response.json()
                    self.log_test("User Registration", "FAIL", f"Bad Request: {error_data.get('detail')}")
                    return None, None
                else:
                    error_text = await response.text()
                    self.log_test("User Registration", "FAIL", f"HTTP {response.status}: {error_text}")
                    return None, None
                    
        except Exception as e:
            self.log_test("User Registration", "FAIL", f"Error: {str(e)}")
            return None, None

    async def test_user_login(self, test_user):
        """Test user login endpoint"""
        print("\n🔐 Testing User Login...")
        try:
            login_data = {
                "username": test_user['username'],
                "password": test_user['password']
            }
            
            async with self.session.post(f"{API_BASE}/auth/login", json=login_data) as response:
                print(f"Status Code: {response.status}")
                
                if response.status == 200:
                    data = await response.json()
                    print(f"Response: {json.dumps(data, indent=2)}")
                    
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
                    error_data = await response.json()
                    self.log_test("User Login", "FAIL", f"Invalid credentials: {error_data.get('detail')}")
                    return None
                else:
                    error_text = await response.text()
                    self.log_test("User Login", "FAIL", f"HTTP {response.status}: {error_text}")
                    return None
                    
        except Exception as e:
            self.log_test("User Login", "FAIL", f"Error: {str(e)}")
            return None

    async def test_protected_endpoint(self, access_token):
        """Test protected endpoint with authentication"""
        print("\n🔐 Testing Protected Endpoint (/auth/me)...")
        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            
            async with self.session.get(f"{API_BASE}/auth/me", headers=headers) as response:
                print(f"Status Code: {response.status}")
                
                if response.status == 200:
                    data = await response.json()
                    print(f"Response: {json.dumps(data, indent=2)}")
                    
                    # Validate user information
                    user_fields = ['id', 'username', 'email', 'created_at', 'is_active']
                    missing_fields = [field for field in user_fields if field not in data]
                    
                    if missing_fields:
                        self.log_test("Protected Endpoint", "FAIL", f"Missing user fields: {missing_fields}")
                        return False
                    
                    self.log_test("Protected Endpoint", "PASS", f"User info retrieved: {data.get('username')}")
                    return True
                    
                elif response.status == 401:
                    error_data = await response.json()
                    self.log_test("Protected Endpoint", "FAIL", f"Unauthorized: {error_data.get('detail')}")
                    return False
                else:
                    error_text = await response.text()
                    self.log_test("Protected Endpoint", "FAIL", f"HTTP {response.status}: {error_text}")
                    return False
                    
        except Exception as e:
            self.log_test("Protected Endpoint", "FAIL", f"Error: {str(e)}")
            return False

    async def test_invalid_login(self):
        """Test login with invalid credentials"""
        print("\n🔐 Testing Invalid Login...")
        try:
            invalid_login = {
                "username": "nonexistentuser",
                "password": "wrongpassword"
            }
            
            async with self.session.post(f"{API_BASE}/auth/login", json=invalid_login) as response:
                print(f"Status Code: {response.status}")
                
                if response.status == 401:
                    error_data = await response.json()
                    print(f"Response: {json.dumps(error_data, indent=2)}")
                    self.log_test("Invalid Login", "PASS", f"Correctly rejected invalid credentials: {error_data.get('detail')}")
                    return True
                else:
                    self.log_test("Invalid Login", "FAIL", f"Expected 401, got {response.status}")
                    return False
                    
        except Exception as e:
            self.log_test("Invalid Login", "FAIL", f"Error: {str(e)}")
            return False

    async def test_database_persistence(self, test_user):
        """Test if user was created in database (indirect test via login)"""
        print("\n🔐 Testing Database User Persistence...")
        try:
            # Try to login again to verify database persistence
            login_data = {
                "username": test_user['username'],
                "password": test_user['password']
            }
            
            async with self.session.post(f"{API_BASE}/auth/login", json=login_data) as response:
                if response.status == 200:
                    data = await response.json()
                    user = data.get('user', {})
                    self.log_test("Database Persistence", "PASS", f"User {user.get('username')} persisted in database")
                    return True
                else:
                    self.log_test("Database Persistence", "FAIL", f"User {test_user['username']} not found in database")
                    return False
                    
        except Exception as e:
            self.log_test("Database Persistence", "FAIL", f"Error: {str(e)}")
            return False

    async def run_auth_tests(self):
        """Run all authentication tests"""
        print("=" * 60)
        print("CRYPTO ORACLE AUTHENTICATION TEST SUITE")
        print("=" * 60)
        print(f"Testing API: {API_BASE}")
        
        # Test 1: User Registration
        access_token, test_user = await self.test_user_registration()
        
        if not access_token or not test_user:
            print("❌ Registration failed - aborting remaining tests")
            return
        
        # Test 2: User Login
        login_token = await self.test_user_login(test_user)
        
        # Test 3: Protected Endpoint
        if login_token:
            await self.test_protected_endpoint(login_token)
        elif access_token:
            await self.test_protected_endpoint(access_token)
        
        # Test 4: Invalid Login
        await self.test_invalid_login()
        
        # Test 5: Database Persistence
        await self.test_database_persistence(test_user)
        
        # Print summary
        print("\n" + "=" * 60)
        print("AUTHENTICATION TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['status'] == 'PASS')
        failed = sum(1 for result in self.test_results if result['status'] == 'FAIL')
        
        for result in self.test_results:
            status_icon = "✅" if result['status'] == 'PASS' else "❌"
            print(f"{status_icon} {result['test']}: {result['details']}")
        
        print(f"\nTotal Tests: {len(self.test_results)}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        
        success_rate = (passed / len(self.test_results) * 100) if self.test_results else 0
        print(f"Success Rate: {success_rate:.1f}%")
        
        return success_rate >= 80  # Consider 80%+ as success

async def main():
    """Main test runner"""
    async with AuthTestSuite() as test_suite:
        success = await test_suite.run_auth_tests()
        return success

if __name__ == "__main__":
    result = asyncio.run(main())
    exit(0 if result else 1)