#!/usr/bin/env python3
"""
BYBIT & OKX FUTURES API ACCESSIBILITY TEST
==========================================

MISSION CRITICAL: Test if Bybit or OKX futures APIs are accessible 
(unlike Binance which is blocked with HTTP 451).

This test determines if we can launch with derivatives data.
"""

import asyncio
import aiohttp
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Test coins - major cryptocurrencies
TEST_COINS = ['BTC', 'ETH', 'BNB', 'SOL', 'DOGE']

class FuturesAPITester:
    """Test Bybit and OKX futures API accessibility."""
    
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.results = {
            'bybit': {'accessible': False, 'coins_tested': 0, 'successful_calls': 0, 'failed_calls': 0, 'errors': []},
            'okx': {'accessible': False, 'coins_tested': 0, 'successful_calls': 0, 'failed_calls': 0, 'errors': []},
            'test_summary': {}
        }
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def test_bybit_api(self, symbol: str) -> Dict:
        """Test Bybit API accessibility for a symbol."""
        provider_results = {
            'symbol': symbol,
            'open_interest': None,
            'funding_rate': None,
            'long_short_ratio': None,
            'accessible': False,
            'errors': []
        }
        
        try:
            # Test 1: Open Interest
            bybit_symbol = f"{symbol.upper()}USDT"
            url = 'https://api.bybit.com/v5/market/open-interest'
            params = {'category': 'linear', 'symbol': bybit_symbol, 'intervalTime': '5min'}
            
            async with self.session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('retCode') == 0:
                        result = data.get('result', {})
                        if result and 'list' in result and len(result['list']) > 0:
                            provider_results['open_interest'] = {
                                'status': 'success',
                                'value': float(result['list'][0].get('openInterest', 0))
                            }
                            provider_results['accessible'] = True
                        else:
                            provider_results['open_interest'] = {'status': 'no_data'}
                    else:
                        provider_results['open_interest'] = {'status': 'api_error', 'message': data.get('retMsg')}
                elif response.status == 451:
                    provider_results['errors'].append(f"HTTP 451 - Blocked (like Binance)")
                    provider_results['open_interest'] = {'status': 'blocked'}
                    return provider_results
                else:
                    provider_results['open_interest'] = {'status': 'http_error', 'code': response.status}
            
            # Test 2: Funding Rate
            url = 'https://api.bybit.com/v5/market/tickers'
            params = {'category': 'linear', 'symbol': bybit_symbol}
            
            async with self.session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('retCode') == 0:
                        result = data.get('result', {})
                        if result and 'list' in result and len(result['list']) > 0:
                            ticker = result['list'][0]
                            provider_results['funding_rate'] = {
                                'status': 'success',
                                'value': float(ticker.get('fundingRate', 0)) * 100
                            }
                            provider_results['accessible'] = True
                        else:
                            provider_results['funding_rate'] = {'status': 'no_data'}
                    else:
                        provider_results['funding_rate'] = {'status': 'api_error', 'message': data.get('retMsg')}
                elif response.status == 451:
                    provider_results['errors'].append(f"HTTP 451 - Blocked")
                    provider_results['funding_rate'] = {'status': 'blocked'}
                    return provider_results
                else:
                    provider_results['funding_rate'] = {'status': 'http_error', 'code': response.status}
            
            # Test 3: Long/Short Ratio
            url = 'https://api.bybit.com/v5/market/account-ratio'
            params = {'category': 'linear', 'symbol': bybit_symbol, 'period': '5min', 'limit': 1}
            
            async with self.session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('retCode') == 0:
                        result = data.get('result', {})
                        if result and 'list' in result and len(result['list']) > 0:
                            latest = result['list'][0]
                            buy_ratio = float(latest.get('buyRatio', 0))
                            sell_ratio = float(latest.get('sellRatio', 0))
                            provider_results['long_short_ratio'] = {
                                'status': 'success',
                                'long_percent': buy_ratio * 100,
                                'short_percent': sell_ratio * 100,
                                'ratio': buy_ratio / sell_ratio if sell_ratio > 0 else 0
                            }
                            provider_results['accessible'] = True
                        else:
                            provider_results['long_short_ratio'] = {'status': 'no_data'}
                    else:
                        provider_results['long_short_ratio'] = {'status': 'api_error', 'message': data.get('retMsg')}
                elif response.status == 451:
                    provider_results['errors'].append(f"HTTP 451 - Blocked")
                    provider_results['long_short_ratio'] = {'status': 'blocked'}
                    return provider_results
                else:
                    provider_results['long_short_ratio'] = {'status': 'http_error', 'code': response.status}
            
        except Exception as e:
            provider_results['errors'].append(f"Exception: {str(e)}")
            logger.error(f"Bybit API test error for {symbol}: {e}")
        
        return provider_results
    
    async def test_okx_api(self, symbol: str) -> Dict:
        """Test OKX API accessibility for a symbol."""
        provider_results = {
            'symbol': symbol,
            'open_interest': None,
            'funding_rate': None,
            'long_short_ratio': None,
            'accessible': False,
            'errors': []
        }
        
        try:
            # Test 1: Open Interest
            okx_symbol = f"{symbol.upper()}-USDT-SWAP"
            url = 'https://www.okx.com/api/v5/public/open-interest'
            params = {'instId': okx_symbol}
            
            async with self.session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('code') == '0':
                        result = data.get('data', [])
                        if result and len(result) > 0:
                            provider_results['open_interest'] = {
                                'status': 'success',
                                'value': float(result[0].get('oi', 0))
                            }
                            provider_results['accessible'] = True
                        else:
                            provider_results['open_interest'] = {'status': 'no_data'}
                    else:
                        provider_results['open_interest'] = {'status': 'api_error', 'message': data.get('msg')}
                elif response.status == 451:
                    provider_results['errors'].append(f"HTTP 451 - Blocked (like Binance)")
                    provider_results['open_interest'] = {'status': 'blocked'}
                    return provider_results
                else:
                    provider_results['open_interest'] = {'status': 'http_error', 'code': response.status}
            
            # Test 2: Funding Rate
            url = 'https://www.okx.com/api/v5/public/funding-rate'
            params = {'instId': okx_symbol}
            
            async with self.session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('code') == '0':
                        result = data.get('data', [])
                        if result and len(result) > 0:
                            funding = result[0]
                            provider_results['funding_rate'] = {
                                'status': 'success',
                                'value': float(funding.get('fundingRate', 0)) * 100
                            }
                            provider_results['accessible'] = True
                        else:
                            provider_results['funding_rate'] = {'status': 'no_data'}
                    else:
                        provider_results['funding_rate'] = {'status': 'api_error', 'message': data.get('msg')}
                elif response.status == 451:
                    provider_results['errors'].append(f"HTTP 451 - Blocked")
                    provider_results['funding_rate'] = {'status': 'blocked'}
                    return provider_results
                else:
                    provider_results['funding_rate'] = {'status': 'http_error', 'code': response.status}
            
            # Test 3: Long/Short Ratio
            url = 'https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio'
            params = {'ccy': symbol.upper(), 'period': '5m'}
            
            async with self.session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('code') == '0':
                        result = data.get('data', [])
                        if result and len(result) > 0:
                            latest = result[0]
                            long_pct = float(latest.get('longRatio', 0))
                            short_pct = float(latest.get('shortRatio', 0))
                            provider_results['long_short_ratio'] = {
                                'status': 'success',
                                'long_percent': long_pct * 100,
                                'short_percent': short_pct * 100,
                                'ratio': long_pct / short_pct if short_pct > 0 else 0
                            }
                            provider_results['accessible'] = True
                        else:
                            provider_results['long_short_ratio'] = {'status': 'no_data'}
                    else:
                        provider_results['long_short_ratio'] = {'status': 'api_error', 'message': data.get('msg')}
                elif response.status == 451:
                    provider_results['errors'].append(f"HTTP 451 - Blocked")
                    provider_results['long_short_ratio'] = {'status': 'blocked'}
                    return provider_results
                else:
                    provider_results['long_short_ratio'] = {'status': 'http_error', 'code': response.status}
            
        except Exception as e:
            provider_results['errors'].append(f"Exception: {str(e)}")
            logger.error(f"OKX API test error for {symbol}: {e}")
        
        return provider_results
    
    async def run_comprehensive_test(self) -> Dict:
        """Run comprehensive API accessibility test."""
        logger.info("🚀 Starting BYBIT & OKX Futures API Accessibility Test")
        logger.info(f"📊 Testing {len(TEST_COINS)} major coins: {', '.join(TEST_COINS)}")
        
        start_time = time.time()
        
        # Test each coin on both providers
        bybit_results = []
        okx_results = []
        
        for coin in TEST_COINS:
            logger.info(f"\n🔍 Testing {coin}...")
            
            # Test Bybit
            logger.info(f"  📡 Testing Bybit for {coin}...")
            bybit_result = await self.test_bybit_api(coin)
            bybit_results.append(bybit_result)
            
            # Update stats
            self.results['bybit']['coins_tested'] += 1
            if bybit_result['accessible']:
                self.results['bybit']['successful_calls'] += 1
                logger.info(f"  ✅ Bybit: {coin} accessible")
            else:
                self.results['bybit']['failed_calls'] += 1
                logger.warning(f"  ❌ Bybit: {coin} not accessible")
            
            # Test OKX
            logger.info(f"  📡 Testing OKX for {coin}...")
            okx_result = await self.test_okx_api(coin)
            okx_results.append(okx_result)
            
            # Update stats
            self.results['okx']['coins_tested'] += 1
            if okx_result['accessible']:
                self.results['okx']['successful_calls'] += 1
                logger.info(f"  ✅ OKX: {coin} accessible")
            else:
                self.results['okx']['failed_calls'] += 1
                logger.warning(f"  ❌ OKX: {coin} not accessible")
            
            # Small delay between requests
            await asyncio.sleep(0.5)
        
        # Calculate overall accessibility
        self.results['bybit']['accessible'] = self.results['bybit']['successful_calls'] > 0
        self.results['okx']['accessible'] = self.results['okx']['successful_calls'] > 0
        
        # Calculate success rates
        bybit_success_rate = (self.results['bybit']['successful_calls'] / self.results['bybit']['coins_tested']) * 100
        okx_success_rate = (self.results['okx']['successful_calls'] / self.results['okx']['coins_tested']) * 100
        
        test_duration = time.time() - start_time
        
        # Compile final results
        self.results['test_summary'] = {
            'test_duration_seconds': round(test_duration, 2),
            'coins_tested': len(TEST_COINS),
            'bybit': {
                'accessible': self.results['bybit']['accessible'],
                'success_rate': round(bybit_success_rate, 1),
                'successful_coins': self.results['bybit']['successful_calls'],
                'failed_coins': self.results['bybit']['failed_calls']
            },
            'okx': {
                'accessible': self.results['okx']['accessible'],
                'success_rate': round(okx_success_rate, 1),
                'successful_coins': self.results['okx']['successful_calls'],
                'failed_coins': self.results['okx']['failed_calls']
            },
            'recommendation': self._get_recommendation()
        }
        
        self.results['detailed_results'] = {
            'bybit': bybit_results,
            'okx': okx_results
        }
        
        return self.results
    
    def _get_recommendation(self) -> str:
        """Get launch recommendation based on test results."""
        bybit_accessible = self.results['bybit']['accessible']
        okx_accessible = self.results['okx']['accessible']
        
        bybit_success_rate = (self.results['bybit']['successful_calls'] / self.results['bybit']['coins_tested']) * 100
        okx_success_rate = (self.results['okx']['successful_calls'] / self.results['okx']['coins_tested']) * 100
        
        if bybit_accessible and okx_accessible:
            if bybit_success_rate >= okx_success_rate:
                return f"✅ LAUNCH READY: Both providers work! Recommend Bybit as primary ({bybit_success_rate}% success) with OKX fallback ({okx_success_rate}% success)"
            else:
                return f"✅ LAUNCH READY: Both providers work! Recommend OKX as primary ({okx_success_rate}% success) with Bybit fallback ({bybit_success_rate}% success)"
        elif bybit_accessible:
            return f"✅ LAUNCH READY: Bybit works ({bybit_success_rate}% success rate). Use Bybit as primary provider."
        elif okx_accessible:
            return f"✅ LAUNCH READY: OKX works ({okx_success_rate}% success rate). Use OKX as primary provider."
        else:
            return "❌ LAUNCH BLOCKED: Both Bybit and OKX are inaccessible. Need proxy solution or launch without derivatives."
    
    def print_detailed_report(self):
        """Print detailed test report."""
        print("\n" + "="*80)
        print("🎯 BYBIT & OKX FUTURES API ACCESSIBILITY TEST RESULTS")
        print("="*80)
        
        summary = self.results['test_summary']
        print(f"\n📊 TEST SUMMARY:")
        print(f"   Duration: {summary['test_duration_seconds']}s")
        print(f"   Coins Tested: {summary['coins_tested']}")
        
        print(f"\n🟦 BYBIT RESULTS:")
        print(f"   Accessible: {'✅ YES' if summary['bybit']['accessible'] else '❌ NO'}")
        print(f"   Success Rate: {summary['bybit']['success_rate']}%")
        print(f"   Successful Coins: {summary['bybit']['successful_coins']}/{summary['coins_tested']}")
        
        print(f"\n🟧 OKX RESULTS:")
        print(f"   Accessible: {'✅ YES' if summary['okx']['accessible'] else '❌ NO'}")
        print(f"   Success Rate: {summary['okx']['success_rate']}%")
        print(f"   Successful Coins: {summary['okx']['successful_coins']}/{summary['coins_tested']}")
        
        print(f"\n🎯 RECOMMENDATION:")
        print(f"   {summary['recommendation']}")
        
        # Detailed coin-by-coin results
        print(f"\n📋 DETAILED COIN RESULTS:")
        for coin in TEST_COINS:
            bybit_coin = next((r for r in self.results['detailed_results']['bybit'] if r['symbol'] == coin), None)
            okx_coin = next((r for r in self.results['detailed_results']['okx'] if r['symbol'] == coin), None)
            
            print(f"\n   {coin}:")
            if bybit_coin:
                status = "✅" if bybit_coin['accessible'] else "❌"
                print(f"     Bybit: {status} {'Accessible' if bybit_coin['accessible'] else 'Not accessible'}")
                if bybit_coin['errors']:
                    print(f"       Errors: {', '.join(bybit_coin['errors'])}")
            
            if okx_coin:
                status = "✅" if okx_coin['accessible'] else "❌"
                print(f"     OKX:   {status} {'Accessible' if okx_coin['accessible'] else 'Not accessible'}")
                if okx_coin['errors']:
                    print(f"       Errors: {', '.join(okx_coin['errors'])}")
        
        print("\n" + "="*80)


async def test_backend_futures_integration():
    """Test the backend futures integration endpoints."""
    logger.info("\n🔧 Testing Backend Futures Integration...")
    
    backend_url = "https://oracle-trading-1.preview.emergentagent.com"
    
    async with aiohttp.ClientSession() as session:
        try:
            # Test futures provider status endpoint
            url = f"{backend_url}/api/futures-providers/status"
            async with session.get(url, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info("✅ Futures provider status endpoint working")
                    logger.info(f"   Providers: {list(data.get('providers', {}).keys())}")
                    
                    # Check if any providers have been used
                    total_calls = data.get('total_calls', 0)
                    if total_calls > 0:
                        logger.info(f"   Total API calls made: {total_calls}")
                        logger.info(f"   Overall success rate: {data.get('overall_success_rate', 0):.1f}%")
                    else:
                        logger.info("   No API calls made yet (expected for fresh deployment)")
                    
                    return True
                else:
                    logger.error(f"❌ Futures provider status endpoint failed: HTTP {response.status}")
                    return False
        except Exception as e:
            logger.error(f"❌ Backend futures integration test failed: {e}")
            return False


async def main():
    """Main test execution."""
    print("🚀 BYBIT & OKX FUTURES API ACCESSIBILITY TEST")
    print("=" * 50)
    print("MISSION: Determine if Bybit or OKX APIs work (unlike blocked Binance)")
    print("GOAL: Enable derivatives data for production launch")
    print()
    
    # Test 1: Direct API Accessibility
    async with FuturesAPITester() as tester:
        results = await tester.run_comprehensive_test()
        tester.print_detailed_report()
    
    # Test 2: Backend Integration
    backend_integration_works = await test_backend_futures_integration()
    
    # Final Assessment
    print("\n🎯 FINAL ASSESSMENT:")
    print("=" * 50)
    
    summary = results['test_summary']
    bybit_works = summary['bybit']['accessible']
    okx_works = summary['okx']['accessible']
    
    if bybit_works or okx_works:
        print("✅ SUCCESS: At least one futures provider is accessible!")
        print(f"   Bybit: {'✅ Working' if bybit_works else '❌ Blocked'}")
        print(f"   OKX:   {'✅ Working' if okx_works else '❌ Blocked'}")
        print(f"   Backend Integration: {'✅ Working' if backend_integration_works else '❌ Issues'}")
        print()
        print("🚀 RECOMMENDATION: PROCEED WITH DERIVATIVES DATA LAUNCH")
        print(f"   {summary['recommendation']}")
    else:
        print("❌ FAILURE: Both Bybit and OKX are inaccessible!")
        print("   This means all major futures providers are blocked in this environment")
        print()
        print("🛑 RECOMMENDATION: LAUNCH WITHOUT DERIVATIVES OR USE PROXY")
        print("   Options:")
        print("   1. Launch without derivatives data (reduced functionality)")
        print("   2. Implement proxy/VPN solution")
        print("   3. Find alternative derivatives data providers")
    
    return results


if __name__ == "__main__":
    asyncio.run(main())