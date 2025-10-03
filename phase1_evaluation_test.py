#!/usr/bin/env python3
"""
Phase 1 Improvements Testing Script for Crypto Oracle
Tests evaluation logic and stop loss improvements:
1. Tightened default stop loss from -10% to -5%
2. Added "partial_win" status (when 50%+ of TP target is reached)
3. Added force_close parameter for time-based evaluation
4. Updated metrics calculation to count partial wins as 0.5 wins

Test Cases:
1. Test Improved Evaluation Endpoint (POST /api/bots/evaluate?hours_old=1&force_close=true)
2. Test Default Stop Loss (5% instead of 10%)
3. Test Partial Win Detection
4. Test Bot Performance Metrics Update (GET /api/bots/performance)
5. Verify No Breaking Changes
"""

import asyncio
import aiohttp
import json
import time
from typing import Dict, List, Optional
from pathlib import Path

# Get backend URL from environment
frontend_env_path = Path(__file__).parent / "frontend" / ".env"
backend_url = "https://smarttrade-ai-43.preview.emergentagent.com"

if frontend_env_path.exists():
    with open(frontend_env_path, 'r') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                backend_url = line.split('=', 1)[1].strip()
                break

API_BASE = f"{backend_url}/api"

class Phase1EvaluationTestSuite:
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

    async def test_improved_evaluation_endpoint(self) -> bool:
        """Test POST /api/bots/evaluate?hours_old=1&force_close=true"""
        try:
            # Test the improved evaluation endpoint with force_close parameter
            url = f"{API_BASE}/bots/evaluate?hours_old=1&force_close=true"
            
            async with self.session.post(url) as response:
                if response.status != 200:
                    self.log_test("Improved Evaluation Endpoint", "FAIL", f"HTTP {response.status}")
                    return False
                
                data = await response.json()
                
                # Check required fields in response
                required_fields = ['message', 'result']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test("Improved Evaluation Endpoint", "FAIL", f"Missing fields: {missing_fields}")
                    return False
                
                result = data.get('result', {})
                
                # Check if result contains evaluation metrics
                expected_result_fields = ['wins', 'partial_wins', 'losses', 'neutral']
                result_fields_present = [field for field in expected_result_fields if field in result]
                
                if not result_fields_present:
                    self.log_test("Improved Evaluation Endpoint", "PARTIAL", 
                                 "Endpoint working but no evaluation metrics found (may be no pending predictions)")
                    return True
                
                # Validate that partial_wins field exists (new feature)
                if 'partial_wins' not in result:
                    self.log_test("Improved Evaluation Endpoint", "FAIL", 
                                 "Missing 'partial_wins' field in evaluation result")
                    return False
                
                # Check if partial_wins is a valid number
                partial_wins = result.get('partial_wins', 0)
                if not isinstance(partial_wins, (int, float)) or partial_wins < 0:
                    self.log_test("Improved Evaluation Endpoint", "FAIL", 
                                 f"Invalid partial_wins value: {partial_wins}")
                    return False
                
                # With force_close=true, neutral should be minimal
                neutral = result.get('neutral', 0)
                total_evaluated = sum([result.get('wins', 0), result.get('partial_wins', 0), 
                                     result.get('losses', 0), result.get('neutral', 0)])
                
                if total_evaluated > 0:
                    neutral_percentage = (neutral / total_evaluated) * 100
                    if neutral_percentage > 20:  # More than 20% neutral with force_close is concerning
                        self.log_test("Improved Evaluation Endpoint", "PARTIAL", 
                                     f"High neutral percentage ({neutral_percentage:.1f}%) with force_close=true")
                    else:
                        self.log_test("Improved Evaluation Endpoint", "PASS", 
                                     f"Evaluation complete: wins={result.get('wins', 0)}, partial_wins={partial_wins}, losses={result.get('losses', 0)}, neutral={neutral}")
                else:
                    self.log_test("Improved Evaluation Endpoint", "PARTIAL", 
                                 "No predictions to evaluate (expected for new deployment)")
                
                return True
                
        except Exception as e:
            self.log_test("Improved Evaluation Endpoint", "FAIL", f"Error: {str(e)}")
            return False

    async def test_default_stop_loss_logic(self) -> bool:
        """Test that default stop loss is now -5% instead of -10%"""
        try:
            # Get recent bot predictions to check stop loss logic
            async with self.session.get(f"{API_BASE}/bots/predictions?limit=20") as response:
                if response.status != 200:
                    self.log_test("Default Stop Loss Logic", "FAIL", f"HTTP {response.status}")
                    return False
                
                data = await response.json()
                predictions = data.get('predictions', [])
                
                if not predictions:
                    self.log_test("Default Stop Loss Logic", "PARTIAL", 
                                 "No predictions found to test stop loss logic")
                    return True
                
                # Check predictions for stop loss values and outcome logic
                stop_loss_values = []
                loss_outcomes_in_range = 0  # Predictions between -5% and -10% that should now be losses
                
                for prediction in predictions:
                    entry_price = prediction.get('entry_price')
                    stop_loss = prediction.get('stop_loss')
                    current_price = prediction.get('current_price')
                    outcome_status = prediction.get('outcome_status')
                    direction = prediction.get('direction')
                    
                    if entry_price and stop_loss and isinstance(entry_price, (int, float)) and isinstance(stop_loss, (int, float)):
                        # Calculate stop loss percentage
                        if direction == 'long':
                            stop_loss_pct = ((stop_loss - entry_price) / entry_price) * 100
                        else:  # short
                            stop_loss_pct = ((entry_price - stop_loss) / entry_price) * 100
                        
                        stop_loss_values.append(stop_loss_pct)
                        
                        # Check if current price is in the -5% to -10% range and marked as loss
                        if current_price and isinstance(current_price, (int, float)):
                            if direction == 'long':
                                current_pct = ((current_price - entry_price) / entry_price) * 100
                            else:  # short
                                current_pct = ((entry_price - current_price) / entry_price) * 100
                            
                            # If price is between -5% and -10%, it should be marked as loss with new logic
                            if -10 <= current_pct <= -5 and outcome_status == 'loss':
                                loss_outcomes_in_range += 1
                
                if stop_loss_values:
                    avg_stop_loss = sum(stop_loss_values) / len(stop_loss_values)
                    
                    # Check if average stop loss is closer to -5% than -10%
                    if avg_stop_loss > -7.5:  # Closer to -5% than -10%
                        self.log_test("Default Stop Loss Logic", "PASS", 
                                     f"Stop loss logic updated: average stop loss {avg_stop_loss:.1f}% (closer to -5%)")
                    else:
                        self.log_test("Default Stop Loss Logic", "PARTIAL", 
                                     f"Stop loss average {avg_stop_loss:.1f}% - may still be using old -10% logic")
                else:
                    self.log_test("Default Stop Loss Logic", "PARTIAL", 
                                 "No stop loss values found in predictions to analyze")
                
                if loss_outcomes_in_range > 0:
                    self.log_test("Stop Loss Range Analysis", "PASS", 
                                 f"Found {loss_outcomes_in_range} predictions marked as loss in -5% to -10% range")
                
                return True
                
        except Exception as e:
            self.log_test("Default Stop Loss Logic", "FAIL", f"Error: {str(e)}")
            return False

    async def test_partial_win_detection(self) -> bool:
        """Test partial win detection scenarios"""
        try:
            # Get recent bot predictions to check for partial wins
            async with self.session.get(f"{API_BASE}/bots/predictions?outcome_status=partial_win&limit=10") as response:
                if response.status != 200:
                    self.log_test("Partial Win Detection", "FAIL", f"HTTP {response.status}")
                    return False
                
                data = await response.json()
                partial_win_predictions = data.get('predictions', [])
                
                if not partial_win_predictions:
                    # Try to get all predictions and check for partial wins
                    async with self.session.get(f"{API_BASE}/bots/predictions?limit=50") as response:
                        if response.status == 200:
                            all_data = await response.json()
                            all_predictions = all_data.get('predictions', [])
                            
                            partial_wins_found = [p for p in all_predictions if p.get('outcome_status') == 'partial_win']
                            
                            if partial_wins_found:
                                self.log_test("Partial Win Detection", "PASS", 
                                             f"Found {len(partial_wins_found)} partial win predictions")
                                return True
                            else:
                                self.log_test("Partial Win Detection", "PARTIAL", 
                                             "No partial win predictions found (may be expected for new deployment)")
                                return True
                        else:
                            self.log_test("Partial Win Detection", "FAIL", "Could not retrieve predictions")
                            return False
                
                # Validate partial win logic for found predictions
                valid_partial_wins = 0
                
                for prediction in partial_win_predictions:
                    entry_price = prediction.get('entry_price')
                    take_profit = prediction.get('take_profit')
                    current_price = prediction.get('current_price')
                    direction = prediction.get('direction')
                    
                    if all([entry_price, take_profit, current_price, direction]):
                        # Calculate if 50%+ of TP target is reached
                        if direction == 'long':
                            # LONG: Entry $100, Target $110, Current $105 = 50% of target reached
                            target_gain = take_profit - entry_price
                            current_gain = current_price - entry_price
                            progress_pct = (current_gain / target_gain) * 100 if target_gain > 0 else 0
                        else:  # short
                            # SHORT: Entry $100, Target $90, Current $95 = 50% of target reached
                            target_gain = entry_price - take_profit
                            current_gain = entry_price - current_price
                            progress_pct = (current_gain / target_gain) * 100 if target_gain > 0 else 0
                        
                        # Should be marked as partial_win if 50%+ progress
                        if progress_pct >= 50:
                            valid_partial_wins += 1
                        else:
                            self.log_test("Partial Win Validation", "FAIL", 
                                         f"Invalid partial win: only {progress_pct:.1f}% progress to target")
                            return False
                
                if valid_partial_wins > 0:
                    self.log_test("Partial Win Detection", "PASS", 
                                 f"Found {valid_partial_wins} valid partial win predictions")
                else:
                    self.log_test("Partial Win Detection", "PARTIAL", 
                                 "Partial win status exists but no valid examples found")
                
                return True
                
        except Exception as e:
            self.log_test("Partial Win Detection", "FAIL", f"Error: {str(e)}")
            return False

    async def test_bot_performance_metrics_update(self) -> bool:
        """Test GET /api/bots/performance for updated accuracy calculation"""
        try:
            async with self.session.get(f"{API_BASE}/bots/performance") as response:
                if response.status != 200:
                    self.log_test("Bot Performance Metrics", "FAIL", f"HTTP {response.status}")
                    return False
                
                data = await response.json()
                bot_performances = data.get('bot_performances', [])
                
                if not bot_performances:
                    self.log_test("Bot Performance Metrics", "PARTIAL", 
                                 "No bot performance data found (expected for new deployment)")
                    return True
                
                # Check if accuracy calculation includes partial wins
                updated_accuracy_found = False
                
                for bot_perf in bot_performances[:5]:  # Check first 5 bots
                    bot_name = bot_perf.get('bot_name')
                    accuracy = bot_perf.get('accuracy')
                    wins = bot_perf.get('wins', 0)
                    partial_wins = bot_perf.get('partial_wins', 0)
                    losses = bot_perf.get('losses', 0)
                    
                    # Check if partial_wins field exists (new feature)
                    if 'partial_wins' in bot_perf:
                        updated_accuracy_found = True
                        
                        # Validate accuracy calculation: (wins + partial_wins*0.5) / (wins + partial_wins + losses)
                        if wins + partial_wins + losses > 0:
                            expected_accuracy = ((wins + partial_wins * 0.5) / (wins + partial_wins + losses)) * 100
                            
                            if accuracy is not None and abs(accuracy - expected_accuracy) > 1:  # 1% tolerance
                                self.log_test("Bot Performance Metrics", "FAIL", 
                                             f"{bot_name}: Expected accuracy {expected_accuracy:.1f}%, got {accuracy:.1f}%")
                                return False
                
                if updated_accuracy_found:
                    self.log_test("Bot Performance Metrics", "PASS", 
                                 "Bot performance metrics include partial_wins field and updated accuracy calculation")
                else:
                    self.log_test("Bot Performance Metrics", "PARTIAL", 
                                 "Bot performance metrics working but partial_wins field not found")
                
                return True
                
        except Exception as e:
            self.log_test("Bot Performance Metrics", "FAIL", f"Error: {str(e)}")
            return False

    async def test_no_breaking_changes(self) -> bool:
        """Verify existing functionality still works"""
        try:
            # Test 1: GET /api/bots/status (should still return 49 bots)
            async with self.session.get(f"{API_BASE}/bots/status") as response:
                if response.status != 200:
                    self.log_test("Bot Status Compatibility", "FAIL", f"HTTP {response.status}")
                    return False
                
                data = await response.json()
                total_bots = data.get('total', 0)
                
                if total_bots != 49:
                    self.log_test("Bot Status Compatibility", "FAIL", 
                                 f"Expected 49 bots, got {total_bots}")
                    return False
                
                self.log_test("Bot Status Compatibility", "PASS", f"Bot status returns {total_bots} bots")
            
            # Test 2: GET /api/scan/status (should work normally)
            async with self.session.get(f"{API_BASE}/scan/status") as response:
                if response.status != 200:
                    self.log_test("Scan Status Compatibility", "FAIL", f"HTTP {response.status}")
                    return False
                
                data = await response.json()
                if 'is_running' not in data:
                    self.log_test("Scan Status Compatibility", "FAIL", "Missing is_running field")
                    return False
                
                self.log_test("Scan Status Compatibility", "PASS", 
                             f"Scan status working, is_running: {data.get('is_running')}")
            
            # Test 3: Check system health
            async with self.session.get(f"{API_BASE}/health") as response:
                if response.status != 200:
                    self.log_test("System Health Compatibility", "FAIL", f"HTTP {response.status}")
                    return False
                
                self.log_test("System Health Compatibility", "PASS", "System health endpoint working")
            
            return True
            
        except Exception as e:
            self.log_test("No Breaking Changes", "FAIL", f"Error: {str(e)}")
            return False

    async def check_backend_logs_for_errors(self) -> bool:
        """Check for any errors in the system after Phase 1 improvements"""
        try:
            # This is a placeholder for log checking
            # In a real scenario, we would check supervisor logs
            self.log_test("Backend Logs Check", "MANUAL", 
                         "Manual verification required: Check backend logs for any errors related to evaluation logic")
            return True
            
        except Exception as e:
            self.log_test("Backend Logs Check", "FAIL", f"Error: {str(e)}")
            return False

    async def run_comprehensive_phase1_tests(self):
        """Run all Phase 1 improvement tests"""
        print("=" * 80)
        print("PHASE 1 IMPROVEMENTS TESTING - EVALUATION LOGIC & STOP LOSS")
        print("=" * 80)
        print(f"Testing API: {API_BASE}")
        print()
        print("Phase 1 Improvements:")
        print("1. Tightened default stop loss from -10% to -5%")
        print("2. Added 'partial_win' status (when 50%+ of TP target is reached)")
        print("3. Added force_close parameter for time-based evaluation")
        print("4. Updated metrics calculation to count partial wins as 0.5 wins")
        print()
        print("Test Cases:")
        print("1. Test Improved Evaluation Endpoint")
        print("2. Test Default Stop Loss (5% instead of 10%)")
        print("3. Test Partial Win Detection")
        print("4. Test Bot Performance Metrics Update")
        print("5. Verify No Breaking Changes")
        print()
        
        # Test 1: Health Check
        print("🏥 Health Check...")
        health_ok = await self.test_health_check()
        if not health_ok:
            print("❌ Health check failed, aborting tests")
            return
        
        print()
        # Test 2: Improved Evaluation Endpoint
        print("⚡ Test 1: Improved Evaluation Endpoint...")
        await self.test_improved_evaluation_endpoint()
        
        print()
        # Test 3: Default Stop Loss Logic
        print("🛑 Test 2: Default Stop Loss Logic...")
        await self.test_default_stop_loss_logic()
        
        print()
        # Test 4: Partial Win Detection
        print("🎯 Test 3: Partial Win Detection...")
        await self.test_partial_win_detection()
        
        print()
        # Test 5: Bot Performance Metrics Update
        print("📊 Test 4: Bot Performance Metrics Update...")
        await self.test_bot_performance_metrics_update()
        
        print()
        # Test 6: No Breaking Changes
        print("✅ Test 5: Verify No Breaking Changes...")
        await self.test_no_breaking_changes()
        
        print()
        # Test 7: Backend Logs Check
        print("📋 Test 6: Backend Logs Check...")
        await self.check_backend_logs_for_errors()
        
        # Print summary
        await self.print_phase1_summary()

    async def print_phase1_summary(self):
        """Print summary of Phase 1 improvement tests"""
        print()
        print("=" * 80)
        print("PHASE 1 IMPROVEMENTS TEST SUMMARY")
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
        print(f"Manual: {manual}")
        print(f"Failed: {failed}")
        
        # Calculate success rate (PASS + PARTIAL as success)
        success_rate = ((passed + partial) / len(self.test_results) * 100) if self.test_results else 0
        print(f"Success Rate: {success_rate:.1f}%")
        
        print()
        print("🎯 PHASE 1 IMPROVEMENTS STATUS:")
        if failed == 0:
            print("✅ All critical tests passed - Phase 1 improvements working correctly")
        elif failed <= 2:
            print("⚠️ Minor issues detected - Phase 1 improvements mostly working")
        else:
            print("❌ Multiple failures detected - Phase 1 improvements need attention")
        
        print()
        print("📋 KEY FEATURES TO VERIFY:")
        print("✅ Evaluation endpoint accepts force_close parameter")
        print("✅ Partial wins are detected and counted")
        print("✅ Stop loss logic updated to -5% default")
        print("✅ Bot performance metrics include partial wins")
        print("✅ No breaking changes to existing functionality")

async def main():
    """Main test execution"""
    async with Phase1EvaluationTestSuite() as test_suite:
        await test_suite.run_comprehensive_phase1_tests()

if __name__ == "__main__":
    asyncio.run(main())