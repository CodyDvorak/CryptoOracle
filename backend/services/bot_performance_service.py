"""
Bot Performance Tracking Service

Handles:
- Storing bot predictions during scans
- Evaluating prediction outcomes
- Updating bot performance metrics
- Adjusting bot weights based on historical accuracy
"""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

from models.models import BotPrediction, BotPerformance

logger = logging.getLogger(__name__)


class BotPerformanceService:
    """Service for tracking and evaluating bot performance."""
    
    def __init__(self, db: AsyncIOMotorDatabase, crypto_client):
        self.db = db
        self.crypto_client = crypto_client
        logger.info("🤖 Bot Performance Service initialized")
    
    async def save_bot_predictions(self, run_id: str, user_id: Optional[str], bot_results: List[Dict]) -> int:
        """Save individual bot predictions for a scan.
        
        Args:
            run_id: Scan run ID
            user_id: User who initiated the scan
            bot_results: List of bot result dictionaries from scan
            
        Returns:
            Number of predictions saved
        """
        try:
            predictions = []
            
            for bot_result in bot_results:
                # Only save if bot made a prediction (not neutral)
                direction = bot_result.get('direction', bot_result.get('signal', 'neutral'))
                
                if direction in ['long', 'short']:
                    # Extract coin info - might be in different fields
                    coin_symbol = bot_result.get('ticker', bot_result.get('coin', 'UNKNOWN'))
                    coin_name = bot_result.get('coin_name', bot_result.get('coin', coin_symbol))
                    
                    # Bot name might be nested
                    bot_name = bot_result.get('bot_name', 'Unknown')
                    
                    # Price info
                    current_price = bot_result.get('current_price', bot_result.get('entry_price', bot_result.get('entry', 0.0)))
                    target_price = bot_result.get('target_price', bot_result.get('take_profit', 0.0))
                    stop_loss = bot_result.get('stop_loss')
                    
                    # Skip if we don't have essential data
                    if not coin_symbol or current_price == 0:
                        continue
                    
                    prediction = BotPrediction(
                        run_id=run_id,
                        user_id=user_id,
                        bot_name=bot_name,
                        coin_symbol=coin_symbol,
                        coin_name=coin_name,
                        entry_price=current_price,
                        target_price=target_price,
                        stop_loss=stop_loss,
                        position_direction=direction,
                        confidence_score=bot_result.get('confidence', 0.0),
                        leverage=bot_result.get('leverage', bot_result.get('recommended_leverage')),
                        outcome_status='pending'
                    )
                    predictions.append(prediction.dict())
            
            if predictions:
                await self.db.bot_predictions.insert_many(predictions)
                logger.info(f"💾 Saved {len(predictions)} bot predictions for run {run_id}")
                
                # Update bot performance records with new prediction counts
                await self._update_prediction_counts(predictions)
                
            else:
                logger.warning(f"⚠️ No valid predictions to save for run {run_id}")
                
            return len(predictions)
            
        except Exception as e:
            logger.error(f"Error saving bot predictions: {e}")
            return 0
    
    async def _update_prediction_counts(self, predictions: List[Dict]):
        """Update total prediction counts for bots."""
        bot_names = set(p['bot_name'] for p in predictions)
        
        for bot_name in bot_names:
            count = sum(1 for p in predictions if p['bot_name'] == bot_name)
            
            # Upsert bot performance record
            await self.db.bot_performance.update_one(
                {'bot_name': bot_name},
                {
                    '$inc': {
                        'total_predictions': count,
                        'pending_predictions': count
                    },
                    '$set': {
                        'last_prediction_at': datetime.now(timezone.utc),
                        'last_updated': datetime.now(timezone.utc)
                    },
                    '$setOnInsert': {
                        'first_prediction_at': datetime.now(timezone.utc),
                        'performance_weight': 1.0
                    }
                },
                upsert=True
            )
    
    async def evaluate_predictions(self, hours_old: int = 24) -> Dict:
        """Evaluate pending predictions that are at least X hours old.
        
        Args:
            hours_old: Minimum age of predictions to evaluate (default 24h)
            
        Returns:
            Dictionary with evaluation statistics
        """
        try:
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours_old)
            
            # Find pending predictions older than cutoff
            pending = await self.db.bot_predictions.find({
                'outcome_status': 'pending',
                'timestamp': {'$lt': cutoff_time}
            }).to_list(1000)
            
            if not pending:
                logger.info(f"No pending predictions older than {hours_old}h to evaluate")
                return {'evaluated': 0, 'wins': 0, 'losses': 0, 'neutral': 0}
            
            logger.info(f"📊 Evaluating {len(pending)} predictions older than {hours_old}h...")
            
            # Get current prices for all unique coins
            unique_symbols = list(set(p['coin_symbol'] for p in pending))
            current_prices = await self._get_current_prices(unique_symbols)
            
            wins = 0
            losses = 0
            neutral = 0
            
            # Evaluate each prediction
            for prediction in pending:
                symbol = prediction['coin_symbol']
                current_price = current_prices.get(symbol)
                
                if current_price is None:
                    logger.warning(f"Could not get price for {symbol}, skipping")
                    continue
                
                outcome = self._determine_outcome(prediction, current_price)
                
                # Update prediction with outcome
                await self.db.bot_predictions.update_one(
                    {'id': prediction['id']},
                    {
                        '$set': {
                            'outcome_checked_at': datetime.now(timezone.utc),
                            'outcome_price': current_price,
                            'outcome_status': outcome['status'],
                            'profit_loss_percent': outcome['profit_loss_percent']
                        }
                    }
                )
                
                # Count results
                if outcome['status'] == 'win':
                    wins += 1
                elif outcome['status'] == 'loss':
                    losses += 1
                else:
                    neutral += 1
            
            # Update bot performance metrics
            await self._update_bot_metrics()
            
            # Recalculate performance weights
            await self._recalculate_weights()
            
            logger.info(f"✅ Evaluation complete: {wins} wins, {losses} losses, {neutral} neutral")
            
            return {
                'evaluated': len(pending),
                'wins': wins,
                'losses': losses,
                'neutral': neutral
            }
            
        except Exception as e:
            logger.error(f"Error evaluating predictions: {e}")
            return {'evaluated': 0, 'wins': 0, 'losses': 0, 'neutral': 0, 'error': str(e)}
    
    async def _get_current_prices(self, symbols: List[str]) -> Dict[str, float]:
        """Fetch current prices for a list of symbols."""
        prices = {}
        
        # Use CryptoCompare to get current prices
        all_coins = await self.crypto_client.get_all_coins(max_coins=200)
        
        for symbol, name, price in all_coins:
            if symbol in symbols:
                prices[symbol] = price
        
        return prices
    
    def _determine_outcome(self, prediction: Dict, current_price: float) -> Dict:
        """Determine if a prediction was successful.
        
        Logic:
        - LONG: Win if current_price >= target, Loss if current_price <= stop_loss (or -10% if no stop)
        - SHORT: Win if current_price <= target, Loss if current_price >= stop_loss (or +10% if no stop)
        - Neutral if neither condition met
        """
        entry_price = prediction['entry_price']
        target_price = prediction['target_price']
        stop_loss = prediction.get('stop_loss')
        direction = prediction['position_direction']
        
        # Calculate profit/loss percentage
        price_change = ((current_price - entry_price) / entry_price) * 100
        
        if direction == 'long':
            profit_loss = price_change
            
            # Check win condition
            if current_price >= target_price:
                return {'status': 'win', 'profit_loss_percent': profit_loss}
            
            # Check loss condition
            if stop_loss and current_price <= stop_loss:
                return {'status': 'loss', 'profit_loss_percent': profit_loss}
            elif profit_loss <= -10:  # Default -10% stop if none specified
                return {'status': 'loss', 'profit_loss_percent': profit_loss}
            
            # Still pending/neutral
            return {'status': 'neutral', 'profit_loss_percent': profit_loss}
        
        elif direction == 'short':
            profit_loss = -price_change  # Inverse for shorts
            
            # Check win condition
            if current_price <= target_price:
                return {'status': 'win', 'profit_loss_percent': profit_loss}
            
            # Check loss condition
            if stop_loss and current_price >= stop_loss:
                return {'status': 'loss', 'profit_loss_percent': profit_loss}
            elif price_change >= 10:  # Default +10% stop if none specified
                return {'status': 'loss', 'profit_loss_percent': profit_loss}
            
            # Still pending/neutral
            return {'status': 'neutral', 'profit_loss_percent': profit_loss}
        
        return {'status': 'neutral', 'profit_loss_percent': 0.0}
    
    async def _update_bot_metrics(self):
        """Update aggregate metrics for all bots based on their predictions."""
        # Get all bot names
        bot_names = await self.db.bot_performance.distinct('bot_name')
        
        for bot_name in bot_names:
            # Get all predictions for this bot
            predictions = await self.db.bot_predictions.find({
                'bot_name': bot_name
            }).to_list(10000)
            
            if not predictions:
                continue
            
            # Calculate metrics
            total = len(predictions)
            wins = sum(1 for p in predictions if p.get('outcome_status') == 'win')
            losses = sum(1 for p in predictions if p.get('outcome_status') == 'loss')
            pending = sum(1 for p in predictions if p.get('outcome_status') == 'pending')
            
            accuracy = (wins / (wins + losses) * 100) if (wins + losses) > 0 else 0.0
            
            # Calculate average profit/loss for closed predictions
            closed_predictions = [p for p in predictions if p.get('outcome_status') in ['win', 'loss']]
            avg_pl = sum(p.get('profit_loss_percent', 0) for p in closed_predictions) / len(closed_predictions) if closed_predictions else 0.0
            
            # Update bot performance
            await self.db.bot_performance.update_one(
                {'bot_name': bot_name},
                {
                    '$set': {
                        'total_predictions': total,
                        'successful_predictions': wins,
                        'failed_predictions': losses,
                        'pending_predictions': pending,
                        'accuracy_rate': accuracy,
                        'avg_profit_loss': avg_pl,
                        'last_updated': datetime.now(timezone.utc)
                    }
                }
            )
            
            logger.info(f"📈 {bot_name}: {total} predictions, {accuracy:.1f}% accuracy, {avg_pl:.1f}% avg P/L")
    
    async def _recalculate_weights(self):
        """Recalculate performance weights for all bots based on accuracy and P/L.
        
        Weight Formula:
        - Accuracy >= 60%: weight = 1.0 + (accuracy - 60) / 100 (max 1.4 at 100%)
        - Accuracy < 40%: weight = 0.5 + (accuracy / 80) (min 0.5 at 0%)
        - Between 40-60%: weight = 1.0 (neutral)
        
        Also considers avg P/L:
        - Positive avg P/L: bonus +0.1
        - Negative avg P/L: penalty -0.1
        """
        bot_performances = await self.db.bot_performance.find({}).to_list(1000)
        
        for bot in bot_performances:
            accuracy = bot.get('accuracy_rate', 0.0)
            avg_pl = bot.get('avg_profit_loss', 0.0)
            total_preds = bot.get('total_predictions', 0)
            
            # Need at least 10 predictions to calculate meaningful weight
            if total_preds < 10:
                weight = 1.0
            else:
                # Base weight from accuracy
                if accuracy >= 60:
                    weight = 1.0 + (accuracy - 60) / 100
                elif accuracy < 40:
                    weight = 0.5 + (accuracy / 80)
                else:
                    weight = 1.0
                
                # Adjust for profit/loss performance
                if avg_pl > 5:
                    weight += 0.1
                elif avg_pl < -5:
                    weight -= 0.1
                
                # Clamp weight between 0.5 and 1.5
                weight = max(0.5, min(1.5, weight))
            
            # Update weight
            await self.db.bot_performance.update_one(
                {'bot_name': bot['bot_name']},
                {'$set': {'performance_weight': weight}}
            )
            
            logger.info(f"⚖️ {bot['bot_name']}: weight = {weight:.2f} (accuracy: {accuracy:.1f}%, avg P/L: {avg_pl:.1f}%)")
    
    async def get_bot_performance(self, bot_name: Optional[str] = None) -> List[Dict]:
        """Get performance statistics for bots.
        
        Args:
            bot_name: Optional specific bot name, or None for all bots
            
        Returns:
            List of bot performance dictionaries
        """
        query = {'bot_name': bot_name} if bot_name else {}
        performances = await self.db.bot_performance.find(query).to_list(1000)
        
        # Clean up ObjectIds
        for perf in performances:
            if '_id' in perf:
                del perf['_id']
        
        # Sort by accuracy rate descending
        performances.sort(key=lambda x: x.get('accuracy_rate', 0), reverse=True)
        
        return performances
