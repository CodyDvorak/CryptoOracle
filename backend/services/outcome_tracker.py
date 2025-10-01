"""
Outcome Tracker Service
Monitors historical recommendations and updates their success/failure status
by comparing actual coin prices to predicted TP/SL levels.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

class OutcomeTracker:
    """Tracks recommendation outcomes by monitoring actual price movements"""
    
    def __init__(self, db: AsyncIOMotorDatabase, crypto_client):
        self.db = db
        self.crypto_client = crypto_client
    
    async def track_all_pending_recommendations(self):
        """Check all pending recommendations and update their outcomes"""
        logger.info("Starting outcome tracking for pending recommendations...")
        
        try:
            # Find all recommendations without outcome_7d set or still pending
            pending_recs = await self.db.recommendations.find({
                '$or': [
                    {'outcome_7d': None},
                    {'outcome_7d': 'pending'}
                ]
            }).to_list(1000)
            
            logger.info(f"Found {len(pending_recs)} pending recommendations to track")
            
            tracked_count = 0
            success_count = 0
            failed_count = 0
            still_pending = 0
            
            for rec in pending_recs:
                outcome = await self._check_recommendation_outcome(rec)
                
                if outcome:
                    tracked_count += 1
                    if outcome == 'success':
                        success_count += 1
                    elif outcome == 'failed':
                        failed_count += 1
                    else:
                        still_pending += 1
            
            logger.info(f"Outcome tracking complete: {tracked_count} tracked, {success_count} success, {failed_count} failed, {still_pending} still pending")
            
            return {
                'tracked': tracked_count,
                'success': success_count,
                'failed': failed_count,
                'pending': still_pending
            }
            
        except Exception as e:
            logger.error(f"Error tracking outcomes: {e}", exc_info=True)
            return None
    
    async def _check_recommendation_outcome(self, rec: Dict) -> Optional[str]:
        """Check if a recommendation hit TP or SL
        
        Returns:
            'success' if TP hit first
            'failed' if SL hit first
            'pending' if neither hit yet and still within tracking window
            None if beyond tracking window with no conclusion
        """
        try:
            # Get recommendation details
            ticker = rec.get('ticker')
            coin = rec.get('coin')
            direction = rec.get('consensus_direction')
            entry_price = rec.get('avg_entry')
            take_profit = rec.get('avg_take_profit')
            stop_loss = rec.get('avg_stop_loss')
            created_at = rec.get('created_at')
            
            if not all([ticker, direction, entry_price, take_profit, stop_loss]):
                logger.warning(f"Recommendation {rec.get('id')} missing required fields")
                return None
            
            # Calculate time elapsed
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            
            now = datetime.now(timezone.utc)
            time_elapsed = now - created_at
            
            # Only track for 7 days
            if time_elapsed > timedelta(days=7):
                # Beyond tracking window - mark as incomplete
                await self.db.recommendations.update_one(
                    {'id': rec['id']},
                    {'$set': {
                        'outcome_7d': 'expired',
                        'updated_at': now
                    }}
                )
                return 'expired'
            
            # Fetch recent price data for this coin
            try:
                # Get 7 days of hourly data
                historical_data = await self.crypto_client.get_historical_data(ticker, days=7)
                
                if not historical_data or len(historical_data) == 0:
                    logger.warning(f"No historical data available for {ticker}")
                    return 'pending'
                
                # Check if TP or SL was hit
                outcome = self._evaluate_outcome(
                    historical_data, 
                    direction, 
                    entry_price, 
                    take_profit, 
                    stop_loss
                )
                
                if outcome:
                    # Update recommendation with outcome
                    latest_price = historical_data[-1].get('close', entry_price)
                    
                    await self.db.recommendations.update_one(
                        {'id': rec['id']},
                        {'$set': {
                            'outcome_7d': outcome,
                            'actual_price_7d': latest_price,
                            'outcome_checked_at': now,
                            'updated_at': now
                        }}
                    )
                    
                    logger.info(f"Updated {ticker} outcome: {outcome}")
                    return outcome
                else:
                    # Still pending - neither TP nor SL hit
                    return 'pending'
                    
            except Exception as e:
                logger.error(f"Error fetching price data for {ticker}: {e}")
                return 'pending'
                
        except Exception as e:
            logger.error(f"Error checking recommendation outcome: {e}", exc_info=True)
            return None
    
    def _evaluate_outcome(
        self, 
        historical_data: List[Dict], 
        direction: str, 
        entry: float, 
        tp: float, 
        sl: float
    ) -> Optional[str]:
        """Evaluate if TP or SL was hit first
        
        Args:
            historical_data: List of candles with high/low prices
            direction: 'long' or 'short'
            entry: Entry price
            tp: Take profit level
            sl: Stop loss level
        
        Returns:
            'success' if TP hit first, 'failed' if SL hit first, None if neither
        """
        try:
            for candle in historical_data:
                high = candle.get('high', 0)
                low = candle.get('low', 0)
                
                if direction == 'long':
                    # Long position: TP is above entry, SL is below
                    # Check if price hit SL first (low touches or goes below SL)
                    if low <= sl:
                        return 'failed'
                    # Check if price hit TP (high touches or goes above TP)
                    if high >= tp:
                        return 'success'
                        
                elif direction == 'short':
                    # Short position: TP is below entry, SL is above
                    # Check if price hit SL first (high touches or goes above SL)
                    if high >= sl:
                        return 'failed'
                    # Check if price hit TP (low touches or goes below TP)
                    if low <= tp:
                        return 'success'
            
            # Neither TP nor SL hit yet
            return None
            
        except Exception as e:
            logger.error(f"Error evaluating outcome: {e}")
            return None
    
    async def calculate_bot_success_rates(self) -> Dict[str, float]:
        """Calculate success rate for each bot based on historical outcomes
        
        Returns:
            Dict mapping bot_name to success_rate (0-100)
        """
        try:
            # Aggregate bot results by bot name and outcome
            pipeline = [
                {
                    '$lookup': {
                        'from': 'recommendations',
                        'localField': 'run_id',
                        'foreignField': 'run_id',
                        'as': 'rec'
                    }
                },
                {
                    '$unwind': '$rec'
                },
                {
                    '$match': {
                        'rec.outcome_7d': {'$in': ['success', 'failed']},
                        'coin': '$rec.coin'
                    }
                },
                {
                    '$group': {
                        '_id': '$bot_name',
                        'total': {'$sum': 1},
                        'successful': {
                            '$sum': {'$cond': [{'$eq': ['$rec.outcome_7d', 'success']}, 1, 0]}
                        }
                    }
                },
                {
                    '$project': {
                        'bot_name': '$_id',
                        'success_rate': {
                            '$multiply': [
                                {'$divide': ['$successful', '$total']},
                                100
                            ]
                        }
                    }
                }
            ]
            
            results = await self.db.bot_results.aggregate(pipeline).to_list(100)
            
            bot_success_rates = {}
            for result in results:
                bot_name = result.get('_id')
                success_rate = result.get('success_rate', 0)
                bot_success_rates[bot_name] = round(success_rate, 2)
            
            logger.info(f"Calculated success rates for {len(bot_success_rates)} bots")
            return bot_success_rates
            
        except Exception as e:
            logger.error(f"Error calculating bot success rates: {e}", exc_info=True)
            return {}
