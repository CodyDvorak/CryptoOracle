from typing import List, Dict
import statistics
import logging

logger = logging.getLogger(__name__)

class AggregationEngine:
    """Aggregate bot results with Phase 2 enhancements:
    - Regime-aware bot weighting
    - Confidence gating (≥6 threshold)
    - Strong consensus detection (80%+ agreement)
    - Contrarian agreement amplification
    """

    def __init__(self, db=None):
        """Initialize with optional database for performance weight lookup."""
        self.db = db
        self._bot_weights = {}  # Cache for bot weights
        self.confidence_threshold = 6  # Phase 2: Only consider bots with confidence ≥6
        self.strong_consensus_threshold = 0.8  # Phase 2: 80% agreement threshold
    
    async def get_bot_weights(self) -> Dict[str, float]:
        """Fetch bot performance weights from database.
        
        Returns:
            Dict mapping bot_name to performance_weight
        """
        if self.db is None:
            return {}
        
        # Check cache first
        if self._bot_weights:
            return self._bot_weights
        
        try:
            bot_performances = await self.db.bot_performance.find({}).to_list(1000)
            
            weights = {}
            for perf in bot_performances:
                bot_name = perf.get('bot_name')
                weight = perf.get('performance_weight', 1.0)
                weights[bot_name] = weight
            
            self._bot_weights = weights
            logger.info(f"📊 Loaded performance weights for {len(weights)} bots")
            return weights
            
        except Exception as e:
            logger.warning(f"Could not load bot weights: {e}")
            return {}
    
    async def aggregate_coin_results(self, coin: str, bot_results: List[Dict], current_price: float, market_regime: str = 'SIDEWAYS') -> Dict:
        """Aggregate results from all bots for a single coin WITH PHASE 2 ENHANCEMENTS.

        Phase 2 Features:
        - Confidence gating: Only use bots with confidence ≥6
        - Regime-aware weighting: Boost bot weights based on market regime
        - Strong consensus detection: 80%+ agreement
        - Contrarian amplification: Boost when contrarian bots agree

        Args:
            coin: Coin symbol
            bot_results: List of bot analysis results
            current_price: Current price of the coin
            market_regime: 'BULL', 'BEAR', or 'SIDEWAYS'

        Returns:
            Aggregated recommendation dict
        """
        if not bot_results:
            return None

        # PHASE 2: Confidence Gating - Filter bots with confidence ≥6
        high_confidence_bots = [r for r in bot_results if r.get('confidence', 0) >= self.confidence_threshold]

        if not high_confidence_bots:
            logger.warning(f"{coin}: No bots met confidence threshold ≥{self.confidence_threshold}, using all bots")
            high_confidence_bots = bot_results
        else:
            logger.info(f"{coin}: {len(high_confidence_bots)}/{len(bot_results)} bots passed confidence gate")

        # Get bot performance weights
        bot_weights = await self.get_bot_weights()

        # PHASE 2: Apply regime-aware weights
        weighted_results = []
        for r in high_confidence_bots:
            bot_name = r.get('bot_name', 'Unknown')
            base_weight = bot_weights.get(bot_name, 1.0)

            # Regime-aware weight adjustment
            regime_weight = self._apply_regime_weighting(bot_name, market_regime, base_weight)

            # Create weighted copy
            weighted_r = r.copy()
            weighted_r['weight'] = regime_weight
            weighted_r['weighted_confidence'] = r.get('confidence', 5) * regime_weight
            weighted_results.append(weighted_r)
        
        # Separate by direction
        long_results = [r for r in weighted_results if r.get('direction') == 'long']
        short_results = [r for r in weighted_results if r.get('direction') == 'short']

        # PHASE 2: Detect strong consensus (80%+ agreement)
        consensus_info = self._detect_strong_consensus(
            len(long_results),
            len(short_results),
            len(weighted_results)
        )

        # PHASE 2: Check contrarian agreement
        contrarian_boost = self._check_contrarian_agreement(weighted_results)

        # Weighted consensus: sum of weights (better bots have more influence)
        long_weight = sum(r.get('weight', 1.0) for r in long_results)
        short_weight = sum(r.get('weight', 1.0) for r in short_results)

        consensus_direction = 'long' if long_weight >= short_weight else 'short'

        # Get results matching consensus
        consensus_results = long_results if consensus_direction == 'long' else short_results

        if not consensus_results:
            # Fallback: use all results
            consensus_results = weighted_results

        # Calculate WEIGHTED averages (better bots contribute more)
        total_weight = sum(r.get('weight', 1.0) for r in weighted_results)

        if total_weight > 0:
            # Weighted confidence average
            weighted_confidences = sum(r.get('weighted_confidence', 5) for r in weighted_results)
            avg_confidence = weighted_confidences / total_weight
        else:
            avg_confidence = statistics.mean([r.get('confidence', 5) for r in bot_results])

        # PHASE 2: Apply consensus and contrarian boosts to confidence
        avg_confidence = avg_confidence * consensus_info['confidence_multiplier'] * contrarian_boost
        avg_confidence = min(avg_confidence, 10.0)  # Cap at 10
        
        # For TP/SL, use median of consensus bots to reduce outlier impact
        consensus_tps = [r.get('take_profit', 0) for r in consensus_results if r.get('take_profit', 0) > 0]
        consensus_sls = [r.get('stop_loss', 0) for r in consensus_results if r.get('stop_loss', 0) > 0]
        consensus_entries = [r.get('entry', 0) for r in consensus_results if r.get('entry', 0) > 0]
        
        avg_tp = statistics.median(consensus_tps) if consensus_tps else 0
        avg_sl = statistics.median(consensus_sls) if consensus_sls else 0
        avg_entry = statistics.median(consensus_entries) if consensus_entries else current_price
        
        # Calculate weighted average predicted prices
        def weighted_avg(values_with_weights):
            if not values_with_weights:
                return current_price
            total_w = sum(w for v, w in values_with_weights)
            if total_w == 0:
                return statistics.mean([v for v, w in values_with_weights])
            return sum(v * w for v, w in values_with_weights) / total_w
        
        pred_24h_weighted = [(r.get('predicted_24h', current_price), r.get('weight', 1.0)) 
                             for r in weighted_results if r.get('predicted_24h')]
        pred_48h_weighted = [(r.get('predicted_48h', current_price), r.get('weight', 1.0)) 
                             for r in weighted_results if r.get('predicted_48h')]
        pred_7d_weighted = [(r.get('predicted_7d', current_price), r.get('weight', 1.0)) 
                            for r in weighted_results if r.get('predicted_7d')]
        
        avg_pred_24h = weighted_avg(pred_24h_weighted)
        avg_pred_48h = weighted_avg(pred_48h_weighted)
        avg_pred_7d = weighted_avg(pred_7d_weighted)
        
        # Calculate leverage statistics
        leverages = [r.get('recommended_leverage', 5.0) for r in weighted_results if r.get('recommended_leverage')]
        avg_leverage = statistics.mean(leverages) if leverages else 5.0
        min_leverage = min(leverages) if leverages else 1.0
        max_leverage = max(leverages) if leverages else 10.0
        
        return {
            'coin': coin,
            'current_price': current_price,
            'consensus_direction': consensus_direction,
            'avg_confidence': avg_confidence,  # NOW WEIGHTED!
            'avg_take_profit': avg_tp,
            'avg_stop_loss': avg_sl,
            'avg_entry': avg_entry,
            'avg_predicted_24h': avg_pred_24h,  # NOW WEIGHTED!
            'avg_predicted_48h': avg_pred_48h,  # NOW WEIGHTED!
            'avg_predicted_7d': avg_pred_7d,    # NOW WEIGHTED!
            'avg_leverage': round(avg_leverage, 1),
            'min_leverage': round(min_leverage, 1),
            'max_leverage': round(max_leverage, 1),
            'bot_count': len(bot_results),
            'long_count': len(long_results),
            'short_count': len(short_results),
            'long_weight': round(long_weight, 2),
            'short_weight': round(short_weight, 2)
        }
    
    @staticmethod
    def get_top_n(aggregated_results: List[Dict], n: int = 8) -> List[Dict]:
        """Get top N coins by average confidence.
        
        Args:
            aggregated_results: List of aggregated coin results
            n: Number of top coins to return
        
        Returns:
            Top N coins sorted by confidence
        """
        # Sort by average confidence descending
        sorted_results = sorted(
            aggregated_results,
            key=lambda x: x.get('avg_confidence', 0),
            reverse=True
        )
        
        return sorted_results[:n]
    
    @staticmethod
    def get_top_percent_movers(aggregated_results: List[Dict], n: int = 5) -> List[Dict]:
        """Get top N coins by predicted percentage move (7-day) with minimum confidence filter.
        
        Args:
            aggregated_results: List of aggregated coin results
            n: Number of top coins to return
        
        Returns:
            Top N coins by predicted % change (min confidence 5.0)
        """
        results_with_percent = []
        for result in aggregated_results:
            current = result.get('current_price', 0)
            predicted_7d = result.get('avg_predicted_7d', current)
            confidence = result.get('avg_confidence', 0)
            
            # Only include if confidence >= 5.0 (lowered threshold)
            if current > 0 and confidence >= 5.0:
                percent_change = abs((predicted_7d - current) / current * 100)
                result['predicted_percent_change'] = percent_change
                results_with_percent.append(result)
        
        # Sort by absolute percentage change (biggest movers first)
        sorted_results = sorted(
            results_with_percent,
            key=lambda x: x.get('predicted_percent_change', 0),
            reverse=True
        )
        
        return sorted_results[:n]
    
    @staticmethod
    def get_top_dollar_movers(aggregated_results: List[Dict], n: int = 5) -> List[Dict]:
        """Get top N coins by predicted dollar volume move with minimum confidence filter.
        
        Args:
            aggregated_results: List of aggregated coin results
            n: Number of top coins to return
        
        Returns:
            Top N coins by predicted $ change (min confidence 5.0)
        """
        results_with_volume = []
        for result in aggregated_results:
            current = result.get('current_price', 0)
            predicted_7d = result.get('avg_predicted_7d', current)
            confidence = result.get('avg_confidence', 0)
            
            # Only include if confidence >= 5.0 (lowered threshold)
            if current > 0 and confidence >= 5.0:
                dollar_change = abs(predicted_7d - current)
                result['predicted_dollar_change'] = dollar_change
                results_with_volume.append(result)
        
        # Sort by absolute dollar change (biggest movers first)
        sorted_results = sorted(
            results_with_volume,
            key=lambda x: x.get('predicted_dollar_change', 0),
            reverse=True
        )

        return sorted_results[:n]

    def _apply_regime_weighting(self, bot_name: str, market_regime: str, base_weight: float) -> float:
        """Apply regime-aware weight adjustments to bot performance weights.

        Different bots perform better in different market conditions:
        - BULL market: Trend followers, momentum bots get boost
        - BEAR market: Mean reversion, volatility bots get boost
        - SIDEWAYS: Range trading, oscillator bots get boost

        Args:
            bot_name: Name of the bot
            market_regime: 'BULL', 'BEAR', or 'SIDEWAYS'
            base_weight: Base performance weight from historical data

        Returns:
            Adjusted weight for current market regime
        """
        bull_bots = {
            'TrendFollowerBot', 'MomentumBot', 'BreakoutBot', 'GoldenCrossBot',
            'MovingAverageCrossoverBot', 'ParabolicSARBot', 'Elliott Wave Bot',
            'Order Flow Bot', 'Whale Tracker Bot', 'Social Sentiment Bot'
        }

        bear_bots = {
            'MeanReversionBot', 'RSIBot', 'OverboughtOversoldBot', 'BollingerBandBot',
            'StochasticBot', 'CCI_Bot', 'WilliamsRBot', 'VolumeBot',
            'Options Flow Bot'
        }

        sideways_bots = {
            'RangeTradingBot', 'SupportResistanceBot', 'MeanReversionBot',
            'BollingerBandBot', 'RSIBot', 'StochasticBot', 'Order Flow Bot'
        }

        regime_boost = 1.0

        if market_regime == 'BULL' and bot_name in bull_bots:
            regime_boost = 1.3
        elif market_regime == 'BEAR' and bot_name in bear_bots:
            regime_boost = 1.3
        elif market_regime == 'SIDEWAYS' and bot_name in sideways_bots:
            regime_boost = 1.2

        adjusted_weight = base_weight * regime_boost

        if regime_boost > 1.0:
            logger.debug(f"Regime boost for {bot_name} in {market_regime}: {base_weight:.2f} → {adjusted_weight:.2f}")

        return adjusted_weight

    def _detect_strong_consensus(self, long_count: int, short_count: int, total_count: int) -> Dict:
        """Detect strong consensus (80%+ agreement) and check for contrarian alignment.

        Args:
            long_count: Number of bots voting LONG
            short_count: Number of bots voting SHORT
            total_count: Total number of bots

        Returns:
            Dict with consensus info and confidence boost factor
        """
        if total_count == 0:
            return {'has_strong_consensus': False, 'confidence_multiplier': 1.0}

        long_pct = long_count / total_count
        short_pct = short_count / total_count

        has_strong_consensus = (long_pct >= self.strong_consensus_threshold or
                                short_pct >= self.strong_consensus_threshold)

        confidence_multiplier = 1.0

        if has_strong_consensus:
            consensus_pct = max(long_pct, short_pct)
            confidence_multiplier = 1.0 + (consensus_pct - 0.8) * 0.5

            direction = 'LONG' if long_pct > short_pct else 'SHORT'
            logger.info(f"🎯 STRONG CONSENSUS detected: {consensus_pct*100:.1f}% {direction} " +
                       f"(confidence boost: {confidence_multiplier:.2f}x)")

        return {
            'has_strong_consensus': has_strong_consensus,
            'confidence_multiplier': confidence_multiplier,
            'consensus_pct': max(long_pct, short_pct) if has_strong_consensus else 0,
            'long_pct': long_pct,
            'short_pct': short_pct
        }

    def _check_contrarian_agreement(self, bot_results: List[Dict]) -> float:
        """Check if contrarian bots (mean reversion, overbought/oversold) agree with consensus.

        When contrarian bots agree with the direction, it's a stronger signal.

        Args:
            bot_results: List of bot results

        Returns:
            Confidence boost factor (1.0 = no boost, up to 1.2 = strong boost)
        """
        contrarian_bots = {
            'MeanReversionBot', 'RSIBot', 'OverboughtOversoldBot',
            'StochasticBot', 'CCI_Bot', 'WilliamsRBot'
        }

        contrarian_results = [r for r in bot_results if r.get('bot_name') in contrarian_bots]

        if not contrarian_results:
            return 1.0

        long_contrarians = [r for r in contrarian_results if r.get('direction') == 'long']
        short_contrarians = [r for r in contrarian_results if r.get('direction') == 'short']

        if not contrarian_results:
            return 1.0

        contrarian_agreement = max(len(long_contrarians), len(short_contrarians)) / len(contrarian_results)

        if contrarian_agreement >= 0.75:
            boost = 1.0 + (contrarian_agreement - 0.75) * 0.8
            logger.info(f"🎯 Contrarian alignment detected: {contrarian_agreement*100:.1f}% " +
                       f"(confidence boost: {boost:.2f}x)")
            return boost

        return 1.0