"""
Market Regime Classifier Service
Phase 2 Enhancement: Detect market conditions (BULL, BEAR, SIDEWAYS)
"""

import logging
from typing import Dict, List, Optional
from datetime import datetime, timezone
import statistics

logger = logging.getLogger(__name__)


class MarketRegimeClassifier:
    """Classifies market regime to help bots adapt their strategies."""
    
    def __init__(self):
        self.current_regime = None
        self.regime_confidence = 0.0
        self.last_update = None
    
    def classify_regime(self, candles: List[Dict], features: Dict) -> Dict:
        """Classify the current market regime based on price action and indicators.
        
        Regimes:
        - BULL: Strong uptrend, higher highs and higher lows
        - BEAR: Strong downtrend, lower highs and lower lows
        - SIDEWAYS: Range-bound, no clear trend
        
        Args:
            candles: Historical OHLCV data
            features: Computed technical indicators
            
        Returns:
            Dict with regime, confidence, and supporting signals
        """
        try:
            if len(candles) < 50:
                return self._default_regime()
            
            # Extract price data
            recent_closes = [c['close'] for c in candles[-50:]]
            current_price = recent_closes[-1]
            
            # Calculate trend signals
            sma_20 = features.get('sma_20', current_price)
            sma_50 = features.get('sma_50', current_price)
            sma_200 = features.get('sma_200', current_price)
            adx = features.get('adx', 20)
            rsi_14 = features.get('rsi_14', 50)
            
            # Signal 1: SMA alignment (trend direction)
            sma_trend_score = self._calculate_sma_trend(current_price, sma_20, sma_50, sma_200)
            
            # Signal 2: Price momentum (recent 20 days)
            momentum_score = self._calculate_momentum(recent_closes[-20:])
            
            # Signal 3: ADX strength (trend vs range)
            trend_strength = self._calculate_trend_strength(adx)
            
            # Signal 4: RSI positioning
            rsi_position = self._calculate_rsi_position(rsi_14)
            
            # Signal 5: Higher highs / Lower lows detection
            structure_score = self._calculate_market_structure(candles[-30:])
            
            # Combine signals
            bull_score = 0
            bear_score = 0
            sideways_score = 0
            
            # SMA trend contribution (40% weight)
            if sma_trend_score > 0.3:
                bull_score += sma_trend_score * 0.4
            elif sma_trend_score < -0.3:
                bear_score += abs(sma_trend_score) * 0.4
            else:
                sideways_score += 0.4
            
            # Momentum contribution (30% weight)
            if momentum_score > 0.02:  # > 2% growth
                bull_score += min(momentum_score * 10, 1.0) * 0.3
            elif momentum_score < -0.02:  # < -2% decline
                bear_score += min(abs(momentum_score) * 10, 1.0) * 0.3
            else:
                sideways_score += 0.3
            
            # Trend strength contribution (15% weight)
            if trend_strength > 0.6:  # Strong trend
                # ADX high, boost whichever trend is winning
                if bull_score > bear_score:
                    bull_score += 0.15
                else:
                    bear_score += 0.15
            else:
                sideways_score += 0.15
            
            # Market structure contribution (15% weight)
            if structure_score > 0.5:
                bull_score += 0.15
            elif structure_score < -0.5:
                bear_score += 0.15
            else:
                sideways_score += 0.15
            
            # Determine regime
            max_score = max(bull_score, bear_score, sideways_score)
            
            if max_score == bull_score and bull_score > 0.6:
                regime = 'BULL'
                confidence = bull_score
            elif max_score == bear_score and bear_score > 0.6:
                regime = 'BEAR'
                confidence = bear_score
            else:
                regime = 'SIDEWAYS'
                confidence = sideways_score
            
            # Store for caching
            self.current_regime = regime
            self.regime_confidence = confidence
            self.last_update = datetime.now(timezone.utc)
            
            logger.info(f"📊 Market Regime: {regime} (confidence: {confidence:.2f})")
            logger.debug(f"   Bull: {bull_score:.2f}, Bear: {bear_score:.2f}, Sideways: {sideways_score:.2f}")
            
            return {
                'regime': regime,
                'confidence': confidence,
                'bull_score': bull_score,
                'bear_score': bear_score,
                'sideways_score': sideways_score,
                'signals': {
                    'sma_trend': sma_trend_score,
                    'momentum': momentum_score,
                    'trend_strength': trend_strength,
                    'rsi_position': rsi_position,
                    'structure': structure_score
                }
            }
            
        except Exception as e:
            logger.error(f"Error classifying regime: {e}")
            return self._default_regime()
    
    def _calculate_sma_trend(self, price: float, sma_20: float, sma_50: float, sma_200: float) -> float:
        """Calculate SMA trend score (-1 to 1).
        
        Returns:
            1.0 = Strong bullish alignment
            -1.0 = Strong bearish alignment
            0.0 = No clear trend
        """
        score = 0.0
        
        # Price above/below SMAs
        if price > sma_20:
            score += 0.33
        else:
            score -= 0.33
        
        if price > sma_50:
            score += 0.33
        else:
            score -= 0.33
        
        if price > sma_200:
            score += 0.34
        else:
            score -= 0.34
        
        return score
    
    def _calculate_momentum(self, recent_closes: List[float]) -> float:
        """Calculate momentum as percentage change over period.
        
        Returns:
            Percentage change (e.g., 0.05 = 5% gain)
        """
        if len(recent_closes) < 2:
            return 0.0
        
        first = recent_closes[0]
        last = recent_closes[-1]
        
        if first == 0:
            return 0.0
        
        return (last - first) / first
    
    def _calculate_trend_strength(self, adx: float) -> float:
        """Calculate trend strength from ADX (0 to 1).
        
        Returns:
            0.0 = Weak/no trend (range-bound)
            1.0 = Very strong trend
        """
        # ADX: 0-25 weak, 25-50 strong, 50+ very strong
        if adx < 20:
            return 0.2
        elif adx < 25:
            return 0.4
        elif adx < 40:
            return 0.7
        else:
            return 1.0
    
    def _calculate_rsi_position(self, rsi: float) -> str:
        """Determine RSI positioning.
        
        Returns:
            'overbought', 'neutral', 'oversold'
        """
        if rsi >= 70:
            return 'overbought'
        elif rsi <= 30:
            return 'oversold'
        else:
            return 'neutral'
    
    def _calculate_market_structure(self, candles: List[Dict]) -> float:
        """Analyze market structure (higher highs vs lower lows).
        
        Returns:
            1.0 = Clear higher highs (bullish structure)
            -1.0 = Clear lower lows (bearish structure)
            0.0 = No clear structure
        """
        if len(candles) < 10:
            return 0.0
        
        highs = [c['high'] for c in candles]
        lows = [c['low'] for c in candles]
        
        # Split into 3 segments and compare
        third = len(candles) // 3
        
        segment1_high = max(highs[:third])
        segment2_high = max(highs[third:2*third])
        segment3_high = max(highs[2*third:])
        
        segment1_low = min(lows[:third])
        segment2_low = min(lows[third:2*third])
        segment3_low = min(lows[2*third:])
        
        # Check for higher highs
        higher_highs = (segment2_high > segment1_high and segment3_high > segment2_high)
        # Check for lower lows
        lower_lows = (segment2_low < segment1_low and segment3_low < segment2_low)
        
        if higher_highs and not lower_lows:
            return 1.0
        elif lower_lows and not higher_highs:
            return -1.0
        elif higher_highs and lower_lows:
            return 0.0  # Expansion (both directions)
        else:
            # Calculate average trend
            high_trend = (segment3_high - segment1_high) / segment1_high if segment1_high > 0 else 0
            low_trend = (segment3_low - segment1_low) / segment1_low if segment1_low > 0 else 0
            
            avg_trend = (high_trend + low_trend) / 2
            return max(-1.0, min(1.0, avg_trend * 10))
    
    def _default_regime(self) -> Dict:
        """Return default regime when classification fails."""
        return {
            'regime': 'SIDEWAYS',
            'confidence': 0.5,
            'bull_score': 0.33,
            'bear_score': 0.33,
            'sideways_score': 0.34,
            'signals': {}
        }
    
    def get_bot_weight_modifier(self, regime: str, bot_type: str) -> float:
        """Get weight modifier for a bot based on current regime.
        
        Args:
            regime: Current market regime (BULL, BEAR, SIDEWAYS)
            bot_type: Bot strategy type (trend_following, mean_reversion, momentum, etc.)
            
        Returns:
            Weight modifier (0.5 to 1.5)
        """
        # Define bot behavior in different regimes
        bot_regime_affinity = {
            'BULL': {
                'trend_following': 1.3,
                'momentum': 1.2,
                'mean_reversion': 0.7,
                'breakout': 1.1,
                'default': 1.0
            },
            'BEAR': {
                'trend_following': 1.3,
                'momentum': 1.2,
                'mean_reversion': 0.7,
                'breakout': 0.8,
                'default': 1.0
            },
            'SIDEWAYS': {
                'trend_following': 0.7,
                'momentum': 0.8,
                'mean_reversion': 1.4,
                'breakout': 0.9,
                'default': 1.0
            }
        }
        
        regime_modifiers = bot_regime_affinity.get(regime, {})
        return regime_modifiers.get(bot_type, regime_modifiers.get('default', 1.0))
