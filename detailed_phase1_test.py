#!/usr/bin/env python3
"""
Detailed Phase 1 Testing - Focus on specific endpoints and data validation
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

async def test_evaluation_endpoint():
    """Test the evaluation endpoint with force_close parameter"""
    async with aiohttp.ClientSession() as session:
        print("🔍 Testing Evaluation Endpoint with force_close=true...")
        
        url = f"{API_BASE}/bots/evaluate?hours_old=1&force_close=true"
        async with session.post(url) as response:
            if response.status == 200:
                data = await response.json()
                print(f"✅ Evaluation Response: {json.dumps(data, indent=2)}")
                
                result = data.get('result', {})
                wins = result.get('wins', 0)
                partial_wins = result.get('partial_wins', 0)
                losses = result.get('losses', 0)
                neutral = result.get('neutral', 0)
                
                print(f"📊 Results Summary:")
                print(f"   - Wins: {wins}")
                print(f"   - Partial Wins: {partial_wins}")
                print(f"   - Losses: {losses}")
                print(f"   - Neutral: {neutral}")
                
                total = wins + partial_wins + losses + neutral
                if total > 0:
                    print(f"   - Partial Win Rate: {(partial_wins/total)*100:.1f}%")
                    print(f"   - Neutral Rate with force_close: {(neutral/total)*100:.1f}%")
                
            else:
                print(f"❌ Evaluation endpoint failed: HTTP {response.status}")

async def test_bot_performance_endpoint():
    """Test bot performance endpoint for partial_wins field"""
    async with aiohttp.ClientSession() as session:
        print("\n🤖 Testing Bot Performance Endpoint...")
        
        async with session.get(f"{API_BASE}/bots/performance") as response:
            if response.status == 200:
                data = await response.json()
                bot_performances = data.get('bot_performances', [])
                
                print(f"✅ Found {len(bot_performances)} bot performances")
                
                # Check first few bots for partial_wins field
                for i, bot in enumerate(bot_performances[:3]):
                    bot_name = bot.get('bot_name', 'Unknown')
                    accuracy = bot.get('accuracy', 0)
                    wins = bot.get('wins', 0)
                    partial_wins = bot.get('partial_wins', 0)
                    losses = bot.get('losses', 0)
                    
                    print(f"   Bot {i+1}: {bot_name}")
                    print(f"     - Accuracy: {accuracy:.1f}%")
                    print(f"     - Wins: {wins}")
                    print(f"     - Partial Wins: {partial_wins}")
                    print(f"     - Losses: {losses}")
                    
                    # Check if partial_wins field exists
                    if 'partial_wins' in bot:
                        print(f"     ✅ partial_wins field present")
                    else:
                        print(f"     ❌ partial_wins field missing")
                
            else:
                print(f"❌ Bot performance endpoint failed: HTTP {response.status}")

async def test_predictions_with_partial_wins():
    """Test predictions endpoint for partial_win status"""
    async with aiohttp.ClientSession() as session:
        print("\n🎯 Testing Predictions with Partial Wins...")
        
        # Get predictions with partial_win status
        async with session.get(f"{API_BASE}/bots/predictions?outcome_status=partial_win&limit=5") as response:
            if response.status == 200:
                data = await response.json()
                predictions = data.get('predictions', [])
                
                print(f"✅ Found {len(predictions)} partial win predictions")
                
                for i, pred in enumerate(predictions):
                    print(f"   Prediction {i+1}:")
                    print(f"     - Bot: {pred.get('bot_name', 'Unknown')}")
                    print(f"     - Coin: {pred.get('coin', 'Unknown')}")
                    print(f"     - Direction: {pred.get('direction', 'Unknown')}")
                    print(f"     - Entry Price: ${pred.get('entry_price', 0):.2f}")
                    print(f"     - Take Profit: ${pred.get('take_profit', 0):.2f}")
                    print(f"     - Current Price: ${pred.get('current_price', 0):.2f}")
                    print(f"     - Outcome Status: {pred.get('outcome_status', 'Unknown')}")
                    
                    # Calculate progress to target
                    entry = pred.get('entry_price', 0)
                    target = pred.get('take_profit', 0)
                    current = pred.get('current_price', 0)
                    direction = pred.get('direction', '')
                    
                    if entry and target and current:
                        if direction == 'long':
                            target_gain = target - entry
                            current_gain = current - entry
                        else:  # short
                            target_gain = entry - target
                            current_gain = entry - current
                        
                        if target_gain > 0:
                            progress = (current_gain / target_gain) * 100
                            print(f"     - Progress to Target: {progress:.1f}%")
                
            else:
                print(f"❌ Partial win predictions failed: HTTP {response.status}")

async def test_stop_loss_analysis():
    """Analyze stop loss values in recent predictions"""
    async with aiohttp.ClientSession() as session:
        print("\n🛑 Testing Stop Loss Analysis...")
        
        async with session.get(f"{API_BASE}/bots/predictions?limit=50") as response:
            if response.status == 200:
                data = await response.json()
                predictions = data.get('predictions', [])
                
                print(f"✅ Analyzing {len(predictions)} predictions for stop loss")
                
                stop_loss_percentages = []
                loss_in_new_range = 0  # Losses between -5% and -10%
                
                for pred in predictions:
                    entry = pred.get('entry_price', 0)
                    stop_loss = pred.get('stop_loss', 0)
                    current = pred.get('current_price', 0)
                    direction = pred.get('direction', '')
                    outcome = pred.get('outcome_status', '')
                    
                    if entry and stop_loss:
                        if direction == 'long':
                            sl_pct = ((stop_loss - entry) / entry) * 100
                        else:  # short
                            sl_pct = ((entry - stop_loss) / entry) * 100
                        
                        stop_loss_percentages.append(sl_pct)
                        
                        # Check if current price is in -5% to -10% range and marked as loss
                        if current and entry:
                            if direction == 'long':
                                current_pct = ((current - entry) / entry) * 100
                            else:
                                current_pct = ((entry - current) / entry) * 100
                            
                            if -10 <= current_pct <= -5 and outcome == 'loss':
                                loss_in_new_range += 1
                
                if stop_loss_percentages:
                    avg_sl = sum(stop_loss_percentages) / len(stop_loss_percentages)
                    print(f"   📊 Stop Loss Analysis:")
                    print(f"     - Average Stop Loss: {avg_sl:.1f}%")
                    print(f"     - Total Predictions with SL: {len(stop_loss_percentages)}")
                    print(f"     - Losses in -5% to -10% range: {loss_in_new_range}")
                    
                    if avg_sl > -7.5:  # Closer to -5% than -10%
                        print(f"     ✅ Stop loss appears updated (closer to -5%)")
                    else:
                        print(f"     ⚠️ Stop loss may still be using old logic")
                
            else:
                print(f"❌ Stop loss analysis failed: HTTP {response.status}")

async def main():
    """Run detailed Phase 1 tests"""
    print("=" * 80)
    print("DETAILED PHASE 1 IMPROVEMENTS TESTING")
    print("=" * 80)
    
    await test_evaluation_endpoint()
    await test_bot_performance_endpoint()
    await test_predictions_with_partial_wins()
    await test_stop_loss_analysis()
    
    print("\n" + "=" * 80)
    print("DETAILED TESTING COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(main())