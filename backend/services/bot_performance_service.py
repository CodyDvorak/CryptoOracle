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
    
    async def classify_market_regime(self, btc_price_change_7d: float = None, volatility: float = None) -> str:
        """Classify current market regime based on BTC behavior.
        
        Args:
            btc_price_change_7d: 7-day % change in BTC price (if available)
            volatility: Market volatility metric (if available)
            
        Returns:
            Market regime: 'bull_market', 'bear_market', 'high_volatility', 'sideways'
        """
        try:
            btc_historical = None
            
            # If BTC data not provided, fetch it
            if btc_price_change_7d is None:
                btc_historical = await self.crypto_client.get_historical_data('BTC', days=7)
                if btc_historical and len(btc_historical) >= 7:
                    first_price = btc_historical[0][1]  # (timestamp, close)
                    last_price = btc_historical[-1][1]
                    btc_price_change_7d = ((last_price - first_price) / first_price) * 100
                else:
                    # Fallback: use current vs historical
                    all_coins = await self.crypto_client.get_all_coins(max_coins=200)
                    btc_data = next((coin for coin in all_coins if coin[0] == 'BTC'), None)
                    if btc_data:
                        # Estimate based on current price (rough approximation)
                        btc_price_change_7d = 0.0  # Default to sideways if can't determine
                    else:
                        btc_price_change_7d = 0.0
            
            # Ensure btc_price_change_7d has a value
            if btc_price_change_7d is None:
                btc_price_change_7d = 0.0
            
            # Calculate volatility if not provided (using historical data)
            if volatility is None and btc_historical:
                prices = [candle[1] for candle in btc_historical]
                if len(prices) > 1:
                    # Simple volatility: standard deviation / mean
                    import statistics
                    mean_price = statistics.mean(prices)
                    std_dev = statistics.stdev(prices)
                    volatility = (std_dev / mean_price) if mean_price > 0 else 0
                else:
                    volatility = 0.0
            elif volatility is None:
                volatility = 0.0
            
            # Classify regime
            # High volatility takes precedence
            if volatility > 0.10:  # > 10% volatility
                return "high_volatility"
            
            # Bull market: BTC up > 5% in 7 days with low volatility
            if btc_price_change_7d > 5 and volatility < 0.08:
                return "bull_market"
            
            # Bear market: BTC down > 5% in 7 days with low volatility
            if btc_price_change_7d < -5 and volatility < 0.08:
                return "bear_market"
            
            # Everything else is sideways
            return "sideways"
            
        except Exception as e:
            logger.error(f"Error classifying market regime: {e}")
            return "sideways"  # Default to sideways on error
    
    async def save_bot_predictions(self, run_id: str, user_id: Optional[str], bot_results: List[Dict], market_regime: str = None) -> int:
        """Save individual bot predictions for a scan.
        
        Args:
            run_id: Scan run ID
            user_id: User who initiated the scan
            bot_results: List of bot result dictionaries from scan
            market_regime: Current market regime (will classify if not provided)
            
        Returns:
            Number of predictions saved
        """
        try:
            # Classify market regime if not provided
            if market_regime is None:
                market_regime = await self.classify_market_regime()
                logger.info(f"📊 Market regime classified: {market_regime}")
            
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
                        market_regime=market_regime,
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
    
    async def evaluate_predictions(self, hours_old: int = 24, force_close: bool = False) -> Dict:
        """Evaluate pending predictions that are at least X hours old.
        
        IMPROVED (Phase 1 Enhancement):
        - Added time-based forced evaluation at 24h, 48h, 7d
        - Added partial_win tracking
        - Improved logging with detailed breakdown
        
        Args:
            hours_old: Minimum age of predictions to evaluate (default 24h)
            force_close: If True, forces evaluation (no neutral outcomes)
            
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
                return {'evaluated': 0, 'wins': 0, 'partial_wins': 0, 'losses': 0, 'neutral': 0}
            
            logger.info(f"📊 Evaluating {len(pending)} predictions older than {hours_old}h (force_close={force_close})...")
            
            # Get current prices for all unique coins
            unique_symbols = list(set(p['coin_symbol'] for p in pending))
            current_prices = await self._get_current_prices(unique_symbols)
            
            wins = 0
            partial_wins = 0
            losses = 0
            neutral = 0
            
            # Determine if we should force close based on age
            # Force close at 24h, 48h, and 7d (168h)
            should_force_close = force_close or hours_old in [24, 48, 168]
            
            # Evaluate each prediction
            for prediction in pending:
                symbol = prediction['coin_symbol']
                current_price = current_prices.get(symbol)
                
                if current_price is None:
                    logger.warning(f"Could not get price for {symbol}, skipping")
                    continue
                
                # Use improved outcome determination with force_close
                outcome = self._determine_outcome(prediction, current_price, force_close=should_force_close)
                
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
                
                # Count results (including partial wins)
                if outcome['status'] == 'win':
                    wins += 1
                elif outcome['status'] == 'partial_win':
                    partial_wins += 1
                elif outcome['status'] == 'loss':
                    losses += 1
                else:
                    neutral += 1
            
            # Update bot performance metrics
            await self._update_bot_metrics()
            
            # Recalculate performance weights
            await self._recalculate_weights()
            
            logger.info(f"✅ Evaluation complete: {wins} wins, {partial_wins} partial wins, {losses} losses, {neutral} neutral")
            
            return {
                'evaluated': len(pending),
                'wins': wins,
                'partial_wins': partial_wins,
                'losses': losses,
                'neutral': neutral
            }
            
        except Exception as e:
            logger.error(f"Error evaluating predictions: {e}")
            return {'evaluated': 0, 'wins': 0, 'partial_wins': 0, 'losses': 0, 'neutral': 0, 'error': str(e)}
    
    async def _get_current_prices(self, symbols: List[str]) -> Dict[str, float]:
        """Fetch current prices for a list of symbols."""
        prices = {}
        
        # Use CryptoCompare to get current prices
        all_coins = await self.crypto_client.get_all_coins(max_coins=200)
        
        for symbol, name, price in all_coins:
            if symbol in symbols:
                prices[symbol] = price
        
        return prices
    
    def _determine_outcome(self, prediction: Dict, current_price: float, force_close: bool = False) -> Dict:
        """Determine if a prediction was successful.
        
        IMPROVED LOGIC (Phase 1 Enhancement):
        - Tightened default stop loss: -10% → -5%
        - Added partial win detection (50%+ of target)
        - Added force_close parameter for time-based evaluation
        - LONG: Win if >= target, Partial Win if >= 50% of target, Loss if <= stop_loss (or -5% default)
        - SHORT: Win if <= target, Partial Win if <= 50% of target, Loss if >= stop_loss (or +5% default)
        
        Args:
            prediction: Prediction dict with entry, target, stop_loss
            current_price: Current market price
            force_close: If True, forces win/loss/partial_win (no neutral) for time-based eval
        
        Returns:
            Dict with status ('win', 'partial_win', 'loss', 'neutral') and profit_loss_percent
        """
        entry_price = prediction['entry_price']
        target_price = prediction['target_price']
        stop_loss = prediction.get('stop_loss')
        direction = prediction['position_direction']
        
        # Calculate profit/loss percentage
        price_change = ((current_price - entry_price) / entry_price) * 100
        
        if direction == 'long':
            profit_loss = price_change
            
            # Check full win condition
            if current_price >= target_price:
                return {'status': 'win', 'profit_loss_percent': profit_loss}
            
            # Check partial win condition (reached 50%+ of target)
            halfway_to_target = entry_price + (target_price - entry_price) * 0.5
            if current_price >= halfway_to_target:
                return {'status': 'partial_win', 'profit_loss_percent': profit_loss}
            
            # Check loss condition (TIGHTENED: -5% instead of -10%)
            if stop_loss and current_price <= stop_loss:
                return {'status': 'loss', 'profit_loss_percent': profit_loss}
            elif profit_loss <= -5:  # IMPROVED: Default -5% stop (was -10%)
                return {'status': 'loss', 'profit_loss_percent': profit_loss}
            
            # Force close for time-based evaluation
            if force_close:
                # If positive, count as partial win
                if profit_loss > 0:
                    return {'status': 'partial_win', 'profit_loss_percent': profit_loss}
                # If negative but not at SL, still a loss
                else:
                    return {'status': 'loss', 'profit_loss_percent': profit_loss}
            
            # Still pending/neutral
            return {'status': 'neutral', 'profit_loss_percent': profit_loss}
        
        elif direction == 'short':
            profit_loss = -price_change  # Inverse for shorts
            
            # Check full win condition
            if current_price <= target_price:
                return {'status': 'win', 'profit_loss_percent': profit_loss}
            
            # Check partial win condition (reached 50%+ of target)
            halfway_to_target = entry_price - (entry_price - target_price) * 0.5
            if current_price <= halfway_to_target:
                return {'status': 'partial_win', 'profit_loss_percent': profit_loss}
            
            # Check loss condition (TIGHTENED: +5% instead of +10%)
            if stop_loss and current_price >= stop_loss:
                return {'status': 'loss', 'profit_loss_percent': profit_loss}
            elif price_change >= 5:  # IMPROVED: Default +5% stop (was +10%)
                return {'status': 'loss', 'profit_loss_percent': profit_loss}
            
            # Force close for time-based evaluation
            if force_close:
                # If positive, count as partial win
                if profit_loss > 0:
                    return {'status': 'partial_win', 'profit_loss_percent': profit_loss}
                # If negative but not at SL, still a loss
                else:
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
            
            # Calculate metrics (IMPROVED: Count partial wins)
            total = len(predictions)
            wins = sum(1 for p in predictions if p.get('outcome_status') == 'win')
            partial_wins = sum(1 for p in predictions if p.get('outcome_status') == 'partial_win')
            losses = sum(1 for p in predictions if p.get('outcome_status') == 'loss')
            pending = sum(1 for p in predictions if p.get('outcome_status') == 'pending')
            
            # Accuracy calculation: count partial wins as 0.5 wins
            effective_wins = wins + (partial_wins * 0.5)
            accuracy = (effective_wins / (wins + partial_wins + losses) * 100) if (wins + partial_wins + losses) > 0 else 0.0
            
            # Calculate average profit/loss for closed predictions (including partial wins)
            closed_predictions = [p for p in predictions if p.get('outcome_status') in ['win', 'partial_win', 'loss']]
            avg_pl = sum(p.get('profit_loss_percent', 0) for p in closed_predictions) / len(closed_predictions) if closed_predictions else 0.0
            
            # Update bot performance (Phase 1: Added partial_wins)
            await self.db.bot_performance.update_one(
                {'bot_name': bot_name},
                {
                    '$set': {
                        'total_predictions': total,
                        'successful_predictions': wins,
                        'partial_wins': partial_wins,  # Phase 1: Track partial wins
                        'failed_predictions': losses,
                        'pending_predictions': pending,
                        'accuracy_rate': accuracy,
                        'avg_profit_loss': avg_pl,
                        'last_updated': datetime.now(timezone.utc)
                    }
                }
            )
            
            logger.info(f"📈 {bot_name}: {total} predictions ({wins}W/{partial_wins}PW/{losses}L), {accuracy:.1f}% accuracy, {avg_pl:.1f}% avg P/L")
    
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
    
    async def get_system_health(self) -> Dict:
        """Get overall system health metrics.
        
        Returns:
            Dictionary with system health metrics
        """
        try:
            # Get date range of predictions
            oldest_prediction = await self.db.bot_predictions.find_one(
                {},
                sort=[('timestamp', 1)]
            )
            
            newest_prediction = await self.db.bot_predictions.find_one(
                {},
                sort=[('timestamp', -1)]
            )
            
            # Calculate months of data
            months_of_data = 0.0
            if oldest_prediction and newest_prediction:
                time_diff = newest_prediction['timestamp'] - oldest_prediction['timestamp']
                months_of_data = time_diff.days / 30.0
            
            # Get prediction counts
            total_evaluated = await self.db.bot_predictions.count_documents({
                'outcome_status': {'$in': ['win', 'loss']}
            })
            
            total_pending = await self.db.bot_predictions.count_documents({
                'outcome_status': 'pending'
            })
            
            # Calculate weighted average accuracy
            performances = await self.get_bot_performance()
            if performances:
                # Weight by total predictions
                total_weight = sum(p.get('total_predictions', 0) for p in performances)
                if total_weight > 0:
                    weighted_accuracy = sum(
                        p.get('accuracy_rate', 0) * p.get('total_predictions', 0) 
                        for p in performances
                    ) / total_weight
                else:
                    weighted_accuracy = 0.0
            else:
                weighted_accuracy = 0.0
            
            # Calculate trend (compare last 7 days vs previous 7 days)
            seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
            fourteen_days_ago = datetime.now(timezone.utc) - timedelta(days=14)
            
            # Recent performance
            recent_predictions = await self.db.bot_predictions.find({
                'timestamp': {'$gte': seven_days_ago},
                'outcome_status': {'$in': ['win', 'loss']}
            }).to_list(10000)
            
            recent_accuracy = 0.0
            if recent_predictions:
                recent_wins = sum(1 for p in recent_predictions if p['outcome_status'] == 'win')
                recent_accuracy = (recent_wins / len(recent_predictions)) * 100
            
            # Previous period performance
            previous_predictions = await self.db.bot_predictions.find({
                'timestamp': {'$gte': fourteen_days_ago, '$lt': seven_days_ago},
                'outcome_status': {'$in': ['win', 'loss']}
            }).to_list(10000)
            
            previous_accuracy = 0.0
            if previous_predictions:
                previous_wins = sum(1 for p in previous_predictions if p['outcome_status'] == 'win')
                previous_accuracy = (previous_wins / len(previous_predictions)) * 100
            
            # Determine trend
            trend_change = recent_accuracy - previous_accuracy
            if trend_change > 2:
                trend = "improving"
            elif trend_change < -2:
                trend = "declining"
            else:
                trend = "stable"
            
            # Data readiness assessment
            readiness_percent = min(100, (months_of_data / 6.0) * 50 + (total_evaluated / 2000) * 50)
            
            if readiness_percent < 30:
                readiness_status = "not_ready"
            elif readiness_percent < 80:
                readiness_status = "collecting"
            else:
                readiness_status = "ready_for_optimization"
            
            return {
                'months_of_data': round(months_of_data, 1),
                'total_evaluated_predictions': total_evaluated,
                'total_pending_predictions': total_pending,
                'system_accuracy': round(weighted_accuracy, 1),
                'accuracy_trend': trend,
                'trend_change_percent': round(trend_change, 1),
                'data_readiness_status': readiness_status,
                'readiness_percent': round(readiness_percent, 1)
            }
            
        except Exception as e:
            logger.error(f"Error getting system health: {e}")
            return {
                'months_of_data': 0.0,
                'total_evaluated_predictions': 0,
                'total_pending_predictions': 0,
                'system_accuracy': 0.0,
                'accuracy_trend': 'unknown',
                'trend_change_percent': 0.0,
                'data_readiness_status': 'not_ready',
                'readiness_percent': 0.0
            }
    
    async def get_performance_by_regime(self) -> List[Dict]:
        """Get bot performance broken down by market regime.
        
        Returns:
            List of bot performance by regime dictionaries
        """
        try:
            # Get all bot names
            bot_names = await self.db.bot_performance.distinct('bot_name')
            
            regime_performances = []
            
            for bot_name in bot_names:
                # Get predictions for each regime
                bot_data = {
                    'bot_name': bot_name,
                    'bull_market_accuracy': None,
                    'bull_market_predictions': 0,
                    'bear_market_accuracy': None,
                    'bear_market_predictions': 0,
                    'high_volatility_accuracy': None,
                    'high_volatility_predictions': 0,
                    'sideways_accuracy': None,
                    'sideways_predictions': 0,
                    'best_regime': None
                }
                
                best_accuracy = 0.0
                
                for regime in ['bull_market', 'bear_market', 'high_volatility', 'sideways']:
                    predictions = await self.db.bot_predictions.find({
                        'bot_name': bot_name,
                        'market_regime': regime,
                        'outcome_status': {'$in': ['win', 'loss']}
                    }).to_list(10000)
                    
                    if predictions:
                        wins = sum(1 for p in predictions if p['outcome_status'] == 'win')
                        accuracy = (wins / len(predictions)) * 100
                        
                        bot_data[f'{regime}_accuracy'] = round(accuracy, 1)
                        bot_data[f'{regime}_predictions'] = len(predictions)
                        
                        if accuracy > best_accuracy:
                            best_accuracy = accuracy
                            bot_data['best_regime'] = regime.replace('_', ' ').title()
                
                regime_performances.append(bot_data)
            
            return regime_performances
            
        except Exception as e:
            logger.error(f"Error getting performance by regime: {e}")
            return []
    
    async def get_degradation_alerts(self) -> List[Dict]:
        """Get alerts for bots showing performance degradation.
        
        Returns:
            List of degradation alert dictionaries
        """
        try:
            alerts = []
            
            # Get all bots with performance data
            performances = await self.get_bot_performance()
            
            for bot in performances:
                bot_name = bot['bot_name']
                current_accuracy = bot.get('accuracy_rate', 0.0)
                total_preds = bot.get('total_predictions', 0)
                
                # Need at least 20 predictions to check degradation
                if total_preds < 20:
                    continue
                
                # Get recent accuracy (last 30 days)
                thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
                recent_predictions = await self.db.bot_predictions.find({
                    'bot_name': bot_name,
                    'timestamp': {'$gte': thirty_days_ago},
                    'outcome_status': {'$in': ['win', 'loss']}
                }).to_list(1000)
                
                if len(recent_predictions) >= 10:
                    recent_wins = sum(1 for p in recent_predictions if p['outcome_status'] == 'win')
                    recent_accuracy = (recent_wins / len(recent_predictions)) * 100
                    
                    # Compare with historical accuracy
                    accuracy_drop = current_accuracy - recent_accuracy
                    
                    # Critical: dropped >15% or consistently below 40%
                    if accuracy_drop > 15 or recent_accuracy < 40:
                        alerts.append({
                            'bot_name': bot_name,
                            'severity': 'critical',
                            'current_accuracy': round(recent_accuracy, 1),
                            'previous_accuracy': round(current_accuracy, 1),
                            'change_percent': round(-accuracy_drop, 1),
                            'total_predictions': total_preds,
                            'message': f"Accuracy dropped {abs(accuracy_drop):.1f}% (was {current_accuracy:.1f}%, now {recent_accuracy:.1f}%)" if accuracy_drop > 15 else f"Consistently below 40% ({recent_accuracy:.1f}%)"
                        })
                    # Warning: dropped 10-15%
                    elif accuracy_drop > 10:
                        alerts.append({
                            'bot_name': bot_name,
                            'severity': 'warning',
                            'current_accuracy': round(recent_accuracy, 1),
                            'previous_accuracy': round(current_accuracy, 1),
                            'change_percent': round(-accuracy_drop, 1),
                            'total_predictions': total_preds,
                            'message': f"Accuracy dropped {accuracy_drop:.1f}% in last 30 days"
                        })
            
            # Sort by severity (critical first) and then by change percent
            severity_order = {'critical': 0, 'warning': 1, 'info': 2}
            alerts.sort(key=lambda x: (severity_order[x['severity']], -abs(x['change_percent'])))
            
            return alerts
            
        except Exception as e:
            logger.error(f"Error getting degradation alerts: {e}")
            return []
