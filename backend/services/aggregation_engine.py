from typing import List, Dict
import statistics
import logging

logger = logging.getLogger(__name__)

class AggregationEngine:
    """Aggregate bot results and compute Top 5 recommendations."""
    
    @staticmethod
    def aggregate_coin_results(coin: str, bot_results: List[Dict], current_price: float) -> Dict:
        """Aggregate results from all bots for a single coin.
        
        Args:
            coin: Coin symbol
            bot_results: List of bot analysis results
            current_price: Current price of the coin
        
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
        avg_entry = statistics.median(consensus_entries) if consensus_entries else current_price
        
        # Calculate average predicted prices from ALL bots
        pred_24h_values = [r.get('predicted_24h', current_price) for r in bot_results if r.get('predicted_24h')]
        pred_48h_values = [r.get('predicted_48h', current_price) for r in bot_results if r.get('predicted_48h')]
        pred_7d_values = [r.get('predicted_7d', current_price) for r in bot_results if r.get('predicted_7d')]
        
        avg_pred_24h = statistics.mean(pred_24h_values) if pred_24h_values else current_price
        avg_pred_48h = statistics.mean(pred_48h_values) if pred_48h_values else current_price
        avg_pred_7d = statistics.mean(pred_7d_values) if pred_7d_values else current_price
        
        # Calculate leverage statistics
        leverages = [r.get('recommended_leverage', 5.0) for r in bot_results if r.get('recommended_leverage')]
        avg_leverage = statistics.mean(leverages) if leverages else 5.0
        min_leverage = min(leverages) if leverages else 1.0
        max_leverage = max(leverages) if leverages else 10.0
        
        return {
            'coin': coin,
            'current_price': current_price,
            'consensus_direction': consensus_direction,
            'avg_confidence': avg_confidence,
            'avg_take_profit': avg_tp,
            'avg_stop_loss': avg_sl,
            'avg_entry': avg_entry,
            'avg_predicted_24h': avg_pred_24h,
            'avg_predicted_48h': avg_pred_48h,
            'avg_predicted_7d': avg_pred_7d,
            'avg_leverage': round(avg_leverage, 1),
            'min_leverage': round(min_leverage, 1),
            'max_leverage': round(max_leverage, 1),
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