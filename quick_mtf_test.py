#!/usr/bin/env python3
"""
Quick Multi-Timeframe Analysis Test
"""

import asyncio
import aiohttp
import json
from pathlib import Path

# Get backend URL
frontend_env_path = Path(__file__).parent / "frontend" / ".env"
backend_url = "https://smarttrade-ai-43.preview.emergentagent.com"

if frontend_env_path.exists():
    with open(frontend_env_path, 'r') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                backend_url = line.split('=', 1)[1].strip()
                break

API_BASE = f"{backend_url}/api"

async def test_quick_scan():
    """Test a quick scan to see if multi-timeframe analysis is working"""
    async with aiohttp.ClientSession() as session:
        print("🚀 Starting quick multi-timeframe test...")
        
        # Start a small scan
        scan_request = {
            "scope": "all",
            "scan_type": "quick_scan",
            "custom_symbols": ["BTC", "ETH"]
        }
        
        async with session.post(f"{API_BASE}/scan/run", json=scan_request) as response:
            if response.status == 200:
                scan_data = await response.json()
                print(f"✅ Scan started: {scan_data.get('status')}")
                
                # Wait a bit and check status
                await asyncio.sleep(30)
                
                async with session.get(f"{API_BASE}/scan/status") as status_response:
                    if status_response.status == 200:
                        status_data = await status_response.json()
                        is_running = status_data.get('is_running', False)
                        recent_run = status_data.get('recent_run')
                        
                        if is_running:
                            print("✅ Scan is running - multi-timeframe analysis should be active")
                            print("📊 Check backend logs for:")
                            print("   - '4h candles' or 'CoinMarketCap: Aggregated X 4h candles'")
                            print("   - 'Timeframe Alignment:' messages")
                            print("   - 'compute_4h_indicators' function calls")
                        elif recent_run and recent_run.get('status') == 'completed':
                            print(f"✅ Scan completed: {recent_run.get('id')}")
                            print("📊 Multi-timeframe analysis should have been applied")
                        else:
                            print("⚠️ Scan status unclear")
                    else:
                        print(f"❌ Status check failed: {status_response.status}")
            else:
                print(f"❌ Scan start failed: {response.status}")

if __name__ == "__main__":
    asyncio.run(test_quick_scan())