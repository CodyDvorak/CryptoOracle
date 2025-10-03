#!/usr/bin/env python3
"""
Corrected Contrarian Bots Testing Script for Crypto Oracle - Phase 3 Improvements
Tests the 5 new contrarian/reversal bots with correct field names
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

class ContrarianBotsTestSuite:
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

    async def test_contrarian_bot_logic_corrected(self) -> bool:
        """Test contrarian bot logic with correct field names"""
        try:
            # Import bot strategies to test logic directly
            import sys
            sys.path.append('/app/backend')
            from bots.bot_strategies import (
                RSI_ReversalBot, MeanReversionBot, BollingerReversalBot,
                StochasticReversalBot, VolumeSpikeFadeBot
            )
            
            test_results = []
            
            # Test 1: RSI_ReversalBot - High RSI (>70) should predict SHORT
            rsi_bot = RSI_ReversalBot()
            high_rsi_features = {
                'rsi_14': 75,  # Overbought
                'current_price': 50000,
                'sentiment_score': 5,
                'atr_14': 1000
            }
            
            result = rsi_bot.analyze(high_rsi_features)
            if result and result.get('direction') == 'short':
                test_results.append("✅ RSI_ReversalBot: HIGH RSI → SHORT signal")
            else:
                test_results.append(f"❌ RSI_ReversalBot: HIGH RSI → {result.get('direction') if result else 'None'} (expected SHORT)")
            
            # Test 2: RSI_ReversalBot - Low RSI (<30) should predict LONG
            low_rsi_features = {
                'rsi_14': 25,  # Oversold
                'current_price': 50000,
                'sentiment_score': 5,
                'atr_14': 1000
            }
            
            result = rsi_bot.analyze(low_rsi_features)
            if result and result.get('direction') == 'long':
                test_results.append("✅ RSI_ReversalBot: LOW RSI → LONG signal")
            else:
                test_results.append(f"❌ RSI_ReversalBot: LOW RSI → {result.get('direction') if result else 'None'} (expected LONG)")
            
            # Test 3: BollingerReversalBot - Price at upper band should predict SHORT
            bb_bot = BollingerReversalBot()
            upper_band_features = {
                'bollinger_upper': 52000,  # Correct field name
                'bollinger_lower': 48000,  # Correct field name
                'sma_20': 50000,
                'current_price': 52000,  # At upper band
                'rsi_14': 65,  # High RSI
                'atr_14': 1000
            }
            
            result = bb_bot.analyze(upper_band_features)
            if result and result.get('direction') == 'short':
                test_results.append("✅ BollingerReversalBot: UPPER BAND → SHORT signal")
            else:
                test_results.append(f"❌ BollingerReversalBot: UPPER BAND → {result.get('direction') if result else 'None'} (expected SHORT)")
            
            # Test 4: BollingerReversalBot - Price at lower band should predict LONG
            lower_band_features = {
                'bollinger_upper': 52000,  # Correct field name
                'bollinger_lower': 48000,  # Correct field name
                'sma_20': 50000,
                'current_price': 48000,  # At lower band
                'rsi_14': 35,  # Low RSI
                'atr_14': 1000
            }
            
            result = bb_bot.analyze(lower_band_features)
            if result and result.get('direction') == 'long':
                test_results.append("✅ BollingerReversalBot: LOWER BAND → LONG signal")
            else:
                test_results.append(f"❌ BollingerReversalBot: LOWER BAND → {result.get('direction') if result else 'None'} (expected LONG)")
            
            # Test 5: MeanReversionBot - Extreme move should fade
            mean_reversion_bot = MeanReversionBot()
            extreme_move_features = {
                'sma_20': 50000,
                'current_price': 53000,  # 6% above SMA (extreme)
                'bollinger_upper': 52500,  # Correct field name
                'bollinger_lower': 47500,  # Correct field name
                'atr_14': 1000
            }
            
            result = mean_reversion_bot.analyze(extreme_move_features)
            if result and result.get('direction') == 'short':
                test_results.append("✅ MeanReversionBot: EXTREME UP MOVE → SHORT signal (fade)")
            else:
                test_results.append(f"❌ MeanReversionBot: EXTREME UP MOVE → {result.get('direction') if result else 'None'} (expected SHORT)")
            
            # Test 6: StochasticReversalBot - High Stochastic should predict SHORT
            stoch_bot = StochasticReversalBot()
            high_stoch_features = {
                'stoch_k': 85,  # Overbought
                'stoch_d': 82,
                'current_price': 50000,
                'atr_14': 1000
            }
            
            result = stoch_bot.analyze(high_stoch_features)
            if result and result.get('direction') == 'short':
                test_results.append("✅ StochasticReversalBot: HIGH STOCH → SHORT signal")
            else:
                test_results.append(f"❌ StochasticReversalBot: HIGH STOCH → {result.get('direction') if result else 'None'} (expected SHORT)")
            
            # Test 7: VolumeSpikeFadeBot - Volume spike should fade
            volume_bot = VolumeSpikeFadeBot()
            volume_spike_features = {
                'volume': 1000000,
                'volume_sma_20': 200000,  # 5x volume spike
                'current_price': 50000,
                'price_change_24h': 8,  # Strong up move
                'atr_14': 1000
            }
            
            result = volume_bot.analyze(volume_spike_features)
            if result and result.get('direction') == 'short':
                test_results.append("✅ VolumeSpikeFadeBot: VOLUME SPIKE UP → SHORT signal (fade)")
            else:
                test_results.append(f"❌ VolumeSpikeFadeBot: VOLUME SPIKE UP → {result.get('direction') if result else 'None'} (expected SHORT)")
            
            # Count successful tests
            passed_tests = sum(1 for test in test_results if test.startswith("✅"))
            total_tests = len(test_results)
            
            details = f"Contrarian logic tests: {passed_tests}/{total_tests} passed\n" + "\n".join(test_results)
            
            if passed_tests == total_tests:
                self.log_test("Contrarian Bot Logic (Corrected)", "PASS", details)
                return True
            elif passed_tests >= total_tests * 0.8:  # 80% pass rate
                self.log_test("Contrarian Bot Logic (Corrected)", "PARTIAL", details)
                return True
            else:
                self.log_test("Contrarian Bot Logic (Corrected)", "FAIL", details)
                return False
                
        except Exception as e:
            self.log_test("Contrarian Bot Logic (Corrected)", "FAIL", f"Error: {str(e)}")
            return False

    async def test_bot_count_54_total(self) -> bool:
        """Test that bot count is now 54 total (was 49, added 5 contrarian bots)"""
        try:
            async with self.session.get(f"{API_BASE}/bots/status") as response:
                if response.status != 200:
                    self.log_test("Bot Count Test", "FAIL", f"HTTP {response.status}")
                    return False
                
                data = await response.json()
                total_bots = data.get('total', 0)
                bots_list = data.get('bots', [])
                
                if total_bots != 54:
                    self.log_test("Bot Count Test", "FAIL", 
                                 f"Expected 54 total bots, got {total_bots}")
                    return False
                
                # Check that all 5 contrarian bots are present
                bot_names = [bot.get('bot_name', '') for bot in bots_list]
                missing_contrarian_bots = []
                
                for contrarian_bot in self.contrarian_bots:
                    if contrarian_bot not in bot_names:
                        missing_contrarian_bots.append(contrarian_bot)
                
                if missing_contrarian_bots:
                    self.log_test("Bot Count Test", "FAIL", 
                                 f"Missing contrarian bots: {missing_contrarian_bots}")
                    return False
                
                self.log_test("Bot Count Test", "PASS", 
                             f"Found 54 total bots including all 5 contrarian bots: {', '.join(self.contrarian_bots)}")
                return True
                
        except Exception as e:
            self.log_test("Bot Count Test", "FAIL", f"Error: {str(e)}")
            return False

    async def run_quick_test_scan(self) -> Optional[str]:
        """Run a quick test scan to check for contrarian signals"""
        try:
            # Start scan
            scan_request = {
                "scope": "all",
                "scan_type": "quick_scan",
                "min_price": 1,
                "max_price": 50
            }
            
            async with self.session.post(f"{API_BASE}/scan/run", json=scan_request) as response:
                if response.status != 200:
                    self.log_test("Quick Test Scan Start", "FAIL", f"HTTP {response.status}")
                    return None
                
                scan_data = await response.json()
                self.log_test("Quick Test Scan Start", "PASS", f"Quick test scan started: {scan_data.get('status')}")
            
            # Wait for completion (max 8 minutes)
            max_wait = 480  # 8 minutes
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
                                self.log_test("Quick Test Scan Completion", "PASS", f"Quick test scan completed: {run_id}")
                                return run_id
                            else:
                                self.log_test("Quick Test Scan Completion", "FAIL", "Quick test scan failed or incomplete")
                                return None
                        else:
                            print(f"Quick test scan still running... ({wait_time}s elapsed)")
            
            self.log_test("Quick Test Scan Completion", "FAIL", "Quick test scan timeout after 8 minutes")
            return None
            
        except Exception as e:
            self.log_test("Quick Test Scan Execution", "FAIL", f"Error: {str(e)}")
            return None

    async def analyze_scan_results(self, run_id: str) -> Dict:
        """Analyze scan results for contrarian bot activity"""
        try:
            # Get recommendations
            async with self.session.get(f"{API_BASE}/recommendations/top5?run_id={run_id}") as response:
                if response.status == 404:
                    return {"error": "No recommendations found"}
                elif response.status != 200:
                    return {"error": f"HTTP {response.status}"}
                
                data = await response.json()
                all_recommendations = data.get('recommendations', [])
                
                if not all_recommendations:
                    return {"error": "No recommendations in response"}
                
                # Analyze signals
                short_signals = 0
                long_signals = 0
                contrarian_bot_signals = []
                
                for rec in all_recommendations:
                    direction = rec.get('consensus_direction', '').lower()
                    if direction == 'short':
                        short_signals += 1
                    elif direction == 'long':
                        long_signals += 1
                    
                    # Check bot details for contrarian bot activity
                    coin_symbol = rec.get('ticker')
                    if coin_symbol:
                        try:
                            url = f"{API_BASE}/recommendations/{run_id}/{coin_symbol}/bot_details"
                            async with self.session.get(url) as bot_response:
                                if bot_response.status == 200:
                                    bot_data = await bot_response.json()
                                    bot_results = bot_data.get('bot_results', [])
                                    
                                    for bot_result in bot_results:
                                        bot_name = bot_result.get('bot_name', '')
                                        if bot_name in self.contrarian_bots:
                                            bot_direction = bot_result.get('direction', '')
                                            bot_confidence = bot_result.get('confidence', 0)
                                            contrarian_bot_signals.append({
                                                'coin': coin_symbol,
                                                'bot': bot_name,
                                                'direction': bot_direction,
                                                'confidence': bot_confidence
                                            })
                        except:
                            pass  # Skip if bot details not available
                
                return {
                    'total_recommendations': len(all_recommendations),
                    'short_signals': short_signals,
                    'long_signals': long_signals,
                    'contrarian_bot_signals': contrarian_bot_signals,
                    'short_percentage': (short_signals / (short_signals + long_signals) * 100) if (short_signals + long_signals) > 0 else 0
                }
                
        except Exception as e:
            return {"error": f"Analysis error: {str(e)}"}

    async def run_comprehensive_test(self):
        """Run comprehensive contrarian bots test"""
        print("=" * 80)
        print("CONTRARIAN BOTS COMPREHENSIVE TEST - PHASE 3 IMPROVEMENTS")
        print("=" * 80)
        print(f"Testing API: {API_BASE}")
        print()
        
        # Test 1: Bot Count
        print("📊 Test 1: Bot Count (should be 54 total)...")
        await self.test_bot_count_54_total()
        
        print()
        print("🧠 Test 2: Contrarian Bot Logic (Corrected)...")
        await self.test_contrarian_bot_logic_corrected()
        
        print()
        print("🔍 Test 3: Live Scan Analysis...")
        run_id = await self.run_quick_test_scan()
        
        if run_id:
            print()
            print("📈 Test 4: Analyzing Scan Results for Contrarian Activity...")
            analysis = await self.analyze_scan_results(run_id)
            
            if "error" in analysis:
                self.log_test("Scan Results Analysis", "FAIL", f"Analysis failed: {analysis['error']}")
            else:
                contrarian_signals = analysis.get('contrarian_bot_signals', [])
                short_percentage = analysis.get('short_percentage', 0)
                
                # Count contrarian bot activity by type
                contrarian_activity = {}
                for signal in contrarian_signals:
                    bot_name = signal['bot']
                    if bot_name not in contrarian_activity:
                        contrarian_activity[bot_name] = {'short': 0, 'long': 0}
                    contrarian_activity[bot_name][signal['direction']] += 1
                
                details = f"""Scan Analysis Results:
- Total recommendations: {analysis.get('total_recommendations', 0)}
- SHORT signals: {analysis.get('short_signals', 0)} ({short_percentage:.1f}%)
- LONG signals: {analysis.get('long_signals', 0)}
- Contrarian bot signals: {len(contrarian_signals)}
- Contrarian bot activity: {contrarian_activity}"""
                
                if len(contrarian_signals) > 0:
                    if short_percentage > 0:
                        self.log_test("Scan Results Analysis", "PASS", details)
                    else:
                        self.log_test("Scan Results Analysis", "PARTIAL", 
                                     f"Contrarian bots active but no SHORT consensus. {details}")
                else:
                    self.log_test("Scan Results Analysis", "FAIL", 
                                 f"No contrarian bot activity detected. {details}")
        
        # Print summary
        await self.print_test_summary()

    async def print_test_summary(self):
        """Print comprehensive test summary"""
        print()
        print("=" * 80)
        print("CONTRARIAN BOTS TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if result['status'] == 'PASS')
        failed = sum(1 for result in self.test_results if result['status'] == 'FAIL')
        partial = sum(1 for result in self.test_results if result['status'] == 'PARTIAL')
        
        for result in self.test_results:
            if result['status'] == 'PASS':
                status_icon = "✅"
            elif result['status'] == 'FAIL':
                status_icon = "❌"
            elif result['status'] == 'PARTIAL':
                status_icon = "⚠️"
            else:
                status_icon = "ℹ️"
            print(f"{status_icon} {result['test']}")
        
        print()
        print(f"Total Tests: {len(self.test_results)}")
        print(f"Passed: {passed}")
        print(f"Partial: {partial}")
        print(f"Failed: {failed}")
        
        # Calculate success rate (PASS + PARTIAL as success)
        success_rate = ((passed + partial) / len(self.test_results) * 100) if self.test_results else 0
        print(f"Success Rate: {success_rate:.1f}%")
        
        print()
        print("🎯 CONTRARIAN BOTS STATUS:")
        if success_rate >= 85:
            print("✅ Contrarian bots successfully implemented and working")
        elif success_rate >= 70:
            print("⚠️ Contrarian bots mostly working with some issues")
        else:
            print("❌ Contrarian bots implementation has significant issues")

async def main():
    """Main test execution"""
    async with ContrarianBotsTestSuite() as test_suite:
        await test_suite.run_comprehensive_test()

if __name__ == "__main__":
    asyncio.run(main())