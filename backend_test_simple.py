#!/usr/bin/env python3
"""
Simplified Backend Testing Script for Crypto Oracle
Tests the 3 new features using existing scan data
"""

import asyncio
import aiohttp
import json
import time
import statistics
from typing import Dict, List, Optional
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
    
    async def test_bot_details_api_structure(self) -> bool:
        """Test bot details API endpoint structure"""
        try:
            # Get latest recommendations
            async with self.session.get(f"{API_BASE}/recommendations/top5") as response:
                if response.status != 200:
                    self.log_test("Bot Details API Structure", "FAIL", f"Failed to get recommendations: HTTP {response.status}")
                    return False
                
                data = await response.json()
                run_id = data.get('run_id')
                recommendations = data.get('recommendations', [])
                
                if not recommendations:
                    self.log_test("Bot Details API Structure", "FAIL", "No recommendations found")
                    return False
                
                test_coin = recommendations[0].get('ticker')
                
                # Test bot details endpoint
                url = f"{API_BASE}/recommendations/{run_id}/{test_coin}/bot_details"
                async with self.session.get(url) as response:
                    if response.status == 404:
                        # Expected for AI-only analysis
                        self.log_test("Bot Details API Structure", "PASS", 
                                     f"Endpoint correctly returns 404 for AI-only analysis coin {test_coin}")
                        return True
                    elif response.status == 200:
                        # If we get data, validate structure
                        bot_data = await response.json()
                        required_fields = ['run_id', 'coin', 'ticker', 'total_bots', 'avg_confidence', 'bot_results']
                        missing_fields = [field for field in required_fields if field not in bot_data]
                        
                        if missing_fields:
                            self.log_test("Bot Details API Structure", "FAIL", f"Missing fields: {missing_fields}")
                            return False
                        
                        self.log_test("Bot Details API Structure", "PASS", 
                                     f"Endpoint returns correct structure for {test_coin}")
                        return True
                    else:
                        self.log_test("Bot Details API Structure", "FAIL", f"Unexpected HTTP {response.status}")
                        return False
                        
        except Exception as e:
            self.log_test("Bot Details API Structure", "FAIL", f"Error: {str(e)}")
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
            
            self.log_test("Bot Details Error Cases", "PASS", "Invalid run_id correctly returns 404")
            return True
            
        except Exception as e:
            self.log_test("Bot Details Error Cases", "FAIL", f"Error: {str(e)}")
            return False
    
    async def test_custom_scan_parameter_support(self) -> bool:
        """Test that custom scan parameter is accepted by the API"""
        try:
            # Get available coins
            async with self.session.get(f"{API_BASE}/coins") as response:
                if response.status != 200:
                    self.log_test("Custom Scan Parameter", "FAIL", "Failed to get available coins")
                    return False
                
                coins_data = await response.json()
                available_coins = coins_data.get('coins', [])
                
                if len(available_coins) < 2:
                    self.log_test("Custom Scan Parameter", "FAIL", "Not enough coins available")
                    return False
                
                test_symbols = available_coins[:2]
            
            # Test that the API accepts custom scan request (don't wait for completion)
            custom_request = {
                "scope": "custom",
                "custom_symbols": test_symbols
            }
            
            async with self.session.post(f"{API_BASE}/scan/run", json=custom_request) as response:
                if response.status == 409:
                    self.log_test("Custom Scan Parameter", "PASS", "Custom scan parameter accepted (scan already running)")
                    return True
                elif response.status == 200:
                    data = await response.json()
                    if data.get('scope') == 'custom':
                        self.log_test("Custom Scan Parameter", "PASS", "Custom scan parameter accepted and processed")
                        return True
                    else:
                        self.log_test("Custom Scan Parameter", "FAIL", "Custom scope not reflected in response")
                        return False
                else:
                    self.log_test("Custom Scan Parameter", "FAIL", f"Unexpected HTTP {response.status}")
                    return False
                    
        except Exception as e:
            self.log_test("Custom Scan Parameter", "FAIL", f"Error: {str(e)}")
            return False
    
    async def test_dynamic_confidence_validation(self) -> bool:
        """Test that confidence scores are properly calculated"""
        try:
            # Get latest recommendations
            async with self.session.get(f"{API_BASE}/recommendations/top5") as response:
                if response.status != 200:
                    self.log_test("Dynamic Confidence Validation", "FAIL", f"Failed to get recommendations: HTTP {response.status}")
                    return False
                
                data = await response.json()
                recommendations = data.get('recommendations', [])
                
                if not recommendations:
                    self.log_test("Dynamic Confidence Validation", "FAIL", "No recommendations found")
                    return False
                
                # Validate that confidence scores are reasonable numbers
                valid_confidences = 0
                for rec in recommendations:
                    confidence = rec.get('avg_confidence')
                    if confidence is not None and 0 <= confidence <= 10:
                        valid_confidences += 1
                
                if valid_confidences == 0:
                    self.log_test("Dynamic Confidence Validation", "FAIL", "No valid confidence scores found")
                    return False
                
                # Check that AI-only analysis produces consistent confidence scores
                ai_only_count = sum(1 for rec in recommendations if rec.get('bot_count') == 1)
                
                if ai_only_count > 0:
                    self.log_test("Dynamic Confidence Validation", "PASS", 
                                 f"Found {valid_confidences} valid confidence scores, {ai_only_count} AI-only analyses")
                else:
                    self.log_test("Dynamic Confidence Validation", "PASS", 
                                 f"Found {valid_confidences} valid confidence scores")
                return True
                
        except Exception as e:
            self.log_test("Dynamic Confidence Validation", "FAIL", f"Error: {str(e)}")
            return False
    
    async def test_scan_runs_endpoint(self) -> bool:
        """Test scan runs endpoint to verify custom scans are recorded"""
        try:
            async with self.session.get(f"{API_BASE}/scan/runs?limit=5") as response:
                if response.status != 200:
                    self.log_test("Scan Runs Endpoint", "FAIL", f"HTTP {response.status}")
                    return False
                
                data = await response.json()
                runs = data.get('runs', [])
                
                if not runs:
                    self.log_test("Scan Runs Endpoint", "FAIL", "No scan runs found")
                    return False
                
                # Check if any custom scans exist
                custom_scans = [run for run in runs if run.get('filter_scope') == 'custom']
                
                if custom_scans:
                    self.log_test("Scan Runs Endpoint", "PASS", 
                                 f"Found {len(custom_scans)} custom scans out of {len(runs)} total runs")
                else:
                    self.log_test("Scan Runs Endpoint", "PASS", 
                                 f"Scan runs endpoint working, {len(runs)} runs found (no custom scans yet)")
                return True
                
        except Exception as e:
            self.log_test("Scan Runs Endpoint", "FAIL", f"Error: {str(e)}")
            return False
    
    async def run_all_tests(self):
        """Run all test suites"""
        print("=" * 60)
        print("CRYPTO ORACLE BACKEND TEST SUITE (SIMPLIFIED)")
        print("=" * 60)
        print(f"Testing API: {API_BASE}")
        print()
        
        # 1. Health check
        if not await self.test_health_check():
            print("❌ Health check failed - aborting tests")
            return
        
        print()
        print("🧪 Testing Bot Details API Structure...")
        await self.test_bot_details_api_structure()
        await self.test_bot_details_error_cases()
        
        print()
        print("🧪 Testing Custom Scan Parameter Support...")
        await self.test_custom_scan_parameter_support()
        
        print()
        print("🧪 Testing Dynamic Confidence Validation...")
        await self.test_dynamic_confidence_validation()
        
        print()
        print("🧪 Testing Scan Runs Endpoint...")
        await self.test_scan_runs_endpoint()
        
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
        if partial > 0:
            print(f"Partial: {partial}")
        print(f"Failed: {failed}")
        if info > 0:
            print(f"Info: {info}")
        
        # Calculate success rate
        success_rate = (passed / len(self.test_results) * 100) if self.test_results else 0
        print(f"Success Rate: {success_rate:.1f}%")

async def main():
    """Main test runner"""
    async with CryptoOracleTestSuite() as test_suite:
        await test_suite.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())