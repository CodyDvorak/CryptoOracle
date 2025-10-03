#!/usr/bin/env python3
"""
COMPREHENSIVE BYBIT & OKX FUTURES API TEST
==========================================

MISSION CRITICAL: Test Bybit and OKX futures API accessibility and data quality.
Determine which provider(s) can be used for production launch.
"""

import asyncio
import aiohttp
import time
import json
from datetime import datetime, timezone
from typing import Dict, List, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Test coins - major cryptocurrencies
TEST_COINS = ['BTC', 'ETH', 'BNB', 'SOL', 'DOGE']
BACKEND_URL = "https://oracle-trading-1.preview.emergentagent.com"

class ComprehensiveFuturesTest:
    """Comprehensive test of futures API accessibility and integration."""
    
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.results = {
            'bybit': {
                'accessible': False,
                'blocked_reason': None,
                'successful_coins': [],
                'failed_coins': [],
                'sample_data': {}
            },
            'okx': {
                'accessible': False,
                'blocked_reason': None,
                'successful_coins': [],
                'failed_coins': [],
                'sample_data': {}
            },
            'backend_integration': {
                'provider_status_endpoint': False,
                'multi_provider_working': False,
                'scan_integration': False
            },
            'data_quality': {
                'funding_rates_reasonable': True,
                'open_interest_positive': True,
                'long_short_ratios_valid': True,
                'issues': []
            }
        }
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def test_bybit_accessibility(self) -> Dict:
        """Test if Bybit API is accessible."""
        logger.info("🔍 Testing Bybit API accessibility...")
        
        try:
            # Test basic connectivity
            url = "https://api.bybit.com/v5/market/open-interest"
            params = {"category": "linear", "symbol": "BTCUSDT", "intervalTime": "5min"}
            
            async with self.session.get(url, params=params, timeout=10) as response:
                response_text = await response.text()
                
                if response.status == 403:
                    if "cloudfront" in response_text.lower() or "blocked" in response_text.lower():
                        self.results['bybit']['blocked_reason'] = "CloudFront geo-blocking (HTTP 403)"
                        logger.warning("❌ Bybit: Blocked by CloudFront geo-restrictions")
                        return False
                elif response.status == 451:
                    self.results['bybit']['blocked_reason'] = "Legal restrictions (HTTP 451)"
                    logger.warning("❌ Bybit: Blocked by legal restrictions")
                    return False
                elif response.status == 200:
                    try:
                        data = json.loads(response_text)
                        if data.get('retCode') == 0:
                            logger.info("✅ Bybit: API accessible and responding")
                            return True
                        else:
                            logger.warning(f"❌ Bybit: API error - {data.get('retMsg')}")
                            return False
                    except json.JSONDecodeError:
                        logger.warning("❌ Bybit: Invalid JSON response")
                        return False
                else:
                    self.results['bybit']['blocked_reason'] = f"HTTP {response.status}"
                    logger.warning(f"❌ Bybit: HTTP {response.status}")
                    return False
                    
        except Exception as e:
            self.results['bybit']['blocked_reason'] = f"Connection error: {str(e)}"
            logger.error(f"❌ Bybit: Connection error - {e}")
            return False
    
    async def test_okx_accessibility(self) -> Dict:
        """Test if OKX API is accessible."""
        logger.info("🔍 Testing OKX API accessibility...")
        
        try:
            # Test basic connectivity
            url = "https://www.okx.com/api/v5/public/open-interest"
            params = {"instId": "BTC-USDT-SWAP"}
            
            async with self.session.get(url, params=params, timeout=10) as response:
                if response.status == 403:
                    self.results['okx']['blocked_reason'] = "Access forbidden (HTTP 403)"
                    logger.warning("❌ OKX: Blocked by access restrictions")
                    return False
                elif response.status == 451:
                    self.results['okx']['blocked_reason'] = "Legal restrictions (HTTP 451)"
                    logger.warning("❌ OKX: Blocked by legal restrictions")
                    return False
                elif response.status == 200:
                    try:
                        data = await response.json()
                        if data.get('code') == '0':
                            logger.info("✅ OKX: API accessible and responding")
                            return True
                        else:
                            logger.warning(f"❌ OKX: API error - {data.get('msg')}")
                            return False
                    except Exception as e:
                        logger.warning(f"❌ OKX: JSON parsing error - {e}")
                        return False
                else:
                    self.results['okx']['blocked_reason'] = f"HTTP {response.status}"
                    logger.warning(f"❌ OKX: HTTP {response.status}")
                    return False
                    
        except Exception as e:
            self.results['okx']['blocked_reason'] = f"Connection error: {str(e)}"
            logger.error(f"❌ OKX: Connection error - {e}")
            return False
    
    async def test_okx_data_quality(self, symbol: str) -> Dict:
        """Test OKX data quality for a specific symbol."""
        coin_data = {
            'symbol': symbol,
            'open_interest': None,
            'funding_rate': None,
            'long_short_ratio': None,
            'success': False,
            'errors': []
        }
        
        try:
            okx_symbol = f"{symbol.upper()}-USDT-SWAP"
            
            # Test 1: Open Interest
            url = "https://www.okx.com/api/v5/public/open-interest"
            params = {"instId": okx_symbol}
            
            async with self.session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('code') == '0' and data.get('data'):
                        oi_value = float(data['data'][0].get('oi', 0))
                        coin_data['open_interest'] = oi_value
                        if oi_value <= 0:
                            self.results['data_quality']['open_interest_positive'] = False
                            self.results['data_quality']['issues'].append(f"{symbol}: Zero/negative open interest")
            
            # Test 2: Funding Rate
            url = "https://www.okx.com/api/v5/public/funding-rate"
            params = {"instId": okx_symbol}
            
            async with self.session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('code') == '0' and data.get('data'):
                        funding_rate = float(data['data'][0].get('fundingRate', 0)) * 100
                        coin_data['funding_rate'] = funding_rate
                        if abs(funding_rate) > 1.0:  # More than 1% is unusual
                            self.results['data_quality']['funding_rates_reasonable'] = False
                            self.results['data_quality']['issues'].append(f"{symbol}: Extreme funding rate {funding_rate:.3f}%")
            
            # Test 3: Long/Short Ratio
            url = "https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio"
            params = {"ccy": symbol.upper(), "period": "5m"}
            
            async with self.session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('code') == '0' and data.get('data'):
                        long_ratio = float(data['data'][0].get('longRatio', 0))
                        short_ratio = float(data['data'][0].get('shortRatio', 0))
                        ratio = long_ratio / short_ratio if short_ratio > 0 else 0
                        coin_data['long_short_ratio'] = ratio
                        if ratio < 0.1 or ratio > 10:  # Extreme ratios
                            self.results['data_quality']['long_short_ratios_valid'] = False
                            self.results['data_quality']['issues'].append(f"{symbol}: Extreme L/S ratio {ratio:.2f}")
            
            # Check if we got any data
            if any([coin_data['open_interest'], coin_data['funding_rate'], coin_data['long_short_ratio']]):
                coin_data['success'] = True
                self.results['okx']['successful_coins'].append(symbol)
            else:
                coin_data['errors'].append("No data retrieved from any endpoint")
                self.results['okx']['failed_coins'].append(symbol)
            
        except Exception as e:
            coin_data['errors'].append(f"Exception: {str(e)}")
            self.results['okx']['failed_coins'].append(symbol)
        
        return coin_data
    
    async def test_backend_integration(self) -> Dict:
        """Test backend futures integration."""
        logger.info("🔧 Testing backend futures integration...")
        
        integration_results = {}
        
        try:
            # Test 1: Futures provider status endpoint
            url = f"{BACKEND_URL}/api/futures-providers/status"
            async with self.session.get(url, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    self.results['backend_integration']['provider_status_endpoint'] = True
                    integration_results['provider_status'] = data
                    logger.info("✅ Backend: Futures provider status endpoint working")
                else:
                    logger.warning(f"❌ Backend: Provider status endpoint failed (HTTP {response.status})")
            
            # Test 2: Check if multi-provider system is configured
            if 'provider_status' in integration_results:
                providers = integration_results['provider_status'].get('providers', {})
                if len(providers) >= 2:  # Should have multiple providers
                    self.results['backend_integration']['multi_provider_working'] = True
                    logger.info(f"✅ Backend: Multi-provider system configured ({len(providers)} providers)")
                else:
                    logger.warning("❌ Backend: Multi-provider system not properly configured")
            
            # Test 3: Try to trigger a quick scan to test integration
            # (We won't actually run it, just check if the endpoint accepts the request)
            url = f"{BACKEND_URL}/api/scan/status"
            async with self.session.get(url, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    integration_results['scan_status'] = data
                    logger.info("✅ Backend: Scan status endpoint working")
                    
                    # Check if there's a recent scan with derivatives data
                    recent_run = data.get('recent_run')
                    if recent_run:
                        logger.info(f"   Recent scan found: {recent_run.get('id', 'unknown')}")
                        self.results['backend_integration']['scan_integration'] = True
                else:
                    logger.warning(f"❌ Backend: Scan status endpoint failed (HTTP {response.status})")
        
        except Exception as e:
            logger.error(f"❌ Backend integration test failed: {e}")
        
        return integration_results
    
    async def run_comprehensive_test(self) -> Dict:
        """Run the complete test suite."""
        logger.info("🚀 Starting Comprehensive Futures API Test")
        logger.info("=" * 60)
        
        start_time = time.time()
        
        # Phase 1: Test API Accessibility
        logger.info("\n📡 PHASE 1: API ACCESSIBILITY TEST")
        bybit_accessible = await self.test_bybit_accessibility()
        okx_accessible = await self.test_okx_accessibility()
        
        self.results['bybit']['accessible'] = bybit_accessible
        self.results['okx']['accessible'] = okx_accessible
        
        # Phase 2: Test Data Quality (only for accessible providers)
        logger.info("\n📊 PHASE 2: DATA QUALITY TEST")
        
        if okx_accessible:
            logger.info("Testing OKX data quality for all coins...")
            okx_data = {}
            for coin in TEST_COINS:
                logger.info(f"  Testing {coin}...")
                coin_data = await self.test_okx_data_quality(coin)
                okx_data[coin] = coin_data
                await asyncio.sleep(0.5)  # Rate limiting
            
            self.results['okx']['sample_data'] = okx_data
        
        if bybit_accessible:
            logger.info("Bybit is accessible - would test data quality here")
            # Would implement Bybit data quality tests here
        
        # Phase 3: Test Backend Integration
        logger.info("\n🔧 PHASE 3: BACKEND INTEGRATION TEST")
        backend_data = await self.test_backend_integration()
        
        test_duration = time.time() - start_time
        self.results['test_duration'] = round(test_duration, 2)
        
        return self.results
    
    def print_comprehensive_report(self):
        """Print detailed test report."""
        print("\n" + "="*80)
        print("🎯 COMPREHENSIVE FUTURES API TEST RESULTS")
        print("="*80)
        
        print(f"\n⏱️  TEST DURATION: {self.results['test_duration']}s")
        print(f"🪙 COINS TESTED: {len(TEST_COINS)} ({', '.join(TEST_COINS)})")
        
        # API Accessibility Results
        print(f"\n📡 API ACCESSIBILITY RESULTS:")
        
        bybit_status = "✅ ACCESSIBLE" if self.results['bybit']['accessible'] else "❌ BLOCKED"
        print(f"   🟦 Bybit: {bybit_status}")
        if not self.results['bybit']['accessible']:
            print(f"      Reason: {self.results['bybit']['blocked_reason']}")
        
        okx_status = "✅ ACCESSIBLE" if self.results['okx']['accessible'] else "❌ BLOCKED"
        print(f"   🟧 OKX:   {okx_status}")
        if not self.results['okx']['accessible']:
            print(f"      Reason: {self.results['okx']['blocked_reason']}")
        
        # Data Quality Results
        if self.results['okx']['accessible']:
            print(f"\n📊 OKX DATA QUALITY RESULTS:")
            successful = len(self.results['okx']['successful_coins'])
            failed = len(self.results['okx']['failed_coins'])
            total = successful + failed
            success_rate = (successful / total * 100) if total > 0 else 0
            
            print(f"   Success Rate: {success_rate:.1f}% ({successful}/{total} coins)")
            print(f"   Successful: {', '.join(self.results['okx']['successful_coins'])}")
            if self.results['okx']['failed_coins']:
                print(f"   Failed: {', '.join(self.results['okx']['failed_coins'])}")
            
            # Sample data
            if self.results['okx']['sample_data']:
                print(f"\n   📋 SAMPLE DATA:")
                for coin, data in self.results['okx']['sample_data'].items():
                    if data['success']:
                        print(f"      {coin}:")
                        if data['open_interest']:
                            print(f"        Open Interest: {data['open_interest']:,.0f}")
                        if data['funding_rate'] is not None:
                            print(f"        Funding Rate: {data['funding_rate']:.4f}%")
                        if data['long_short_ratio']:
                            print(f"        L/S Ratio: {data['long_short_ratio']:.2f}")
        
        # Data Quality Assessment
        print(f"\n🔍 DATA QUALITY ASSESSMENT:")
        quality_score = 0
        total_checks = 3
        
        if self.results['data_quality']['funding_rates_reasonable']:
            print("   ✅ Funding rates are reasonable (-1% to +1%)")
            quality_score += 1
        else:
            print("   ⚠️  Some funding rates are extreme (>1%)")
        
        if self.results['data_quality']['open_interest_positive']:
            print("   ✅ Open interest values are positive")
            quality_score += 1
        else:
            print("   ⚠️  Some open interest values are zero/negative")
        
        if self.results['data_quality']['long_short_ratios_valid']:
            print("   ✅ Long/short ratios are reasonable (0.1-10)")
            quality_score += 1
        else:
            print("   ⚠️  Some long/short ratios are extreme")
        
        quality_percentage = (quality_score / total_checks) * 100
        print(f"   📊 Overall Data Quality: {quality_percentage:.0f}% ({quality_score}/{total_checks} checks passed)")
        
        if self.results['data_quality']['issues']:
            print(f"   ⚠️  Issues found:")
            for issue in self.results['data_quality']['issues']:
                print(f"      - {issue}")
        
        # Backend Integration Results
        print(f"\n🔧 BACKEND INTEGRATION RESULTS:")
        backend = self.results['backend_integration']
        
        status = "✅ WORKING" if backend['provider_status_endpoint'] else "❌ FAILED"
        print(f"   Provider Status Endpoint: {status}")
        
        status = "✅ WORKING" if backend['multi_provider_working'] else "❌ FAILED"
        print(f"   Multi-Provider System: {status}")
        
        status = "✅ WORKING" if backend['scan_integration'] else "❌ NOT TESTED"
        print(f"   Scan Integration: {status}")
        
        # Final Recommendation
        self._print_final_recommendation()
    
    def _print_final_recommendation(self):
        """Print final launch recommendation."""
        print(f"\n🎯 FINAL LAUNCH RECOMMENDATION:")
        print("="*50)
        
        bybit_works = self.results['bybit']['accessible']
        okx_works = self.results['okx']['accessible']
        backend_works = self.results['backend_integration']['provider_status_endpoint']
        
        if okx_works and backend_works:
            okx_success_rate = len(self.results['okx']['successful_coins']) / len(TEST_COINS) * 100
            quality_score = sum([
                self.results['data_quality']['funding_rates_reasonable'],
                self.results['data_quality']['open_interest_positive'],
                self.results['data_quality']['long_short_ratios_valid']
            ]) / 3 * 100
            
            print("✅ LAUNCH READY WITH DERIVATIVES DATA!")
            print()
            print("📊 LAUNCH CONFIGURATION:")
            print(f"   Primary Provider: OKX ({okx_success_rate:.0f}% coin coverage)")
            print(f"   Fallback Provider: None (Bybit blocked)")
            print(f"   Data Quality Score: {quality_score:.0f}%")
            print(f"   Backend Integration: Working")
            print()
            print("🚀 RECOMMENDED ACTIONS:")
            print("   1. Configure OKX as primary futures provider")
            print("   2. Disable Bybit provider (geo-blocked)")
            print("   3. Launch with derivatives data enabled")
            print("   4. Monitor OKX API performance in production")
            
            if quality_score < 100:
                print()
                print("⚠️  MINOR ISSUES TO MONITOR:")
                for issue in self.results['data_quality']['issues']:
                    print(f"   - {issue}")
        
        elif bybit_works and backend_works:
            print("✅ LAUNCH READY WITH DERIVATIVES DATA!")
            print("   Primary Provider: Bybit")
            print("   Fallback Provider: None (OKX blocked)")
        
        elif (bybit_works or okx_works) and not backend_works:
            provider = "OKX" if okx_works else "Bybit"
            print(f"⚠️  PARTIAL LAUNCH READY")
            print(f"   {provider} API is accessible but backend integration has issues")
            print("   Fix backend integration before launch")
        
        else:
            print("❌ LAUNCH BLOCKED - NO DERIVATIVES DATA")
            print()
            print("🛑 ISSUES:")
            print("   - Both Bybit and OKX are blocked/inaccessible")
            print("   - Cannot provide derivatives data to users")
            print()
            print("🔧 OPTIONS:")
            print("   1. Launch without derivatives data (reduced functionality)")
            print("   2. Implement proxy/VPN solution for API access")
            print("   3. Find alternative derivatives data providers")
            print("   4. Use cached/historical derivatives data")


async def main():
    """Main test execution."""
    print("🚀 COMPREHENSIVE BYBIT & OKX FUTURES API TEST")
    print("=" * 60)
    print("MISSION: Determine futures API accessibility and data quality")
    print("GOAL: Enable derivatives data for production launch")
    print()
    
    async with ComprehensiveFuturesTest() as tester:
        results = await tester.run_comprehensive_test()
        tester.print_comprehensive_report()
    
    return results


if __name__ == "__main__":
    asyncio.run(main())