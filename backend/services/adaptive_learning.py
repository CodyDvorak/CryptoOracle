"""
Phase 3: True Adaptive Intelligence

Features:
- Bot parameter optimization based on historical performance
- Reinforcement learning framework for continuous improvement
- Dynamic strategy adjustment based on market feedback
- Performance-based weight auto-tuning
"""

import logging
from typing import Dict, List, Optional
from datetime import datetime, timezone, timedelta
import numpy as np

logger = logging.getLogger(__name__)


class AdaptiveLearningEngine:
    """Adaptive learning system for bot optimization and continuous improvement.

    Uses bot prediction outcomes to automatically adjust:
    1. Bot performance weights
    2. Bot parameters (if supported)
    3. Confidence thresholds
    4. Market regime detection sensitivity
    """

    def __init__(self, db):
        self.db = db
        self.learning_rate = 0.1  # How quickly weights adapt
        self.decay_factor = 0.95  # Decay old performance over time
        logger.info("🧠 Adaptive Learning Engine initialized")

    async def update_bot_weights_from_outcomes(self) -> Dict:
        """Analyze bot prediction outcomes and update performance weights.

        Returns:
            Dict with update summary
        """
        try:
            # Get recent bot predictions (last 30 days)
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=30)
            predictions = await self.db.bot_predictions.find({
                'predicted_at': {'$gte': cutoff_date},
                'outcome_evaluated': True
            }).to_list(10000)

            if not predictions:
                logger.warning("No evaluated predictions found for weight updates")
                return {'updated_bots': 0, 'message': 'No data available'}

            # Group by bot name
            bot_results = {}
            for pred in predictions:
                bot_name = pred.get('bot_name')
                if not bot_name:
                    continue

                if bot_name not in bot_results:
                    bot_results[bot_name] = {
                        'correct': 0,
                        'incorrect': 0,
                        'total': 0,
                        'avg_confidence': 0,
                        'confidence_sum': 0
                    }

                outcome = pred.get('outcome')
                confidence = pred.get('confidence', 5)

                bot_results[bot_name]['total'] += 1
                bot_results[bot_name]['confidence_sum'] += confidence

                if outcome == 'correct':
                    bot_results[bot_name]['correct'] += 1
                elif outcome == 'incorrect':
                    bot_results[bot_name]['incorrect'] += 1

            # Calculate new weights for each bot
            updates = []
            for bot_name, results in bot_results.items():
                if results['total'] < 10:
                    # Need at least 10 predictions to update weights
                    continue

                accuracy = results['correct'] / results['total']
                avg_confidence = results['confidence_sum'] / results['total']

                # Get current weight
                current_perf = await self.db.bot_performance.find_one({'bot_name': bot_name})
                current_weight = current_perf.get('performance_weight', 1.0) if current_perf else 1.0

                # Calculate new weight using exponential moving average
                # High accuracy → increase weight
                # Low accuracy → decrease weight
                target_weight = 0.5 + (accuracy * 1.5)  # Range: 0.5 to 2.0

                new_weight = (self.decay_factor * current_weight +
                             (1 - self.decay_factor) * target_weight)

                # Clamp weight between 0.3 and 2.5
                new_weight = max(0.3, min(new_weight, 2.5))

                # Update database
                await self.db.bot_performance.update_one(
                    {'bot_name': bot_name},
                    {
                        '$set': {
                            'performance_weight': new_weight,
                            'accuracy_30d': accuracy,
                            'total_predictions_30d': results['total'],
                            'updated_at': datetime.now(timezone.utc)
                        }
                    },
                    upsert=True
                )

                updates.append({
                    'bot': bot_name,
                    'old_weight': current_weight,
                    'new_weight': new_weight,
                    'accuracy': accuracy,
                    'predictions': results['total']
                })

                logger.info(f"🔄 {bot_name}: weight {current_weight:.2f} → {new_weight:.2f} " +
                           f"(accuracy: {accuracy*100:.1f}%, n={results['total']})")

            return {
                'updated_bots': len(updates),
                'updates': updates,
                'message': f'Updated weights for {len(updates)} bots'
            }

        except Exception as e:
            logger.error(f"Error updating bot weights: {e}")
            return {'updated_bots': 0, 'error': str(e)}

    async def optimize_confidence_threshold(self) -> Dict:
        """Analyze outcomes to find optimal confidence threshold.

        Returns:
            Recommended confidence threshold and analysis
        """
        try:
            # Get recent predictions
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=30)
            predictions = await self.db.bot_predictions.find({
                'predicted_at': {'$gte': cutoff_date},
                'outcome_evaluated': True
            }).to_list(10000)

            if len(predictions) < 100:
                return {
                    'recommended_threshold': 6,
                    'message': 'Insufficient data for optimization'
                }

            # Test different thresholds (3 to 8)
            threshold_results = {}
            for threshold in range(3, 9):
                filtered = [p for p in predictions if p.get('confidence', 0) >= threshold]

                if not filtered:
                    continue

                correct = sum(1 for p in filtered if p.get('outcome') == 'correct')
                total = len(filtered)
                accuracy = correct / total if total > 0 else 0

                threshold_results[threshold] = {
                    'accuracy': accuracy,
                    'predictions': total,
                    'correct': correct
                }

            # Find threshold with best accuracy (minimum 50 predictions)
            best_threshold = 6
            best_accuracy = 0
            for threshold, results in threshold_results.items():
                if results['predictions'] >= 50 and results['accuracy'] > best_accuracy:
                    best_accuracy = results['accuracy']
                    best_threshold = threshold

            logger.info(f"📊 Optimal confidence threshold: {best_threshold} " +
                       f"(accuracy: {best_accuracy*100:.1f}%)")

            return {
                'recommended_threshold': best_threshold,
                'accuracy': best_accuracy,
                'threshold_analysis': threshold_results,
                'message': f'Optimal threshold: {best_threshold} with {best_accuracy*100:.1f}% accuracy'
            }

        except Exception as e:
            logger.error(f"Error optimizing confidence threshold: {e}")
            return {'recommended_threshold': 6, 'error': str(e)}

    async def identify_best_bots_by_regime(self) -> Dict:
        """Identify which bots perform best in different market regimes.

        Returns:
            Dict mapping regimes to top-performing bots
        """
        try:
            # Get predictions with regime data
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=60)
            predictions = await self.db.bot_predictions.find({
                'predicted_at': {'$gte': cutoff_date},
                'outcome_evaluated': True,
                'market_regime': {'$exists': True}
            }).to_list(10000)

            if len(predictions) < 100:
                return {'message': 'Insufficient data for regime analysis'}

            # Group by regime and bot
            regime_bot_performance = {
                'BULL': {},
                'BEAR': {},
                'SIDEWAYS': {}
            }

            for pred in predictions:
                regime = pred.get('market_regime', 'SIDEWAYS')
                bot_name = pred.get('bot_name')
                outcome = pred.get('outcome')

                if regime not in regime_bot_performance or not bot_name:
                    continue

                if bot_name not in regime_bot_performance[regime]:
                    regime_bot_performance[regime][bot_name] = {
                        'correct': 0,
                        'total': 0
                    }

                regime_bot_performance[regime][bot_name]['total'] += 1
                if outcome == 'correct':
                    regime_bot_performance[regime][bot_name]['correct'] += 1

            # Find top 10 bots for each regime
            regime_leaders = {}
            for regime, bots in regime_bot_performance.items():
                # Calculate accuracy for each bot
                bot_scores = []
                for bot_name, results in bots.items():
                    if results['total'] < 10:
                        continue
                    accuracy = results['correct'] / results['total']
                    bot_scores.append({
                        'bot': bot_name,
                        'accuracy': accuracy,
                        'predictions': results['total']
                    })

                # Sort by accuracy
                bot_scores.sort(key=lambda x: x['accuracy'], reverse=True)
                regime_leaders[regime] = bot_scores[:10]

                logger.info(f"📊 {regime} market top bots:")
                for i, bot in enumerate(regime_leaders[regime][:5], 1):
                    logger.info(f"  {i}. {bot['bot']}: {bot['accuracy']*100:.1f}% " +
                               f"(n={bot['predictions']})")

            return {
                'regime_leaders': regime_leaders,
                'message': 'Regime-specific bot performance identified'
            }

        except Exception as e:
            logger.error(f"Error identifying regime leaders: {e}")
            return {'error': str(e)}

    async def get_adaptive_recommendations(self) -> Dict:
        """Get recommendations for system improvements based on learning.

        Returns:
            Dict with actionable recommendations
        """
        try:
            recommendations = []

            # 1. Check weight update status
            weight_update = await self.update_bot_weights_from_outcomes()
            if weight_update.get('updated_bots', 0) > 0:
                recommendations.append({
                    'type': 'weight_optimization',
                    'action': 'Applied automatic weight updates',
                    'details': f"Updated {weight_update['updated_bots']} bot weights"
                })

            # 2. Check confidence threshold
            threshold_analysis = await self.optimize_confidence_threshold()
            recommended_threshold = threshold_analysis.get('recommended_threshold', 6)
            if recommended_threshold != 6:
                recommendations.append({
                    'type': 'confidence_threshold',
                    'action': f'Consider adjusting confidence threshold to {recommended_threshold}',
                    'details': f"Could improve accuracy to {threshold_analysis.get('accuracy', 0)*100:.1f}%"
                })

            # 3. Identify underperforming bots
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=30)
            bot_perfs = await self.db.bot_performance.find({
                'updated_at': {'$gte': cutoff_date},
                'accuracy_30d': {'$lt': 0.45}
            }).to_list(100)

            if bot_perfs:
                underperformers = [b['bot_name'] for b in bot_perfs]
                recommendations.append({
                    'type': 'underperforming_bots',
                    'action': 'Review underperforming bots',
                    'details': f"{len(underperformers)} bots with <45% accuracy: {', '.join(underperformers[:5])}"
                })

            return {
                'recommendations': recommendations,
                'total': len(recommendations)
            }

        except Exception as e:
            logger.error(f"Error generating adaptive recommendations: {e}")
            return {'error': str(e)}
