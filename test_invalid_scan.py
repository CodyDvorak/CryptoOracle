#!/usr/bin/env python3
"""
Test invalid scan type to verify validation is working
"""

import asyncio
import aiohttp
import json

API_BASE = "https://smarttrade-ai-42.preview.emergentagent.com/api"

async def test_invalid_scan_type():
    async with aiohttp.ClientSession() as session:
        # Test with invalid scan type
        scan_request = {
            "scan_type": "invalid_scan_type",
            "filter_scope": "all",
            "scope": "all"
        }
        
        async with session.post(f"{API_BASE}/scan/run", json=scan_request) as response:
            print(f"Invalid scan type test:")
            print(f"Status: {response.status}")
            if response.status != 200:
                error_text = await response.text()
                print(f"Response: {error_text}")
            else:
                data = await response.json()
                print(f"Response: {data}")

if __name__ == "__main__":
    asyncio.run(test_invalid_scan_type())