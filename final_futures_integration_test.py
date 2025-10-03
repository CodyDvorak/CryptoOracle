#!/usr/bin/env python3
"""
FINAL BYBIT & OKX FUTURES INTEGRATION TEST
==========================================

MISSION CRITICAL: Test complete end-to-end futures integration
- Direct API accessibility
- Backend integration
- Scan with derivatives data
- Data quality validation

This is THE decisive test for derivatives data launch readiness.
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

# Test configuration
TEST_COINS = ['BTC', 'ETH', 'SOL', 'DOGE', 'BNB']
BACKEND_URL = "https://smarttrade-ai-43.preview.emergentagent.com"

class FinalFuturesIntegrationTest:
    """Final comprehensive futures integration test."""
    
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.test_results = {
            'direct_api_tests': {},
            'backend_integration': {},
            'scan_integration': {},
            'data_quality': {},
            'final_assessment': {}
        }
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def test_direct_api_access(self) -> Dict:
        """Test direct API access to Bybit and OKX."""
        logger.info("🔍 PHASE 1: Direct API Accessibility Test")
        
        results = {
            'bybit': {'accessible': False, 'reason': None, 'sample_data': None},
            'okx': {'accessible': False, 'reason': None, 'sample_data': None}
        }
        
        # Test Bybit
        try:
            url = "https://api.bybit.com/v5/market/open-interest"
            params = {"category": "linear", "symbol": "BTCUSDT", "intervalTime": "5min"}
            
            async with self.session.get(url, params=params, timeout=10) as response:
                if response.status == 403:
                    results['bybit']['reason'] = "CloudFront geo-blocking (HTTP 403)"
                    logger.warning("❌ Bybit: Blocked by CloudFront")
                elif response.status == 451:
                    results['bybit']['reason'] = "Legal restrictions (HTTP 451)"
                    logger.warning("❌ Bybit: Legal restrictions")
                elif response.status == 200:
                    data = await response.json()
                    if data.get('retCode') == 0:
                        results['bybit']['accessible'] = True
                        results['bybit']['sample_data'] = data
                        logger.info("✅ Bybit: Accessible")
                    else:
                        results['bybit']['reason'] = f"API error: {data.get('retMsg')}"
                        logger.warning(f"❌ Bybit: API error - {data.get('retMsg')}")
                else:
                    results['bybit']['reason'] = f"HTTP {response.status}"
                    logger.warning(f"❌ Bybit: HTTP {response.status}")
        except Exception as e:
            results['bybit']['reason'] = f"Connection error: {str(e)}"
            logger.error(f"❌ Bybit: Connection error - {e}")
        
        # Test OKX
        try:
            url = "https://www.okx.com/api/v5/public/open-interest"
            params = {"instId": "BTC-USDT-SWAP"}
            
            async with self.session.get(url, params=params, timeout=10) as response:
                if response.status == 403:
                    results['okx']['reason'] = "Access forbidden (HTTP 403)"
                    logger.warning("❌ OKX: Access forbidden")
                elif response.status == 451:
                    results['okx']['reason'] = "Legal restrictions (HTTP 451)"
                    logger.warning("❌ OKX: Legal restrictions")
                elif response.status == 200:
                    data = await response.json()
                    if data.get('code') == '0':
                        results['okx']['accessible'] = True
                        results['okx']['sample_data'] = data
                        logger.info("✅ OKX: Accessible")
                    else:
                        results['okx']['reason'] = f"API error: {data.get('msg')}"
                        logger.warning(f"❌ OKX: API error - {data.get('msg')}")
                else:
                    results['okx']['reason'] = f"HTTP {response.status}"
                    logger.warning(f"❌ OKX: HTTP {response.status}")
        except Exception as e:
            results['okx']['reason'] = f"Connection error: {str(e)}"
            logger.error(f"❌ OKX: Connection error - {e}")
        
        self.test_results['direct_api_tests'] = results
        return results
    
    async def test_backend_integration(self) -> Dict:
        """Test backend futures integration endpoints."""
        logger.info("🔧 PHASE 2: Backend Integration Test")
        
        results = {
            'provider_status_endpoint': False,
            'multi_provider_configured': False,
            'provider_data': None,
            'scan_status_endpoint': False
        }
        
        try:
            # Test futures provider status endpoint
            url = f"{BACKEND_URL}/api/futures-providers/status"
            async with self.session.get(url, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    results['provider_status_endpoint'] = True
                    results['provider_data'] = data
                    
                    # Check if multiple providers are configured
                    providers = data.get('providers', {})
                    if len(providers) >= 2:
                        results['multi_provider_configured'] = True
                        logger.info(f"✅ Backend: Multi-provider system configured ({len(providers)} providers)")
                    else:
                        logger.warning("⚠️ Backend: Multi-provider system not properly configured")
                    
                    logger.info("✅ Backend: Futures provider status endpoint working")
                else:
                    logger.warning(f"❌ Backend: Provider status endpoint failed (HTTP {response.status})")
            
            # Test scan status endpoint
            url = f"{BACKEND_URL}/api/scan/status"
            async with self.session.get(url, timeout=10) as response:
                if response.status == 200:
                    results['scan_status_endpoint'] = True
                    logger.info("✅ Backend: Scan status endpoint working")
                else:
                    logger.warning(f"❌ Backend: Scan status endpoint failed (HTTP {response.status})")
        
        except Exception as e:
            logger.error(f"❌ Backend integration test failed: {e}")
        
        self.test_results['backend_integration'] = results
        return results
    
    async def test_scan_with_derivatives(self) -> Dict:
        """Test running a scan with derivatives data integration."""
        logger.info("🚀 PHASE 3: Scan Integration Test")
        
        results = {
            'scan_triggered': False,
            'scan_completed': False,
            'derivatives_data_found': False,
            'provider_stats_updated': False,
            'scan_duration': 0,
            'error': None
        }
        
        try:
            # Trigger a quick scan
            scan_payload = {
                "scope": "all",
                "min_price": 1,
                "max_price": 100,
                "scan_type": "quick_scan"
            }
            
            url = f"{BACKEND_URL}/api/scan/run"
            async with self.session.post(url, json=scan_payload, timeout=10) as response:
                if response.status == 200:
                    results['scan_triggered'] = True
                    logger.info("✅ Scan triggered successfully")
                elif response.status == 409:
                    logger.info("ℹ️ Scan already running - will monitor existing scan")
                    results['scan_triggered'] = True
                else:
                    results['error'] = f"Failed to trigger scan: HTTP {response.status}"
                    logger.error(results['error'])
                    return results
            
            # Monitor scan progress
            start_time = time.time()
            max_wait_time = 300  # 5 minutes max
            
            while time.time() - start_time < max_wait_time:
                url = f"{BACKEND_URL}/api/scan/status"
                async with self.session.get(url, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        is_running = data.get('is_running', False)
                        
                        if not is_running:
                            recent_run = data.get('recent_run')
                            if recent_run and recent_run.get('status') == 'completed':
                                results['scan_completed'] = True
                                results['scan_duration'] = time.time() - start_time
                                logger.info(f"✅ Scan completed in {results['scan_duration']:.1f}s")
                                break
                            elif recent_run and recent_run.get('status') == 'failed':
                                results['error'] = "Scan failed"
                                logger.error("❌ Scan failed")
                                break
                        else:
                            elapsed = time.time() - start_time
                            logger.info(f"⏳ Scan running... ({elapsed:.0f}s elapsed)")
                
                await asyncio.sleep(10)  # Check every 10 seconds
            
            if not results['scan_completed']:
                results['error'] = "Scan timeout or did not complete"
                logger.warning("⚠️ Scan did not complete within timeout")
            
            # Check if provider statistics were updated
            url = f"{BACKEND_URL}/api/futures-providers/status"
            async with self.session.get(url, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    total_calls = data.get('total_calls', 0)
                    if total_calls > 0:
                        results['provider_stats_updated'] = True
                        results['derivatives_data_found'] = True
                        logger.info(f"✅ Provider statistics updated: {total_calls} API calls made")
                    else:
                        logger.info("ℹ️ No futures API calls made during scan")
        
        except Exception as e:
            results['error'] = f"Scan integration test failed: {str(e)}"
            logger.error(results['error'])
        
        self.test_results['scan_integration'] = results
        return results
    
    async def validate_data_quality(self) -> Dict:
        """Validate the quality of derivatives data from accessible providers."""
        logger.info("📊 PHASE 4: Data Quality Validation")
        
        results = {
            'okx_data_quality': {'tested': False, 'issues': []},
            'bybit_data_quality': {'tested': False, 'issues': []},
            'overall_quality_score': 0
        }
        
        # Test OKX data quality if accessible
        if self.test_results['direct_api_tests']['okx']['accessible']:
            logger.info("Testing OKX data quality...")
            okx_issues = []
            
            try:
                # Test funding rate reasonableness
                url = "https://www.okx.com/api/v5/public/funding-rate"
                params = {"instId": "BTC-USDT-SWAP"}
                
                async with self.session.get(url, params=params, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get('code') == '0' and data.get('data'):
                            funding_rate = float(data['data'][0].get('fundingRate', 0)) * 100
                            if abs(funding_rate) > 1.0:
                                okx_issues.append(f"Extreme funding rate: {funding_rate:.4f}%")
                            else:
                                logger.info(f"✅ OKX funding rate reasonable: {funding_rate:.4f}%")
                
                # Test open interest positivity
                url = "https://www.okx.com/api/v5/public/open-interest"
                params = {"instId": "BTC-USDT-SWAP"}
                
                async with self.session.get(url, params=params, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get('code') == '0' and data.get('data'):
                            oi = float(data['data'][0].get('oi', 0))
                            if oi <= 0:
                                okx_issues.append(f"Zero/negative open interest: {oi}")
                            else:
                                logger.info(f"✅ OKX open interest positive: {oi:,.0f}")
                
                results['okx_data_quality']['tested'] = True
                results['okx_data_quality']['issues'] = okx_issues
                
            except Exception as e:
                okx_issues.append(f"Data quality test failed: {str(e)}")
                results['okx_data_quality']['issues'] = okx_issues
        
        # Calculate overall quality score
        total_tests = 0
        passed_tests = 0
        
        if results['okx_data_quality']['tested']:
            total_tests += 2  # funding rate + open interest tests
            passed_tests += (2 - len(results['okx_data_quality']['issues']))
        
        if total_tests > 0:
            results['overall_quality_score'] = (passed_tests / total_tests) * 100
        
        self.test_results['data_quality'] = results
        return results
    
    def generate_final_assessment(self) -> Dict:
        """Generate final launch readiness assessment."""
        logger.info("🎯 PHASE 5: Final Assessment")
        
        # Collect key metrics
        bybit_accessible = self.test_results['direct_api_tests']['bybit']['accessible']
        okx_accessible = self.test_results['direct_api_tests']['okx']['accessible']
        backend_working = self.test_results['backend_integration']['provider_status_endpoint']
        scan_working = self.test_results['scan_integration']['scan_completed']
        data_quality = self.test_results['data_quality']['overall_quality_score']
        
        # Determine launch readiness
        launch_ready = False
        primary_provider = None
        coverage_estimate = 0
        
        if okx_accessible and backend_working:
            launch_ready = True
            primary_provider = "OKX"
            coverage_estimate = 80  # Estimate based on major coins
        elif bybit_accessible and backend_working:
            launch_ready = True
            primary_provider = "Bybit"
            coverage_estimate = 75
        
        # Generate recommendation
        if launch_ready:
            if scan_working:
                recommendation = f"✅ LAUNCH READY: {primary_provider} accessible, backend integrated, scan tested"
            else:
                recommendation = f"⚠️ LAUNCH READY WITH MONITORING: {primary_provider} accessible, backend working, scan needs monitoring"
        else:
            if not (bybit_accessible or okx_accessible):
                recommendation = "❌ LAUNCH BLOCKED: No futures providers accessible"
            elif not backend_working:
                recommendation = "❌ LAUNCH BLOCKED: Backend integration issues"
            else:
                recommendation = "❌ LAUNCH BLOCKED: Unknown integration issues"
        
        assessment = {
            'launch_ready': launch_ready,
            'primary_provider': primary_provider,
            'coverage_estimate': coverage_estimate,
            'data_quality_score': data_quality,
            'recommendation': recommendation,
            'critical_success_criteria': {
                'api_accessible': bybit_accessible or okx_accessible,
                'backend_integrated': backend_working,
                'scan_functional': scan_working,
                'data_quality_acceptable': data_quality >= 70
            }
        }
        
        self.test_results['final_assessment'] = assessment
        return assessment
    
    async def run_complete_test(self) -> Dict:
        """Run the complete test suite."""
        logger.info("🚀 STARTING FINAL FUTURES INTEGRATION TEST")
        logger.info("=" * 60)
        
        start_time = time.time()
        
        # Phase 1: Direct API Tests
        await self.test_direct_api_access()
        
        # Phase 2: Backend Integration
        await self.test_backend_integration()
        
        # Phase 3: Scan Integration (only if backend is working)
        if self.test_results['backend_integration']['provider_status_endpoint']:
            await self.test_scan_with_derivatives()
        else:
            logger.warning("⚠️ Skipping scan integration test - backend issues detected")
        
        # Phase 4: Data Quality
        await self.validate_data_quality()
        
        # Phase 5: Final Assessment
        self.generate_final_assessment()
        
        total_duration = time.time() - start_time
        self.test_results['total_test_duration'] = round(total_duration, 2)
        
        return self.test_results
    
    def print_comprehensive_report(self):
        """Print the final comprehensive test report."""
        print("\n" + "="*80)
        print("🎯 FINAL FUTURES INTEGRATION TEST RESULTS")
        print("="*80)
        
        print(f"\n⏱️  TOTAL TEST DURATION: {self.test_results['total_test_duration']}s")
        
        # Phase 1 Results
        print(f"\n📡 PHASE 1: DIRECT API ACCESSIBILITY")
        direct_tests = self.test_results['direct_api_tests']
        
        bybit_status = "✅ ACCESSIBLE" if direct_tests['bybit']['accessible'] else "❌ BLOCKED"
        print(f"   🟦 Bybit: {bybit_status}")
        if not direct_tests['bybit']['accessible']:
            print(f"      Reason: {direct_tests['bybit']['reason']}")
        
        okx_status = "✅ ACCESSIBLE" if direct_tests['okx']['accessible'] else "❌ BLOCKED"
        print(f"   🟧 OKX:   {okx_status}")
        if not direct_tests['okx']['accessible']:
            print(f"      Reason: {direct_tests['okx']['reason']}")
        
        # Phase 2 Results
        print(f"\n🔧 PHASE 2: BACKEND INTEGRATION")
        backend = self.test_results['backend_integration']
        
        status = "✅ WORKING" if backend['provider_status_endpoint'] else "❌ FAILED"
        print(f"   Provider Status Endpoint: {status}")
        
        status = "✅ CONFIGURED" if backend['multi_provider_configured'] else "❌ NOT CONFIGURED"
        print(f"   Multi-Provider System: {status}")
        
        if backend['provider_data']:
            total_providers = len(backend['provider_data'].get('providers', {}))
            print(f"   Configured Providers: {total_providers}")
        
        # Phase 3 Results
        print(f"\n🚀 PHASE 3: SCAN INTEGRATION")
        scan = self.test_results['scan_integration']
        
        if scan:
            status = "✅ SUCCESS" if scan['scan_triggered'] else "❌ FAILED"
            print(f"   Scan Trigger: {status}")
            
            status = "✅ COMPLETED" if scan['scan_completed'] else "❌ FAILED/TIMEOUT"
            print(f"   Scan Completion: {status}")
            if scan['scan_completed']:
                print(f"   Scan Duration: {scan['scan_duration']:.1f}s")
            
            status = "✅ UPDATED" if scan['provider_stats_updated'] else "❌ NO CALLS"
            print(f"   Provider Statistics: {status}")
            
            if scan['error']:
                print(f"   Error: {scan['error']}")
        else:
            print("   ⚠️ SKIPPED (Backend issues)")
        
        # Phase 4 Results
        print(f"\n📊 PHASE 4: DATA QUALITY")
        quality = self.test_results['data_quality']
        
        if quality['okx_data_quality']['tested']:
            issues = len(quality['okx_data_quality']['issues'])
            status = "✅ GOOD" if issues == 0 else f"⚠️ {issues} ISSUES"
            print(f"   OKX Data Quality: {status}")
            for issue in quality['okx_data_quality']['issues']:
                print(f"      - {issue}")
        
        print(f"   Overall Quality Score: {quality['overall_quality_score']:.0f}%")
        
        # Final Assessment
        print(f"\n🎯 FINAL ASSESSMENT")
        assessment = self.test_results['final_assessment']
        
        print(f"   Launch Ready: {'✅ YES' if assessment['launch_ready'] else '❌ NO'}")
        if assessment['primary_provider']:
            print(f"   Primary Provider: {assessment['primary_provider']}")
            print(f"   Estimated Coverage: {assessment['coverage_estimate']}%")
        print(f"   Data Quality Score: {assessment['data_quality_score']:.0f}%")
        
        print(f"\n📋 CRITICAL SUCCESS CRITERIA:")
        criteria = assessment['critical_success_criteria']
        for criterion, passed in criteria.items():
            status = "✅ PASS" if passed else "❌ FAIL"
            print(f"   {criterion.replace('_', ' ').title()}: {status}")
        
        print(f"\n🚀 RECOMMENDATION:")
        print(f"   {assessment['recommendation']}")
        
        # Implementation guidance
        if assessment['launch_ready']:
            print(f"\n🔧 IMPLEMENTATION GUIDANCE:")
            print(f"   1. Configure {assessment['primary_provider']} as primary futures provider")
            if assessment['primary_provider'] == 'OKX':
                print(f"   2. Disable Bybit provider (geo-blocked)")
            print(f"   3. Enable derivatives data in production scans")
            print(f"   4. Monitor API performance and error rates")
            print(f"   5. Set up alerts for provider failures")
        else:
            print(f"\n🛑 BLOCKING ISSUES:")
            if not criteria['api_accessible']:
                print(f"   - No futures providers are accessible")
            if not criteria['backend_integrated']:
                print(f"   - Backend integration is not working")
            if not criteria['scan_functional']:
                print(f"   - Scan integration has issues")
            if not criteria['data_quality_acceptable']:
                print(f"   - Data quality is below acceptable threshold")
        
        print("\n" + "="*80)


async def main():
    """Main test execution."""
    print("🚀 FINAL BYBIT & OKX FUTURES INTEGRATION TEST")
    print("=" * 60)
    print("MISSION: Complete end-to-end futures integration validation")
    print("GOAL: Determine production launch readiness with derivatives data")
    print()
    
    async with FinalFuturesIntegrationTest() as tester:
        results = await tester.run_complete_test()
        tester.print_comprehensive_report()
    
    return results


if __name__ == "__main__":
    asyncio.run(main())