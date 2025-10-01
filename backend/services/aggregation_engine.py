from typing import List, Dict
import statistics
import logging

logger = logging.getLogger(__name__)

class AggregationEngine:
    """Aggregate bot results and compute Top 5 recommendations."""
    
    @staticmethod
    def aggregate_coin_results(coin: str, bot_results: List[Dict]) -> Dict:
        """Aggregate results from all bots for a single coin.
        
        Args:
            coin: Coin symbol
            bot_results: List of bot analysis results
        
        Returns:
            Aggregated recommendation dict
        """
        if not bot_results:
            return None
        
        # Separate by direction
        long_results = [r for r in bot_results if r.get('direction') == 'long']
        short_results = [r for r in bot_results if r.get('direction') == 'short']
        
        # Determine consensus direction (majority vote)
        consensus_direction = 'long' if len(long_results) >= len(short_results) else 'short'
        
        # Get results matching consensus
        consensus_results = long_results if consensus_direction == 'long' else short_results
        
        if not consensus_results:
            # Fallback: use all results
            consensus_results = bot_results
        
        # Calculate averages
        confidences = [r.get('confidence', 5) for r in bot_results]
        avg_confidence = statistics.mean(confidences)
        
        # For TP/SL, use median of consensus bots to reduce outlier impact
        consensus_tps = [r.get('take_profit', 0) for r in consensus_results if r.get('take_profit', 0) > 0]
        consensus_sls = [r.get('stop_loss', 0) for r in consensus_results if r.get('stop_loss', 0) > 0]
        consensus_entries = [r.get('entry', 0) for r in consensus_results if r.get('entry', 0) > 0]
        
        avg_tp = statistics.median(consensus_tps) if consensus_tps else 0
        avg_sl = statistics.median(consensus_sls) if consensus_sls else 0
        avg_entry = statistics.median(consensus_entries) if consensus_entries else 0
        
        return {
            'coin': coin,
            'consensus_direction': consensus_direction,
            'avg_confidence': avg_confidence,
            'avg_take_profit': avg_tp,
            'avg_stop_loss': avg_sl,
            'avg_entry': avg_entry,
            'bot_count': len(bot_results),
            'long_count': len(long_results),
            'short_count': len(short_results)
        }
    
    @staticmethod
    def get_top_n(aggregated_results: List[Dict], n: int = 5) -> List[Dict]:
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