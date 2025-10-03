#!/usr/bin/env python3
"""
Phase 3 Contrarian Bots Testing Script
Tests the fixes for JSON serialization and contrarian bot participation:

1. JSON Serialization Fix - Check if endpoints return 200 OK instead of 500
2. Contrarian Bot Participation - Verify contrarian bots appear in bot_results
3. Long/Short Balance - Check if there are any SHORT predictions now
4. Contrarian Bot Logic - Test specific bot behaviors
5. StochasticReversalBot Field Fix - Verify 'stoch_k' field is found
6. VolumeSpikeFadeBot Relaxed Triggers - Check if bot triggers more often
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
backend_url = "https://oracle-trading-1.preview.emergentagent.com"

if frontend_env_path.exists():
    with open(frontend_env_path, 'r') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                backend_url = line.split('=', 1)[1].strip()
                break

API_BASE = f"{backend_url}/api"

class Phase3ContrariansTestSuite:
    def __init__(self):
        self.session = None
        self.test_results = []
        self.contrarian_bots = [
            "RSI_ReversalBot",
            "MeanReversionBot", 
            "BollingerReversalBot",
            "StochasticReversalBot",
            "VolumeSpikeFadeBot"
        ]
        
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

    async def test_json_serialization_fix(self) -> bool:
        """Test 1: JSON Serialization Fix - Check if endpoints return 200 OK instead of 500"""
        try:
            print("\n🔧 TESTING JSON SERIALIZATION FIX")
            print("=" * 60)
            
            # Test GET /api/recommendations/top5
            print("Testing GET /api/recommendations/top5...")
            async with self.session.get(f"{API_BASE}/recommendations/top5") as response:
                if response.status == 500:
                    try:
                        error_data = await response.text()
                        if "JSON compliant" in error_data or "NaN" in error_data or "Infinity" in error_data:
                            self.log_test("JSON Serialization - Top5", "FAIL", 
                                         f"JSON serialization error still present: {response.status}")
                            return False
                    except:
                        pass
                    self.log_test("JSON Serialization - Top5", "FAIL", f"HTTP 500 error: {response.status}")
                    return False
                elif response.status == 200:
                    data = await response.json()
                    self.log_test("JSON Serialization - Top5", "PASS", 
                                 f"Endpoint returns 200 OK with {len(data.get('recommendations', []))} recommendations")
                elif response.status == 404:
                    self.log_test("JSON Serialization - Top5", "PARTIAL", 
                                 "No recommendations found (404) - but no JSON serialization error")
                else:
                    self.log_test("JSON Serialization - Top5", "PARTIAL", 
                                 f"HTTP {response.status} - not 500, so JSON serialization may be fixed")
            
            # Test bot details endpoint with a recent scan
            print("Testing bot details endpoints...")
            
            # Get recent scan run to test bot details
            async with self.session.get(f"{API_BASE}/scan/status") as response:
                if response.status == 200:
                    status_data = await response.json()
                    recent_run = status_data.get('recent_run')
                    
                    if recent_run and recent_run.get('id'):
                        run_id = recent_run['id']
                        
                        # Test bot details for common coins
                        test_coins = ['BTC', 'ETH', 'BNB', 'SOL', 'ADA']
                        
                        for coin in test_coins:
                            url = f"{API_BASE}/recommendations/{run_id}/{coin}/bot_details"
                            async with self.session.get(url) as response:
                                if response.status == 500:
                                    try:
                                        error_data = await response.text()
                                        if "JSON compliant" in error_data or "NaN" in error_data or "Infinity" in error_data:
                                            self.log_test("JSON Serialization - Bot Details", "FAIL", 
                                                         f"JSON serialization error for {coin}: {response.status}")
                                            return False
                                    except:
                                        pass
                                    self.log_test("JSON Serialization - Bot Details", "FAIL", 
                                                 f"HTTP 500 error for {coin}: {response.status}")
                                    return False
                                elif response.status == 200:
                                    data = await response.json()
                                    # Check for valid numeric values
                                    bot_results = data.get('bot_results', [])
                                    for bot in bot_results:
                                        confidence = bot.get('confidence')
                                        if confidence is not None:
                                            if not isinstance(confidence, (int, float)) or confidence != confidence:  # NaN check
                                                self.log_test("JSON Serialization - Bot Details", "FAIL", 
                                                             f"Invalid confidence value for {coin}: {confidence}")
                                                return False
                                    
                                    self.log_test("JSON Serialization - Bot Details", "PASS", 
                                                 f"{coin} bot details return valid JSON with {len(bot_results)} bots")
                                    break  # Found working example
                                elif response.status == 404:
                                    continue  # Try next coin
                                else:
                                    self.log_test("JSON Serialization - Bot Details", "PARTIAL", 
                                                 f"{coin} returns HTTP {response.status} - not 500")
                                    break
            
            return True
            
        except Exception as e:
            self.log_test("JSON Serialization Fix", "FAIL", f"Error: {str(e)}")
            return False

    async def run_test_scan(self, scan_params: Dict) -> Optional[str]:
        """Run a test scan and wait for completion"""
        try:
            print(f"Starting test scan with params: {scan_params}")
            
            # Start scan
            async with self.session.post(f"{API_BASE}/scan/run", json=scan_params) as response:
                if response.status != 200:
                    self.log_test("Test Scan Start", "FAIL", f"HTTP {response.status}")
                    return None
                
                scan_data = await response.json()
                self.log_test("Test Scan Start", "PASS", f"Scan started: {scan_data.get('status')}")
            
            # Wait for completion (max 15 minutes for test scan)
            max_wait = 900  # 15 minutes
            wait_time = 0
            
            while wait_time < max_wait:
                await asyncio.sleep(15)  # Check every 15 seconds
                wait_time += 15
                
                async with self.session.get(f"{API_BASE}/scan/status") as response:
                    if response.status == 200:
                        status_data = await response.json()
                        is_running = status_data.get('is_running', True)
                        
                        if not is_running:
                            recent_run = status_data.get('recent_run')
                            if recent_run and recent_run.get('status') == 'completed':
                                run_id = recent_run.get('id')
                                self.log_test("Test Scan Completion", "PASS", 
                                             f"Scan completed: {run_id} after {wait_time}s")
                                return run_id
                            else:
                                self.log_test("Test Scan Completion", "FAIL", "Scan failed or incomplete")
                                return None
                        else:
                            print(f"Scan still running... ({wait_time}s elapsed)")
            
            self.log_test("Test Scan Completion", "FAIL", "Scan timeout after 15 minutes")
            return None
            
        except Exception as e:
            self.log_test("Test Scan Execution", "FAIL", f"Error: {str(e)}")
            return None

    async def test_contrarian_bot_participation(self, run_id: str) -> bool:
        """Test 2: Check if contrarian bots appear in bot_results"""
        try:
            print("\n🤖 TESTING CONTRARIAN BOT PARTICIPATION")
            print("=" * 60)
            
            # Get recommendations from the scan
            async with self.session.get(f"{API_BASE}/recommendations/top5?run_id={run_id}") as response:
                if response.status != 200:
                    self.log_test("Contrarian Bot Participation", "FAIL", 
                                 f"Failed to get recommendations: HTTP {response.status}")
                    return False
                
                data = await response.json()
                recommendations = data.get('recommendations', [])
                
                if not recommendations:
                    self.log_test("Contrarian Bot Participation", "FAIL", "No recommendations found")
                    return False
                
                # Check bot details for several coins to find contrarian bots
                contrarian_bots_found = set()
                total_coins_checked = 0
                
                for rec in recommendations[:10]:  # Check first 10 coins
                    coin_symbol = rec.get('ticker')
                    if not coin_symbol:
                        continue
                    
                    total_coins_checked += 1
                    url = f"{API_BASE}/recommendations/{run_id}/{coin_symbol}/bot_details"
                    
                    async with self.session.get(url) as response:
                        if response.status == 200:
                            bot_data = await response.json()
                            bot_results = bot_data.get('bot_results', [])
                            
                            # Check for contrarian bots
                            for bot in bot_results:
                                bot_name = bot.get('bot_name', '')
                                if bot_name in self.contrarian_bots:
                                    contrarian_bots_found.add(bot_name)
                                    print(f"✓ Found contrarian bot: {bot_name} for {coin_symbol}")
                
                if contrarian_bots_found:
                    self.log_test("Contrarian Bot Participation", "PASS", 
                                 f"Found {len(contrarian_bots_found)} contrarian bots: {list(contrarian_bots_found)}")
                    return True
                else:
                    self.log_test("Contrarian Bot Participation", "FAIL", 
                                 f"No contrarian bots found in {total_coins_checked} coins checked")
                    return False
                    
        except Exception as e:
            self.log_test("Contrarian Bot Participation", "FAIL", f"Error: {str(e)}")
            return False

    async def test_long_short_balance(self, run_id: str) -> bool:
        """Test 3: Check if there are any SHORT predictions now"""
        try:
            print("\n⚖️ TESTING LONG/SHORT BALANCE")
            print("=" * 60)
            
            # Get recommendations from the scan
            async with self.session.get(f"{API_BASE}/recommendations/top5?run_id={run_id}") as response:
                if response.status != 200:
                    self.log_test("Long/Short Balance", "FAIL", 
                                 f"Failed to get recommendations: HTTP {response.status}")
                    return False
                
                data = await response.json()
                recommendations = data.get('recommendations', [])
                
                if not recommendations:
                    self.log_test("Long/Short Balance", "FAIL", "No recommendations found")
                    return False
                
                # Count long vs short predictions
                long_count = 0
                short_count = 0
                total_predictions = 0
                
                for rec in recommendations:
                    direction = rec.get('consensus_direction', '').lower()
                    if direction in ['long', 'buy']:
                        long_count += 1
                    elif direction in ['short', 'sell']:
                        short_count += 1
                    total_predictions += 1
                
                # Calculate percentages
                long_pct = (long_count / total_predictions * 100) if total_predictions > 0 else 0
                short_pct = (short_count / total_predictions * 100) if total_predictions > 0 else 0
                
                print(f"Prediction Distribution:")
                print(f"  LONG: {long_count}/{total_predictions} ({long_pct:.1f}%)")
                print(f"  SHORT: {short_count}/{total_predictions} ({short_pct:.1f}%)")
                
                if short_count > 0:
                    self.log_test("Long/Short Balance", "PASS", 
                                 f"Found {short_count} SHORT predictions ({short_pct:.1f}%) vs {long_count} LONG ({long_pct:.1f}%)")
                    return True
                elif long_count == total_predictions:
                    self.log_test("Long/Short Balance", "FAIL", 
                                 f"Still 100% LONG bias ({long_count}/{total_predictions}) - no SHORT predictions")
                    return False
                else:
                    self.log_test("Long/Short Balance", "PARTIAL", 
                                 f"No clear SHORT predictions found, but not 100% LONG either")
                    return False
                    
        except Exception as e:
            self.log_test("Long/Short Balance", "FAIL", f"Error: {str(e)}")
            return False

    async def test_contrarian_bot_logic(self, run_id: str) -> bool:
        """Test 4: Test contrarian bot logic scenarios"""
        try:
            print("\n🧠 TESTING CONTRARIAN BOT LOGIC")
            print("=" * 60)
            
            # Get recommendations to find coins with high RSI or other contrarian signals
            async with self.session.get(f"{API_BASE}/recommendations/top5?run_id={run_id}") as response:
                if response.status != 200:
                    self.log_test("Contrarian Bot Logic", "FAIL", 
                                 f"Failed to get recommendations: HTTP {response.status}")
                    return False
                
                data = await response.json()
                recommendations = data.get('recommendations', [])
                
                if not recommendations:
                    self.log_test("Contrarian Bot Logic", "FAIL", "No recommendations found")
                    return False
                
                # Look for contrarian signals in bot details
                contrarian_signals_found = 0
                logic_tests_passed = 0
                
                for rec in recommendations[:5]:  # Check first 5 coins
                    coin_symbol = rec.get('ticker')
                    if not coin_symbol:
                        continue
                    
                    url = f"{API_BASE}/recommendations/{run_id}/{coin_symbol}/bot_details"
                    
                    async with self.session.get(url) as response:
                        if response.status == 200:
                            bot_data = await response.json()
                            bot_results = bot_data.get('bot_results', [])
                            
                            # Check contrarian bot logic
                            for bot in bot_results:
                                bot_name = bot.get('bot_name', '')
                                direction = bot.get('direction', '').lower()
                                confidence = bot.get('confidence', 0)
                                
                                if bot_name == "RSI_ReversalBot":
                                    contrarian_signals_found += 1
                                    # RSI Reversal should give SHORT signals for overbought conditions
                                    if direction == 'short' and confidence > 5:
                                        logic_tests_passed += 1
                                        print(f"✓ RSI_ReversalBot: {coin_symbol} → SHORT (confidence: {confidence})")
                                    elif direction == 'long' and confidence > 5:
                                        print(f"ℹ RSI_ReversalBot: {coin_symbol} → LONG (confidence: {confidence})")
                                
                                elif bot_name == "BollingerReversalBot":
                                    contrarian_signals_found += 1
                                    if direction == 'short' and confidence > 5:
                                        logic_tests_passed += 1
                                        print(f"✓ BollingerReversalBot: {coin_symbol} → SHORT (confidence: {confidence})")
                                    elif direction == 'long' and confidence > 5:
                                        print(f"ℹ BollingerReversalBot: {coin_symbol} → LONG (confidence: {confidence})")
                                
                                elif bot_name == "MeanReversionBot":
                                    contrarian_signals_found += 1
                                    if direction == 'short' and confidence > 5:
                                        logic_tests_passed += 1
                                        print(f"✓ MeanReversionBot: {coin_symbol} → SHORT (confidence: {confidence})")
                                    elif direction == 'long' and confidence > 5:
                                        print(f"ℹ MeanReversionBot: {coin_symbol} → LONG (confidence: {confidence})")
                
                if contrarian_signals_found == 0:
                    self.log_test("Contrarian Bot Logic", "FAIL", "No contrarian bot signals found")
                    return False
                elif logic_tests_passed > 0:
                    self.log_test("Contrarian Bot Logic", "PASS", 
                                 f"Found {logic_tests_passed} contrarian SHORT signals out of {contrarian_signals_found} contrarian bot results")
                    return True
                else:
                    self.log_test("Contrarian Bot Logic", "PARTIAL", 
                                 f"Found {contrarian_signals_found} contrarian bot results but no SHORT signals")
                    return False
                    
        except Exception as e:
            self.log_test("Contrarian Bot Logic", "FAIL", f"Error: {str(e)}")
            return False

    async def test_stochastic_reversal_bot_field_fix(self, run_id: str) -> bool:
        """Test 5: Test StochasticReversalBot field fix ('stochastic' → 'stoch_k')"""
        try:
            print("\n📊 TESTING STOCHASTIC REVERSAL BOT FIELD FIX")
            print("=" * 60)
            
            # Get recommendations to find StochasticReversalBot results
            async with self.session.get(f"{API_BASE}/recommendations/top5?run_id={run_id}") as response:
                if response.status != 200:
                    self.log_test("StochasticReversalBot Field Fix", "FAIL", 
                                 f"Failed to get recommendations: HTTP {response.status}")
                    return False
                
                data = await response.json()
                recommendations = data.get('recommendations', [])
                
                if not recommendations:
                    self.log_test("StochasticReversalBot Field Fix", "FAIL", "No recommendations found")
                    return False
                
                # Look for StochasticReversalBot in bot details
                stochastic_bot_found = False
                
                for rec in recommendations[:10]:  # Check first 10 coins
                    coin_symbol = rec.get('ticker')
                    if not coin_symbol:
                        continue
                    
                    url = f"{API_BASE}/recommendations/{run_id}/{coin_symbol}/bot_details"
                    
                    async with self.session.get(url) as response:
                        if response.status == 200:
                            bot_data = await response.json()
                            bot_results = bot_data.get('bot_results', [])
                            
                            # Check for StochasticReversalBot
                            for bot in bot_results:
                                bot_name = bot.get('bot_name', '')
                                if bot_name == "StochasticReversalBot":
                                    stochastic_bot_found = True
                                    confidence = bot.get('confidence', 0)
                                    direction = bot.get('direction', '')
                                    
                                    # If bot is working, it should have valid confidence and direction
                                    if confidence > 0 and direction:
                                        self.log_test("StochasticReversalBot Field Fix", "PASS", 
                                                     f"StochasticReversalBot working for {coin_symbol}: {direction} (confidence: {confidence})")
                                        return True
                                    else:
                                        print(f"⚠ StochasticReversalBot found but no valid signal for {coin_symbol}")
                
                if stochastic_bot_found:
                    self.log_test("StochasticReversalBot Field Fix", "PARTIAL", 
                                 "StochasticReversalBot found but may not be generating strong signals")
                    return True
                else:
                    self.log_test("StochasticReversalBot Field Fix", "FAIL", 
                                 "StochasticReversalBot not found in any bot results")
                    return False
                    
        except Exception as e:
            self.log_test("StochasticReversalBot Field Fix", "FAIL", f"Error: {str(e)}")
            return False

    async def test_volume_spike_fade_bot_triggers(self, run_id: str) -> bool:
        """Test 6: Test VolumeSpikeFadeBot relaxed triggers"""
        try:
            print("\n📈 TESTING VOLUME SPIKE FADE BOT RELAXED TRIGGERS")
            print("=" * 60)
            
            # Get recommendations to find VolumeSpikeFadeBot results
            async with self.session.get(f"{API_BASE}/recommendations/top5?run_id={run_id}") as response:
                if response.status != 200:
                    self.log_test("VolumeSpikeFadeBot Triggers", "FAIL", 
                                 f"Failed to get recommendations: HTTP {response.status}")
                    return False
                
                data = await response.json()
                recommendations = data.get('recommendations', [])
                
                if not recommendations:
                    self.log_test("VolumeSpikeFadeBot Triggers", "FAIL", "No recommendations found")
                    return False
                
                # Look for VolumeSpikeFadeBot in bot details
                volume_bot_found = False
                volume_bot_signals = 0
                
                for rec in recommendations[:10]:  # Check first 10 coins
                    coin_symbol = rec.get('ticker')
                    if not coin_symbol:
                        continue
                    
                    url = f"{API_BASE}/recommendations/{run_id}/{coin_symbol}/bot_details"
                    
                    async with self.session.get(url) as response:
                        if response.status == 200:
                            bot_data = await response.json()
                            bot_results = bot_data.get('bot_results', [])
                            
                            # Check for VolumeSpikeFadeBot
                            for bot in bot_results:
                                bot_name = bot.get('bot_name', '')
                                if bot_name == "VolumeSpikeFadeBot":
                                    volume_bot_found = True
                                    confidence = bot.get('confidence', 0)
                                    direction = bot.get('direction', '')
                                    
                                    # Count valid signals
                                    if confidence > 0 and direction:
                                        volume_bot_signals += 1
                                        print(f"✓ VolumeSpikeFadeBot signal: {coin_symbol} → {direction} (confidence: {confidence})")
                
                if not volume_bot_found:
                    self.log_test("VolumeSpikeFadeBot Triggers", "FAIL", 
                                 "VolumeSpikeFadeBot not found in any bot results")
                    return False
                elif volume_bot_signals > 0:
                    self.log_test("VolumeSpikeFadeBot Triggers", "PASS", 
                                 f"VolumeSpikeFadeBot generating {volume_bot_signals} signals (relaxed triggers working)")
                    return True
                else:
                    self.log_test("VolumeSpikeFadeBot Triggers", "PARTIAL", 
                                 "VolumeSpikeFadeBot found but not generating signals (triggers may still be too restrictive)")
                    return False
                    
        except Exception as e:
            self.log_test("VolumeSpikeFadeBot Triggers", "FAIL", f"Error: {str(e)}")
            return False

    async def check_backend_logs_for_contrarian_activity(self) -> bool:
        """Check for contrarian bot activity in logs (manual verification)"""
        try:
            print("\n📋 CHECKING BACKEND LOGS FOR CONTRARIAN ACTIVITY")
            print("=" * 60)
            
            # This is a manual verification step since we can't directly access logs
            expected_log_patterns = [
                "RSI_ReversalBot",
                "MeanReversionBot", 
                "BollingerReversalBot",
                "StochasticReversalBot",
                "VolumeSpikeFadeBot",
                "SHORT prediction",
                "contrarian signal"
            ]
            
            self.log_test("Backend Logs Check", "MANUAL", 
                         f"Manual verification required: Check backend logs for patterns: {', '.join(expected_log_patterns)}")
            
            return True
            
        except Exception as e:
            self.log_test("Backend Logs Check", "FAIL", f"Error: {str(e)}")
            return False

    async def run_comprehensive_phase3_test(self):
        """Run comprehensive Phase 3 contrarian bots testing"""
        print("=" * 80)
        print("PHASE 3 CONTRARIAN BOTS TESTING - JSON SERIALIZATION & BOT PARTICIPATION")
        print("=" * 80)
        print(f"Testing API: {API_BASE}")
        print()
        print("Critical Test Cases:")
        print("1. JSON Serialization Fix (no 500 errors)")
        print("2. Contrarian Bot Participation (bots appear in results)")
        print("3. Long/Short Balance (some SHORT predictions)")
        print("4. Contrarian Bot Logic (HIGH RSI → SHORT)")
        print("5. StochasticReversalBot Field Fix ('stoch_k' field)")
        print("6. VolumeSpikeFadeBot Relaxed Triggers (1.5x volume vs 2x)")
        print()
        
        # Test 0: Health Check
        if not await self.test_health_check():
            print("❌ API health check failed - aborting tests")
            return
        
        # Test 1: JSON Serialization Fix
        await self.test_json_serialization_fix()
        
        # Run a test scan to get fresh data
        print("\n🚀 RUNNING TEST SCAN FOR CONTRARIAN BOT ANALYSIS")
        print("=" * 60)
        
        # Use a focused scan with 10-20 coins as requested
        scan_params = {
            "scope": "all",
            "scan_type": "quick_scan",  # Should analyze ~45 coins
            "min_price": 1,
            "max_price": 100
        }
        
        run_id = await self.run_test_scan(scan_params)
        
        if not run_id:
            print("❌ Test scan failed - cannot test contrarian bot participation")
            await self.print_test_summary()
            return
        
        # Test 2: Contrarian Bot Participation
        await self.test_contrarian_bot_participation(run_id)
        
        # Test 3: Long/Short Balance
        await self.test_long_short_balance(run_id)
        
        # Test 4: Contrarian Bot Logic
        await self.test_contrarian_bot_logic(run_id)
        
        # Test 5: StochasticReversalBot Field Fix
        await self.test_stochastic_reversal_bot_field_fix(run_id)
        
        # Test 6: VolumeSpikeFadeBot Relaxed Triggers
        await self.test_volume_spike_fade_bot_triggers(run_id)
        
        # Test 7: Backend Logs Check (manual)
        await self.check_backend_logs_for_contrarian_activity()
        
        # Print comprehensive summary
        await self.print_test_summary()

    async def print_test_summary(self):
        """Print comprehensive test summary"""
        print()
        print("=" * 80)
        print("PHASE 3 CONTRARIAN BOTS TEST SUMMARY")
        print("=" * 80)
        
        # Categorize results
        critical_tests = []
        high_priority_tests = []
        other_tests = []
        
        for result in self.test_results:
            test_name = result['test']
            if any(keyword in test_name for keyword in ['JSON Serialization', 'Contrarian Bot Participation']):
                critical_tests.append(result)
            elif any(keyword in test_name for keyword in ['Long/Short Balance', 'Bot Logic', 'Field Fix', 'Triggers']):
                high_priority_tests.append(result)
            else:
                other_tests.append(result)
        
        # Print results by priority
        def print_test_category(tests, category_name):
            if not tests:
                return
            print(f"\n{category_name}:")
            for result in tests:
                if result['status'] == 'PASS':
                    status_icon = "✅"
                elif result['status'] == 'FAIL':
                    status_icon = "❌"
                elif result['status'] == 'PARTIAL':
                    status_icon = "⚠️"
                else:
                    status_icon = "ℹ️"
                print(f"{status_icon} {result['test']}: {result['details']}")
        
        print_test_category(critical_tests, "🔥 CRITICAL TESTS")
        print_test_category(high_priority_tests, "🎯 HIGH PRIORITY TESTS")
        print_test_category(other_tests, "📋 OTHER TESTS")
        
        # Calculate statistics
        total_tests = len(self.test_results)
        passed = sum(1 for result in self.test_results if result['status'] == 'PASS')
        failed = sum(1 for result in self.test_results if result['status'] == 'FAIL')
        partial = sum(1 for result in self.test_results if result['status'] == 'PARTIAL')
        manual = sum(1 for result in self.test_results if result['status'] == 'MANUAL')
        
        print(f"\n📊 TEST STATISTICS:")
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed}")
        print(f"Partial: {partial}")
        print(f"Failed: {failed}")
        print(f"Manual: {manual}")
        
        # Calculate success rate (PASS + PARTIAL as success)
        success_rate = ((passed + partial) / total_tests * 100) if total_tests > 0 else 0
        print(f"Success Rate: {success_rate:.1f}%")
        
        # Determine overall status
        critical_failed = sum(1 for result in critical_tests if result['status'] == 'FAIL')
        high_priority_failed = sum(1 for result in high_priority_tests if result['status'] == 'FAIL')
        
        print(f"\n🎯 PHASE 3 STATUS:")
        if critical_failed == 0 and high_priority_failed <= 1:
            print("✅ PHASE 3 FIXES WORKING - Contrarian bots operational")
        elif critical_failed == 0:
            print("⚠️ PHASE 3 PARTIALLY WORKING - Critical fixes done, some issues remain")
        else:
            print("❌ PHASE 3 ISSUES REMAIN - Critical fixes needed")
        
        print(f"\n📋 NEXT STEPS:")
        if failed > 0:
            print("1. Review failed tests and fix underlying issues")
            print("2. Check backend logs for error details")
            print("3. Verify contrarian bot implementations")
            print("4. Test again after fixes")
        else:
            print("1. All tests passed - Phase 3 fixes are working correctly")
            print("2. Monitor contrarian bot activity in production")
            print("3. Verify long/short balance improves over time")

async def main():
    """Main test execution"""
    async with Phase3ContrariansTestSuite() as test_suite:
        await test_suite.run_comprehensive_phase3_test()

if __name__ == "__main__":
    asyncio.run(main())