from typing import List, Dict
import statistics
import logging

logger = logging.getLogger(__name__)

class AggregationEngine:
    """Aggregate bot results and compute Top 8 recommendations."""
    
    def __init__(self, db=None):
        """Initialize with optional database for performance weight lookup."""
        self.db = db
        self._bot_weights = {}  # Cache for bot weights
    
    async def get_bot_weights(self) -> Dict[str, float]:
        """Fetch bot performance weights from database.
        
        Returns:
            Dict mapping bot_name to performance_weight
        """
        if not self.db:
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
    
    async def aggregate_coin_results(self, coin: str, bot_results: List[Dict], current_price: float) -> Dict:
        """Aggregate results from all bots for a single coin WITH PERFORMANCE WEIGHTING.
        
        Args:
            coin: Coin symbol
            bot_results: List of bot analysis results
            current_price: Current price of the coin
        
        Returns:
            Aggregated recommendation dict
        """
        if not bot_results:
            return None
        
        # Get bot performance weights
        bot_weights = await self.get_bot_weights()
        
        # Apply weights to bot results
        weighted_results = []
        for r in bot_results:
            bot_name = r.get('bot_name', 'Unknown')
            weight = bot_weights.get(bot_name, 1.0)
            
            # Create weighted copy
            weighted_r = r.copy()
            weighted_r['weight'] = weight
            weighted_r['weighted_confidence'] = r.get('confidence', 5) * weight
            weighted_results.append(weighted_r)
        
        # Separate by direction
        long_results = [r for r in weighted_results if r.get('direction') == 'long']
        short_results = [r for r in weighted_results if r.get('direction') == 'short']
        
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