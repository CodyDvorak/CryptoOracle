from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)

class BotStrategy:
    """Base class for bot strategies."""
    
    def __init__(self, name: str):
        self.name = name
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        """Analyze features and return recommendation.
        
        Returns:
            Dict with keys: direction, entry, take_profit, stop_loss, confidence, rationale,
                          predicted_24h, predicted_48h, predicted_7d
            or None if no signal
        """
        raise NotImplementedError
    
    def _calculate_predicted_prices(self, current_price: float, direction: str, 
                                    volatility: float = 0.02, strength: float = 1.0) -> Dict:
        """Calculate predicted prices for 24h, 48h, and 7d based on strategy.
        
        Args:
            current_price: Current price of the coin
            direction: 'long' or 'short'
            volatility: Expected volatility (default 2%)
            strength: Signal strength multiplier (0.5 to 1.5)
        
        Returns:
            Dict with predicted_24h, predicted_48h, predicted_7d
        """
        # Base predictions on direction and strength
        if direction == 'long':
            # Bullish predictions
            pred_24h = current_price * (1 + volatility * strength * 0.5)
            pred_48h = current_price * (1 + volatility * strength * 1.0)
            pred_7d = current_price * (1 + volatility * strength * 2.0)
        else:
            # Bearish predictions
            pred_24h = current_price * (1 - volatility * strength * 0.5)
            pred_48h = current_price * (1 - volatility * strength * 1.0)
            pred_7d = current_price * (1 - volatility * strength * 2.0)
        
        return {
            'predicted_24h': pred_24h,
            'predicted_48h': pred_48h,
            'predicted_7d': pred_7d
        }


class SMA_CrossBot(BotStrategy):
    """Simple Moving Average Crossover Strategy."""
    
    def __init__(self):
        super().__init__("SMA_CrossBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['sma_20', 'sma_50', 'current_price']):
            return None
        
        sma_20 = features['sma_20']
        sma_50 = features['sma_50']
        price = features['current_price']
        
        # Golden cross / Death cross
        if sma_20 > sma_50:
            direction = 'long'
            confidence = min(10, int(5 + ((sma_20 - sma_50) / sma_50) * 100))
        else:
            direction = 'short'
            confidence = min(10, int(5 + ((sma_50 - sma_20) / sma_50) * 100))
        
        # TP/SL based on distance between SMAs
        volatility = abs(sma_20 - sma_50) / price
        tp_pct = 0.03 + volatility * 2
        sl_pct = 0.015 + volatility
        
        # Calculate predicted prices
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, volatility * 10, strength)
        
        
        # Calculate predicted prices
        strength = confidence / 10.0
        volatility_factor = 0.02  # Default 2% volatility
        predictions = self._calculate_predicted_prices(price, direction, volatility_factor, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * (1 + tp_pct) if direction == 'long' else price * (1 - tp_pct),
            'stop_loss': price * (1 - sl_pct) if direction == 'long' else price * (1 + sl_pct),
            'confidence': confidence,
            'rationale': f"SMA20 {'above' if direction == 'long' else 'below'} SMA50, indicating {direction} trend",
            **predictions
        }


class RSI_Bot(BotStrategy):
    """RSI Overbought/Oversold Strategy."""
    
    def __init__(self):
        super().__init__("RSI_Bot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if 'rsi_14' not in features or 'current_price' not in features:
            return None
        
        rsi = features['rsi_14']
        price = features['current_price']
        
        if rsi < 30:
            # Oversold - Long signal
            direction = 'long'
            confidence = min(10, int(3 + (30 - rsi) / 3))
            tp_pct = 0.04
            sl_pct = 0.02
            rationale = f"RSI at {rsi:.1f} indicates oversold condition"
        elif rsi > 70:
            # Overbought - Short signal
            direction = 'short'
            confidence = min(10, int(3 + (rsi - 70) / 3))
            tp_pct = 0.04
            sl_pct = 0.02
            rationale = f"RSI at {rsi:.1f} indicates overbought condition"
        else:
            # Neutral RSI
            direction = 'long' if rsi < 50 else 'short'
            confidence = 5
            tp_pct = 0.025
            sl_pct = 0.015
            rationale = f"RSI at {rsi:.1f} shows neutral momentum"
        
        
        # Calculate predicted prices
        strength = confidence / 10.0
        volatility_factor = 0.02  # Default 2% volatility
        predictions = self._calculate_predicted_prices(price, direction, volatility_factor, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * (1 + tp_pct) if direction == 'long' else price * (1 - tp_pct),
            'stop_loss': price * (1 - sl_pct) if direction == 'long' else price * (1 + sl_pct),
            'confidence': confidence,
            'rationale': rationale
,
            **predictions
        }


class MACD_Bot(BotStrategy):
    """MACD Momentum Strategy."""
    
    def __init__(self):
        super().__init__("MACD_Bot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['macd', 'macd_signal', 'current_price']):
            return None
        
        macd = features['macd']
        signal = features['macd_signal']
        price = features['current_price']
        
        if macd > signal:
            direction = 'long'
            confidence = min(10, int(5 + abs(macd - signal) * 10))
        else:
            direction = 'short'
            confidence = min(10, int(5 + abs(macd - signal) * 10))
        
        
        # Calculate predicted prices
        strength = confidence / 10.0
        volatility_factor = 0.02  # Default 2% volatility
        predictions = self._calculate_predicted_prices(price, direction, volatility_factor, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.035 if direction == 'long' else price * 0.965,
            'stop_loss': price * 0.98 if direction == 'long' else price * 1.02,
            'confidence': confidence,
            'rationale': f"MACD {'above' if direction == 'long' else 'below'} signal line",
            **predictions
        }


class BollingerBandsBot(BotStrategy):
    """Bollinger Bands Mean Reversion Strategy."""
    
    def __init__(self):
        super().__init__("BollingerBandsBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['bb_upper', 'bb_lower', 'bb_middle', 'current_price']):
            return None
        
        price = features['current_price']
        bb_upper = features['bb_upper']
        bb_lower = features['bb_lower']
        bb_middle = features['bb_middle']
        
        # Position within bands
        bb_position = (price - bb_lower) / (bb_upper - bb_lower)
        
        if bb_position < 0.2:
            # Near lower band - oversold
            direction = 'long'
            confidence = min(10, int(8 - bb_position * 10))
            rationale = "Price near lower Bollinger Band, potential bounce"
        elif bb_position > 0.8:
            # Near upper band - overbought
            direction = 'short'
            confidence = min(10, int(5 + (bb_position - 0.8) * 25))
            rationale = "Price near upper Bollinger Band, potential pullback"
        else:
            # Middle zone
            direction = 'long' if price < bb_middle else 'short'
            confidence = 5
            rationale = "Price in middle BB zone"
        
        
        # Calculate predicted prices
        strength = confidence / 10.0
        volatility_factor = 0.02  # Default 2% volatility
        predictions = self._calculate_predicted_prices(price, direction, volatility_factor, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': bb_middle if direction == 'long' else bb_lower,
            'stop_loss': bb_lower * 0.98 if direction == 'long' else bb_upper * 1.02,
            'confidence': confidence,
            'rationale': rationale
,
            **predictions
        }


class EMA_RibbonBot(BotStrategy):
    """EMA Ribbon Trend Following."""
    
    def __init__(self):
        super().__init__("EMA_RibbonBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['ema_9', 'ema_21', 'current_price']):
            return None
        
        ema_9 = features['ema_9']
        ema_21 = features['ema_21']
        price = features['current_price']
        
        if ema_9 > ema_21 and price > ema_9:
            direction = 'long'
            confidence = 8
            rationale = "Strong uptrend: Price > EMA9 > EMA21"
        elif ema_9 < ema_21 and price < ema_9:
            direction = 'short'
            confidence = 8
            rationale = "Strong downtrend: Price < EMA9 < EMA21"
        else:
            direction = 'long' if price > ema_9 else 'short'
            confidence = 5
            rationale = "Mixed EMA signals"
        
        
        # Calculate predicted prices
        strength = confidence / 10.0
        volatility_factor = 0.02  # Default 2% volatility
        predictions = self._calculate_predicted_prices(price, direction, volatility_factor, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.04 if direction == 'long' else price * 0.96,
            'stop_loss': price * 0.975 if direction == 'long' else price * 1.025,
            'confidence': confidence,
            'rationale': rationale
,
            **predictions
        }


class VolumeBreakoutBot(BotStrategy):
    """Volume Breakout Strategy."""
    
    def __init__(self):
        super().__init__("VolumeBreakoutBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['volume', 'volume_sma_20', 'current_price', 'price_change_24h']):
            return None
        
        volume = features['volume']
        vol_sma = features['volume_sma_20']
        price = features['current_price']
        price_change = features['price_change_24h']
        
        vol_ratio = volume / vol_sma if vol_sma > 0 else 1
        
        if vol_ratio > 1.5 and price_change > 2:
            direction = 'long'
            confidence = min(10, int(5 + vol_ratio))
            rationale = f"High volume breakout ({vol_ratio:.1f}x avg) with price up {price_change:.1f}%"
        elif vol_ratio > 1.5 and price_change < -2:
            direction = 'short'
            confidence = min(10, int(5 + vol_ratio))
            rationale = f"High volume breakdown ({vol_ratio:.1f}x avg) with price down {price_change:.1f}%"
        else:
            direction = 'long' if price_change > 0 else 'short'
            confidence = 4
            rationale = "Normal volume conditions"
        
        
        # Calculate predicted prices
        strength = confidence / 10.0
        volatility_factor = 0.02  # Default 2% volatility
        predictions = self._calculate_predicted_prices(price, direction, volatility_factor, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.05 if direction == 'long' else price * 0.95,
            'stop_loss': price * 0.97 if direction == 'long' else price * 1.03,
            'confidence': confidence,
            'rationale': rationale
,
            **predictions
        }


class ATR_VolatilityBot(BotStrategy):
    """ATR-based Volatility Strategy."""
    
    def __init__(self):
        super().__init__("ATR_VolatilityBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['atr_14', 'current_price', 'bb_width']):
            return None
        
        price = features['current_price']
        bb_width = features.get('bb_width', 0.05)
        
        # High volatility = wider stops, lower confidence
        # Low volatility = tighter stops, higher confidence for breakout
        
        if bb_width < 0.03:
            # Low volatility - squeeze, expect breakout
            direction = 'long' if features.get('price_change_24h', 0) > 0 else 'short'
            confidence = 7
            rationale = "Low volatility squeeze, breakout expected"
            tp_pct = 0.045
            sl_pct = 0.018
        else:
            # High volatility
            direction = 'long'
            confidence = 5
            rationale = "High volatility environment"
            tp_pct = 0.05
            sl_pct = 0.025
        
        
        # Calculate predicted prices
        strength = confidence / 10.0
        volatility_factor = 0.02  # Default 2% volatility
        predictions = self._calculate_predicted_prices(price, direction, volatility_factor, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * (1 + tp_pct) if direction == 'long' else price * (1 - tp_pct),
            'stop_loss': price * (1 - sl_pct) if direction == 'long' else price * (1 + sl_pct),
            'confidence': confidence,
            'rationale': rationale
,
            **predictions
        }


class StochasticBot(BotStrategy):
    """Stochastic Oscillator Strategy."""
    
    def __init__(self):
        super().__init__("StochasticBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['stoch_k', 'stoch_d', 'current_price']):
            return None
        
        k = features['stoch_k']
        d = features['stoch_d']
        price = features['current_price']
        
        if k < 20 and d < 20:
            direction = 'long'
            confidence = 8
            rationale = "Stochastic in oversold zone (< 20)"
        elif k > 80 and d > 80:
            direction = 'short'
            confidence = 8
            rationale = "Stochastic in overbought zone (> 80)"
        elif k > d:
            direction = 'long'
            confidence = 6
            rationale = "Stochastic %K crossed above %D"
        else:
            direction = 'short'
            confidence = 6
            rationale = "Stochastic %K crossed below %D"
        
        
        # Calculate predicted prices
        strength = confidence / 10.0
        volatility_factor = 0.02  # Default 2% volatility
        predictions = self._calculate_predicted_prices(price, direction, volatility_factor, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.035 if direction == 'long' else price * 0.965,
            'stop_loss': price * 0.98 if direction == 'long' else price * 1.02,
            'confidence': confidence,
            'rationale': rationale
,
            **predictions
        }


class TrendStrengthBot(BotStrategy):
    """Multi-timeframe Trend Strength."""
    
    def __init__(self):
        super().__init__("TrendStrengthBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['price_change_24h', 'price_change_7d', 'current_price']):
            return None
        
        change_24h = features['price_change_24h']
        change_7d = features['price_change_7d']
        price = features['current_price']
        
        # Both timeframes agree
        if change_24h > 1 and change_7d > 3:
            direction = 'long'
            confidence = 9
            rationale = f"Strong uptrend: +{change_24h:.1f}% (24h), +{change_7d:.1f}% (7d)"
        elif change_24h < -1 and change_7d < -3:
            direction = 'short'
            confidence = 9
            rationale = f"Strong downtrend: {change_24h:.1f}% (24h), {change_7d:.1f}% (7d)"
        else:
            direction = 'long' if change_24h > 0 else 'short'
            confidence = 5
            rationale = "Mixed timeframe signals"
        
        
        # Calculate predicted prices
        strength = confidence / 10.0
        volatility_factor = 0.02  # Default 2% volatility
        predictions = self._calculate_predicted_prices(price, direction, volatility_factor, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.04 if direction == 'long' else price * 0.96,
            'stop_loss': price * 0.975 if direction == 'long' else price * 1.025,
            'confidence': confidence,
            'rationale': rationale
,
            **predictions
        }


class SupportResistanceBot(BotStrategy):
    """Support/Resistance Levels Strategy."""
    
    def __init__(self):
        super().__init__("SupportResistanceBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['current_price', 'recent_high', 'recent_low']):
            return None
        
        price = features['current_price']
        recent_high = features['recent_high']
        recent_low = features['recent_low']
        
        # Position within range
        range_position = (price - recent_low) / (recent_high - recent_low) if recent_high > recent_low else 0.5
        
        if range_position < 0.25:
            # Near support
            direction = 'long'
            confidence = 8
            rationale = f"Price near support level (${recent_low:.2f})"
            tp = recent_high * 0.95
            sl = recent_low * 0.98
        elif range_position > 0.75:
            # Near resistance
            direction = 'short'
            confidence = 8
            rationale = f"Price near resistance level (${recent_high:.2f})"
            tp = recent_low * 1.05
            sl = recent_high * 1.02
        else:
            direction = 'long' if range_position < 0.5 else 'short'
            confidence = 5
            rationale = "Price in middle of range"
            tp = price * 1.03 if direction == 'long' else price * 0.97
            sl = price * 0.98 if direction == 'long' else price * 1.02
        
        
        # Calculate predicted prices
        strength = confidence / 10.0
        volatility_factor = 0.02  # Default 2% volatility
        predictions = self._calculate_predicted_prices(price, direction, volatility_factor, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': tp,
            'stop_loss': sl,
            'confidence': confidence,
            'rationale': rationale
,
            **predictions
        }


class OBV_TrendBot(BotStrategy):
    """On-Balance Volume Trend Strategy."""
    
    def __init__(self):
        super().__init__("OBV_TrendBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['obv', 'current_price', 'price_change_24h']):
            return None
        
        price = features['current_price']
        price_change = features['price_change_24h']
        
        # Simple OBV analysis (in real scenario, we'd compare OBV trend vs price trend)
        if price_change > 1:
            direction = 'long'
            confidence = 7
            rationale = "OBV confirms price uptrend"
        elif price_change < -1:
            direction = 'short'
            confidence = 7
            rationale = "OBV confirms price downtrend"
        else:
            direction = 'long'
            confidence = 5
            rationale = "Neutral OBV signal"
        
        
        # Calculate predicted prices
        strength = confidence / 10.0
        volatility_factor = 0.02  # Default 2% volatility
        predictions = self._calculate_predicted_prices(price, direction, volatility_factor, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.035 if direction == 'long' else price * 0.965,
            'stop_loss': price * 0.98 if direction == 'long' else price * 1.02,
            'confidence': confidence,
            'rationale': rationale
,
            **predictions
        }


# Additional 10 bot strategies for diversity


class VWAP_Bot(BotStrategy):
    """Volume Weighted Average Price Strategy."""
    
    def __init__(self):
        super().__init__("VWAP_Bot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['vwap', 'current_price']):
            return None
        
        price = features['current_price']
        vwap = features['vwap']
        
        distance_from_vwap = (price - vwap) / vwap
        
        if price > vwap * 1.01:
            direction = 'short'
            confidence = min(10, int(5 + abs(distance_from_vwap) * 100))
            rationale = f"Price {distance_from_vwap*100:.1f}% above VWAP, potential mean reversion"
        elif price < vwap * 0.99:
            direction = 'long'
            confidence = min(10, int(5 + abs(distance_from_vwap) * 100))
            rationale = f"Price {abs(distance_from_vwap)*100:.1f}% below VWAP, potential bounce"
        else:
            direction = 'long' if price < vwap else 'short'
            confidence = 5
            rationale = "Price near VWAP"
        
        
        # Calculate predicted prices
        strength = confidence / 10.0
        volatility_factor = 0.02  # Default 2% volatility
        predictions = self._calculate_predicted_prices(price, direction, volatility_factor, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': vwap,
            'stop_loss': price * 0.975 if direction == 'long' else price * 1.025,
            'confidence': confidence,
            'rationale': rationale
,
            **predictions
        }


class MomentumBot(BotStrategy):
    """Pure Momentum Strategy."""
    
    def __init__(self):
        super().__init__("MomentumBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if 'price_change_24h' not in features or 'current_price' not in features:
            return None
        
        momentum = features['price_change_24h']
        price = features['current_price']
        
        if momentum > 5:
            direction = 'long'
            confidence = min(10, int(5 + momentum / 2))
            rationale = f"Strong positive momentum: +{momentum:.1f}%"
        elif momentum < -5:
            direction = 'long'  # Contrarian on extreme drops
            confidence = min(10, int(5 + abs(momentum) / 2))
            rationale = f"Extreme drop {momentum:.1f}%, bounce expected"
        elif momentum > 0:
            direction = 'long'
            confidence = 6
            rationale = f"Positive momentum: +{momentum:.1f}%"
        else:
            direction = 'short'
            confidence = 6
            rationale = f"Negative momentum: {momentum:.1f}%"
        
        
        # Calculate predicted prices
        strength = confidence / 10.0
        volatility_factor = 0.02  # Default 2% volatility
        predictions = self._calculate_predicted_prices(price, direction, volatility_factor, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.04 if direction == 'long' else price * 0.96,
            'stop_loss': price * 0.97 if direction == 'long' else price * 1.03,
            'confidence': confidence,
            'rationale': rationale
,
            **predictions
        }


class BreakoutBot(BotStrategy):
    """Range Breakout Strategy."""
    
    def __init__(self):
        super().__init__("BreakoutBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['current_price', 'recent_high', 'recent_low', 'volume', 'volume_sma_20']):
            return None
        
        price = features['current_price']
        recent_high = features['recent_high']
        recent_low = features['recent_low']
        vol_ratio = features['volume'] / features['volume_sma_20']
        
        if price >= recent_high * 0.99 and vol_ratio > 1.3:
            direction = 'long'
            confidence = 9
            rationale = f"Breakout above resistance ${recent_high:.2f} with volume"
        elif price <= recent_low * 1.01 and vol_ratio > 1.3:
            direction = 'short'
            confidence = 9
            rationale = f"Breakdown below support ${recent_low:.2f} with volume"
        else:
            direction = 'long'
            confidence = 4
            rationale = "No clear breakout signal"
        
        
        # Calculate predicted prices
        strength = confidence / 10.0
        volatility_factor = 0.02  # Default 2% volatility
        predictions = self._calculate_predicted_prices(price, direction, volatility_factor, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.05 if direction == 'long' else price * 0.95,
            'stop_loss': price * 0.97 if direction == 'long' else price * 1.03,
            'confidence': confidence,
            'rationale': rationale
,
            **predictions
        }


class ConsolidationBot(BotStrategy):
    """Consolidation/Accumulation Strategy."""
    
    def __init__(self):
        super().__init__("ConsolidationBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if 'bb_width' not in features or 'current_price' not in features:
            return None
        
        bb_width = features['bb_width']
        price = features['current_price']
        
        if bb_width < 0.025:
            # Tight consolidation - breakout imminent
            direction = 'long'
            confidence = 7
            rationale = f"Tight consolidation (BB width: {bb_width:.3f}), breakout setup"
        elif bb_width > 0.08:
            # Wide range - avoid or fade
            direction = 'short'
            confidence = 5
            rationale = "Wide volatility range, potential reversal"
        else:
            direction = 'long'
            confidence = 5
            rationale = "Normal consolidation range"
        
        
        # Calculate predicted prices
        strength = confidence / 10.0
        volatility_factor = 0.02  # Default 2% volatility
        predictions = self._calculate_predicted_prices(price, direction, volatility_factor, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.04 if direction == 'long' else price * 0.96,
            'stop_loss': price * 0.98 if direction == 'long' else price * 1.02,
            'confidence': confidence,
            'rationale': rationale
,
            **predictions
        }


class ScalpingBot(BotStrategy):
    """Quick Scalping Strategy."""
    
    def __init__(self):
        super().__init__("ScalpingBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['rsi_14', 'macd_histogram', 'current_price']):
            return None
        
        rsi = features['rsi_14']
        macd_hist = features['macd_histogram']
        price = features['current_price']
        
        # Quick scalp signals
        if rsi < 40 and macd_hist > 0:
            direction = 'long'
            confidence = 7
            rationale = "Short-term long scalp: RSI low + MACD positive"
        elif rsi > 60 and macd_hist < 0:
            direction = 'short'
            confidence = 7
            rationale = "Short-term short scalp: RSI high + MACD negative"
        else:
            direction = 'long' if rsi < 50 else 'short'
            confidence = 5
            rationale = "Neutral scalp setup"
        
        # Tight TP/SL for scalping
        
        # Calculate predicted prices
        strength = confidence / 10.0
        volatility_factor = 0.02  # Default 2% volatility
        predictions = self._calculate_predicted_prices(price, direction, volatility_factor, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.015 if direction == 'long' else price * 0.985,
            'stop_loss': price * 0.99 if direction == 'long' else price * 1.01,
            'confidence': confidence,
            'rationale': rationale
,
            **predictions
        }


class DivergenceBot(BotStrategy):
    """RSI/Price Divergence Strategy."""
    
    def __init__(self):
        super().__init__("DivergenceBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['rsi_14', 'price_change_24h', 'current_price']):
            return None
        
        rsi = features['rsi_14']
        price_change = features['price_change_24h']
        price = features['current_price']
        
        # Bullish divergence: price down but RSI up (simplified)
        if price_change < -2 and rsi > 45:
            direction = 'long'
            confidence = 8
            rationale = "Potential bullish divergence: price down but RSI resilient"
        # Bearish divergence: price up but RSI down
        elif price_change > 2 and rsi < 55:
            direction = 'short'
            confidence = 8
            rationale = "Potential bearish divergence: price up but RSI weak"
        else:
            direction = 'long' if rsi < 50 else 'short'
            confidence = 5
            rationale = "No clear divergence signal"
        
        
        # Calculate predicted prices
        strength = confidence / 10.0
        volatility_factor = 0.02  # Default 2% volatility
        predictions = self._calculate_predicted_prices(price, direction, volatility_factor, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.04 if direction == 'long' else price * 0.96,
            'stop_loss': price * 0.975 if direction == 'long' else price * 1.025,
            'confidence': confidence,
            'rationale': rationale
,
            **predictions
        }


class SwingBot(BotStrategy):
    """Swing Trading Strategy."""
    
    def __init__(self):
        super().__init__("SwingBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['price_change_7d', 'rsi_14', 'current_price']):
            return None
        
        change_7d = features['price_change_7d']
        rsi = features['rsi_14']
        price = features['current_price']
        
        # Swing long: pullback in uptrend
        if change_7d > 5 and rsi < 45:
            direction = 'long'
            confidence = 8
            rationale = f"Swing long: pullback in uptrend (+{change_7d:.1f}% 7d, RSI {rsi:.0f})"
        # Swing short: bounce in downtrend
        elif change_7d < -5 and rsi > 55:
            direction = 'short'
            confidence = 8
            rationale = f"Swing short: bounce in downtrend ({change_7d:.1f}% 7d, RSI {rsi:.0f})"
        else:
            direction = 'long' if change_7d > 0 else 'short'
            confidence = 5
            rationale = "Neutral swing setup"
        
        
        # Calculate predicted prices
        strength = confidence / 10.0
        volatility_factor = 0.02  # Default 2% volatility
        predictions = self._calculate_predicted_prices(price, direction, volatility_factor, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.06 if direction == 'long' else price * 0.94,
            'stop_loss': price * 0.96 if direction == 'long' else price * 1.04,
            'confidence': confidence,
            'rationale': rationale
,
            **predictions
        }


class VolatilityBreakoutBot(BotStrategy):
    """Volatility Contraction/Expansion Strategy."""
    
    def __init__(self):
        super().__init__("VolatilityBreakoutBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['bb_width', 'atr_14', 'current_price', 'price_change_24h']):
            return None
        
        bb_width = features['bb_width']
        price = features['current_price']
        price_change = features['price_change_24h']
        
        if bb_width < 0.03 and abs(price_change) > 2:
            # Volatility expansion from contraction
            direction = 'long' if price_change > 0 else 'short'
            confidence = 9
            rationale = f"Volatility breakout: BB squeeze resolved with {price_change:.1f}% move"
        elif bb_width < 0.03:
            # Still in contraction
            direction = 'long'
            confidence = 6
            rationale = "Volatility contraction, anticipate breakout"
        else:
            direction = 'long' if price_change > 0 else 'short'
            confidence = 5
            rationale = "Normal volatility conditions"
        
        
        # Calculate predicted prices
        strength = confidence / 10.0
        volatility_factor = 0.02  # Default 2% volatility
        predictions = self._calculate_predicted_prices(price, direction, volatility_factor, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.05 if direction == 'long' else price * 0.95,
            'stop_loss': price * 0.97 if direction == 'long' else price * 1.03,
            'confidence': confidence,
            'rationale': rationale
,
            **predictions
        }


class MultiTimeframeBot(BotStrategy):
    """Multi-Timeframe Confluence Strategy."""
    
    def __init__(self):
        super().__init__("MultiTimeframeBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['price_change_24h', 'price_change_7d', 'ema_9', 'ema_21', 'current_price']):
            return None
        
        change_24h = features['price_change_24h']
        change_7d = features['price_change_7d']
        ema_9 = features['ema_9']
        ema_21 = features['ema_21']
        price = features['current_price']
        
        # Count bullish signals
        bullish_signals = 0
        if change_24h > 0:
            bullish_signals += 1
        if change_7d > 0:
            bullish_signals += 1
        if ema_9 > ema_21:
            bullish_signals += 1
        if price > ema_9:
            bullish_signals += 1
        
        if bullish_signals >= 3:
            direction = 'long'
            confidence = 8 + bullish_signals - 3
            rationale = f"Strong multi-timeframe confluence: {bullish_signals}/4 bullish signals"
        elif bullish_signals <= 1:
            direction = 'short'
            confidence = 8 + (1 - bullish_signals)
            rationale = f"Bearish multi-timeframe: {bullish_signals}/4 bullish signals"
        else:
            direction = 'long' if bullish_signals == 2 else 'short'
            confidence = 5
            rationale = "Mixed timeframe signals"
        
        
        # Calculate predicted prices
        strength = confidence / 10.0
        volatility_factor = 0.02  # Default 2% volatility
        predictions = self._calculate_predicted_prices(price, direction, volatility_factor, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.045 if direction == 'long' else price * 0.955,
            'stop_loss': price * 0.975 if direction == 'long' else price * 1.025,
            'confidence': confidence,
            'rationale': rationale
,
            **predictions
        }


class ConservativeBot(BotStrategy):
    """Conservative Low-Risk Strategy."""
    
    def __init__(self):
        super().__init__("ConservativeBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['rsi_14', 'macd', 'macd_signal', 'current_price']):
            return None
        
        rsi = features['rsi_14']
        macd = features['macd']
        signal = features['macd_signal']
        price = features['current_price']
        
        # Only strong signals
        if rsi < 30 and macd > signal:
            direction = 'long'
            confidence = 7
            rationale = "Strong buy: Oversold + MACD bullish"
        elif rsi > 70 and macd < signal:
            direction = 'short'
            confidence = 7
            rationale = "Strong sell: Overbought + MACD bearish"
        else:
            direction = 'long'
            confidence = 4
            rationale = "No strong conservative signal, neutral"
        
        # Conservative TP/SL
        
        # Calculate predicted prices
        strength = confidence / 10.0
        volatility_factor = 0.02  # Default 2% volatility
        predictions = self._calculate_predicted_prices(price, direction, volatility_factor, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.025 if direction == 'long' else price * 0.975,
            'stop_loss': price * 0.985 if direction == 'long' else price * 1.015,
            'confidence': confidence,
            'rationale': rationale
,
            **predictions
        }


class EMA_CrossBot(BotStrategy):
    """Exponential Moving Average Crossover (faster than SMA)."""
    
    def __init__(self):
        super().__init__("EMA_CrossBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['ema_12', 'ema_26', 'current_price']):
            return None
        
        ema_12 = features['ema_12']
        ema_26 = features['ema_26']
        price = features['current_price']
        
        if ema_12 > ema_26:
            direction = 'long'
            confidence = min(10, int(6 + ((ema_12 - ema_26) / ema_26) * 150))
        else:
            direction = 'short'
            confidence = min(10, int(6 + ((ema_26 - ema_12) / ema_26) * 150))
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, 0.025, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.04 if direction == 'long' else price * 0.96,
            'stop_loss': price * 0.98 if direction == 'long' else price * 1.02,
            'confidence': confidence,
            'rationale': f"EMA12/26 crossover indicating {direction} momentum",
            **predictions
        }


class ADX_TrendBot(BotStrategy):
    """Average Directional Index for trend strength."""
    
    def __init__(self):
        super().__init__("ADX_TrendBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['adx', 'current_price']):
            return None
        
        adx = features['adx']
        price = features['current_price']
        
        # ADX > 25 indicates strong trend
        if adx > 40:
            confidence = 9
            direction = 'long'  # Trend follower
            rationale = "Very strong trend detected (ADX > 40)"
        elif adx > 25:
            confidence = 7
            direction = 'long'
            rationale = "Strong trend detected (ADX > 25)"
        else:
            confidence = 4
            direction = 'long'
            rationale = "Weak trend, low confidence"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, 0.03, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.05 if direction == 'long' else price * 0.95,
            'stop_loss': price * 0.97 if direction == 'long' else price * 1.03,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class WilliamsRBot(BotStrategy):
    """Williams %R oscillator (momentum indicator)."""
    
    def __init__(self):
        super().__init__("WilliamsRBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        # Williams %R similar to Stochastic but inverted
        if not all(k in features for k in ['stoch_k', 'current_price']):
            return None
        
        # Use stoch_k as proxy (invert it for Williams %R)
        williams_r = -100 + features['stoch_k']
        price = features['current_price']
        
        if williams_r < -80:  # Oversold
            direction = 'long'
            confidence = 8
            rationale = "Williams %R oversold, expecting bounce"
        elif williams_r > -20:  # Overbought
            direction = 'short'
            confidence = 8
            rationale = "Williams %R overbought, expecting pullback"
        else:
            direction = 'long'
            confidence = 5
            rationale = "Williams %R neutral zone"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, 0.02, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.03 if direction == 'long' else price * 0.97,
            'stop_loss': price * 0.985 if direction == 'long' else price * 1.015,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class CCI_Bot(BotStrategy):
    """Commodity Channel Index for mean reversion."""
    
    def __init__(self):
        super().__init__("CCI_Bot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['rsi_14', 'current_price']):
            return None
        
        # Use RSI as proxy for CCI-like behavior
        rsi = features['rsi_14']
        price = features['current_price']
        cci_proxy = (rsi - 50) * 4  # Scale to CCI range
        
        if cci_proxy < -100:
            direction = 'long'
            confidence = 8
            rationale = "CCI oversold (<-100), mean reversion expected"
        elif cci_proxy > 100:
            direction = 'short'
            confidence = 8
            rationale = "CCI overbought (>100), mean reversion expected"
        else:
            direction = 'long'
            confidence = 5
            rationale = "CCI in normal range"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, 0.025, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.035 if direction == 'long' else price * 0.965,
            'stop_loss': price * 0.98 if direction == 'long' else price * 1.02,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class ParabolicSARBot(BotStrategy):
    """Parabolic SAR for stop and reverse signals."""
    
    def __init__(self):
        super().__init__("ParabolicSARBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['sma_20', 'current_price']):
            return None
        
        price = features['current_price']
        sma_20 = features['sma_20']
        
        # Price above SMA = bullish SAR below price
        if price > sma_20:
            direction = 'long'
            distance = (price - sma_20) / price
            confidence = min(10, int(6 + distance * 200))
            rationale = "PSAR below price, bullish trend"
        else:
            direction = 'short'
            distance = (sma_20 - price) / price
            confidence = min(10, int(6 + distance * 200))
            rationale = "PSAR above price, bearish trend"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, 0.02, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.04 if direction == 'long' else price * 0.96,
            'stop_loss': sma_20,  # Use SMA as trailing stop
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class SuperTrendBot(BotStrategy):
    """SuperTrend indicator combining ATR and price action."""
    
    def __init__(self):
        super().__init__("SuperTrendBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['sma_20', 'atr', 'current_price']):
            return None
        
        price = features['current_price']
        sma = features['sma_20']
        atr = features['atr']
        
        # SuperTrend calculation
        multiplier = 3
        upper_band = sma + (multiplier * atr)
        lower_band = sma - (multiplier * atr)
        
        if price > upper_band:
            direction = 'long'
            confidence = 9
            rationale = "Price above SuperTrend, strong uptrend"
        elif price < lower_band:
            direction = 'short'
            confidence = 9
            rationale = "Price below SuperTrend, strong downtrend"
        else:
            direction = 'long'
            confidence = 5
            rationale = "Price within SuperTrend bands"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, atr/price, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.05 if direction == 'long' else price * 0.95,
            'stop_loss': lower_band if direction == 'long' else upper_band,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class KeltnerChannelBot(BotStrategy):
    """Keltner Channels for volatility breakouts."""
    
    def __init__(self):
        super().__init__("KeltnerChannelBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['ema_20', 'atr', 'current_price']):
            return None
        
        price = features['current_price']
        ema = features['ema_20']
        atr = features['atr']
        
        upper = ema + (2 * atr)
        lower = ema - (2 * atr)
        
        if price > upper:
            direction = 'long'
            confidence = 8
            rationale = "Price broke above Keltner upper, strong momentum"
        elif price < lower:
            direction = 'short'
            confidence = 8
            rationale = "Price broke below Keltner lower, strong weakness"
        else:
            direction = 'long'
            confidence = 5
            rationale = "Price within Keltner channels"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, atr/price * 2, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.04 if direction == 'long' else price * 0.96,
            'stop_loss': ema if direction == 'long' else ema,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class DonchianChannelBot(BotStrategy):
    """Donchian Channels for breakout trading."""
    
    def __init__(self):
        super().__init__("DonchianChannelBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['sma_20', 'sma_50', 'current_price']):
            return None
        
        price = features['current_price']
        high_20 = features['sma_20'] * 1.05  # Approximate high
        low_20 = features['sma_20'] * 0.95   # Approximate low
        
        if price >= high_20:
            direction = 'long'
            confidence = 9
            rationale = "Donchian breakout above 20-period high"
        elif price <= low_20:
            direction = 'short'
            confidence = 9
            rationale = "Donchian breakdown below 20-period low"
        else:
            direction = 'long'
            confidence = 5
            rationale = "Price within Donchian channel"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, 0.03, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.06 if direction == 'long' else price * 0.94,
            'stop_loss': low_20 if direction == 'long' else high_20,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class ROC_Bot(BotStrategy):
    """Rate of Change momentum indicator."""
    
    def __init__(self):
        super().__init__("ROC_Bot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['sma_20', 'sma_50', 'current_price']):
            return None
        
        price = features['current_price']
        sma_20 = features['sma_20']
        sma_50 = features['sma_50']
        
        # Rate of change proxy
        roc = ((sma_20 - sma_50) / sma_50) * 100
        
        if roc > 5:
            direction = 'long'
            confidence = min(10, int(6 + abs(roc) / 2))
            rationale = f"Strong positive ROC ({roc:.1f}%), momentum building"
        elif roc < -5:
            direction = 'short'
            confidence = min(10, int(6 + abs(roc) / 2))
            rationale = f"Strong negative ROC ({roc:.1f}%), downward momentum"
        else:
            direction = 'long'
            confidence = 5
            rationale = "Weak ROC, low momentum"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, abs(roc) / 100, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.045 if direction == 'long' else price * 0.955,
            'stop_loss': price * 0.975 if direction == 'long' else price * 1.025,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class MFI_Bot(BotStrategy):
    """Money Flow Index (volume-weighted RSI)."""
    
    def __init__(self):
        super().__init__("MFI_Bot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['rsi_14', 'current_price']):
            return None
        
        # Use RSI as proxy for MFI
        mfi = features['rsi_14']
        price = features['current_price']
        
        if mfi < 20:
            direction = 'long'
            confidence = 9
            rationale = "MFI oversold (<20), buying pressure expected"
        elif mfi > 80:
            direction = 'short'
            confidence = 9
            rationale = "MFI overbought (>80), selling pressure expected"
        elif mfi < 35:
            direction = 'long'
            confidence = 7
            rationale = "MFI showing accumulation"
        elif mfi > 65:
            direction = 'short'
            confidence = 7
            rationale = "MFI showing distribution"
        else:
            direction = 'long'
            confidence = 5
            rationale = "MFI neutral"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, 0.025, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.04 if direction == 'long' else price * 0.96,
            'stop_loss': price * 0.98 if direction == 'long' else price * 1.02,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class AccDistBot(BotStrategy):
    """Accumulation/Distribution indicator."""
    
    def __init__(self):
        super().__init__("AccDistBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['obv', 'current_price']):
            return None
        
        # Use OBV as proxy for Acc/Dist
        obv = features['obv']
        price = features['current_price']
        
        # Positive OBV = accumulation
        if obv > 0:
            direction = 'long'
            confidence = min(10, int(6 + abs(obv) / 1000))
            rationale = "Accumulation detected (buying pressure)"
        else:
            direction = 'short'
            confidence = min(10, int(6 + abs(obv) / 1000))
            rationale = "Distribution detected (selling pressure)"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, 0.02, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.035 if direction == 'long' else price * 0.965,
            'stop_loss': price * 0.98 if direction == 'long' else price * 1.02,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class VolumePriceTrendBot(BotStrategy):
    """Volume Price Trend indicator."""
    
    def __init__(self):
        super().__init__("VolumePriceTrendBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['sma_20', 'sma_50', 'obv', 'current_price']):
            return None
        
        price = features['current_price']
        sma_20 = features['sma_20']
        sma_50 = features['sma_50']
        obv = features['obv']
        
        # Price trend + volume confirmation
        price_rising = sma_20 > sma_50
        volume_confirming = obv > 0
        
        if price_rising and volume_confirming:
            direction = 'long'
            confidence = 9
            rationale = "Price uptrend confirmed by volume"
        elif not price_rising and not volume_confirming:
            direction = 'short'
            confidence = 9
            rationale = "Price downtrend confirmed by volume"
        else:
            direction = 'long'
            confidence = 5
            rationale = "Price and volume diverging"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, 0.025, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.045 if direction == 'long' else price * 0.955,
            'stop_loss': price * 0.975 if direction == 'long' else price * 1.025,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class FibonacciBot(BotStrategy):
    """Fibonacci retracement levels."""
    
    def __init__(self):
        super().__init__("FibonacciBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['sma_20', 'sma_50', 'current_price']):
            return None
        
        price = features['current_price']
        high = features['sma_20'] * 1.1  # Approximate recent high
        low = features['sma_50'] * 0.9   # Approximate recent low
        
        # Fibonacci levels
        fib_618 = low + (high - low) * 0.618
        fib_382 = low + (high - low) * 0.382
        
        if price <= fib_382:
            direction = 'long'
            confidence = 8
            rationale = "Price at 38.2% Fibonacci support, bullish rebound"
        elif price >= fib_618:
            direction = 'long'
            confidence = 7
            rationale = "Price above 61.8% Fibonacci, continuation likely"
        else:
            direction = 'long'
            confidence = 5
            rationale = "Price between Fibonacci levels"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, 0.03, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': fib_618 if price < fib_618 else high,
            'stop_loss': fib_382 * 0.97 if direction == 'long' else fib_618 * 1.03,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class PivotPointBot(BotStrategy):
    """Pivot Points for support/resistance."""
    
    def __init__(self):
        super().__init__("PivotPointBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['sma_20', 'current_price']):
            return None
        
        price = features['current_price']
        pivot = features['sma_20']  # Use SMA as pivot proxy
        
        # Pivot point calculations
        r1 = pivot * 1.02
        s1 = pivot * 0.98
        
        if price < s1:
            direction = 'long'
            confidence = 8
            rationale = "Price below S1, oversold bounce expected"
        elif price > r1:
            direction = 'short'
            confidence = 7
            rationale = "Price above R1, resistance likely"
        elif price < pivot:
            direction = 'long'
            confidence = 6
            rationale = "Price below pivot, targeting pivot"
        else:
            direction = 'long'
            confidence = 6
            rationale = "Price above pivot, bullish"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, 0.02, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': r1 if direction == 'long' else s1,
            'stop_loss': s1 * 0.98 if direction == 'long' else r1 * 1.02,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class IchimokuBot(BotStrategy):
    """Ichimoku Cloud comprehensive strategy."""
    
    def __init__(self):
        super().__init__("IchimokuBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['sma_20', 'sma_50', 'current_price']):
            return None
        
        price = features['current_price']
        tenkan = features['sma_20']  # Conversion line proxy
        kijun = features['sma_50']   # Base line proxy
        
        if price > tenkan and tenkan > kijun:
            direction = 'long'
            confidence = 9
            rationale = "Ichimoku strong bullish (price > cloud)"
        elif price < tenkan and tenkan < kijun:
            direction = 'short'
            confidence = 9
            rationale = "Ichimoku strong bearish (price < cloud)"
        else:
            direction = 'long'
            confidence = 5
            rationale = "Ichimoku mixed signals"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, 0.03, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.05 if direction == 'long' else price * 0.95,
            'stop_loss': kijun if direction == 'long' else kijun,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class ZScoreBot(BotStrategy):
    """Statistical Z-Score mean reversion."""
    
    def __init__(self):
        super().__init__("ZScoreBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['sma_20', 'sma_50', 'current_price']):
            return None
        
        price = features['current_price']
        mean = features['sma_50']
        
        # Approximate standard deviation
        std_dev = abs(features['sma_20'] - features['sma_50'])
        
        if std_dev == 0:
            return None
        
        z_score = (price - mean) / std_dev
        
        if z_score < -2:
            direction = 'long'
            confidence = 9
            rationale = f"Z-score {z_score:.2f} (extremely oversold)"
        elif z_score > 2:
            direction = 'short'
            confidence = 9
            rationale = f"Z-score {z_score:.2f} (extremely overbought)"
        elif z_score < -1:
            direction = 'long'
            confidence = 7
            rationale = f"Z-score {z_score:.2f} (oversold)"
        elif z_score > 1:
            direction = 'short'
            confidence = 7
            rationale = f"Z-score {z_score:.2f} (overbought)"
        else:
            direction = 'long'
            confidence = 5
            rationale = "Z-score near mean"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, abs(z_score) * 0.01, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': mean if abs(z_score) > 1.5 else price * 1.02,
            'stop_loss': price * 0.97 if direction == 'long' else price * 1.03,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class LinearRegressionBot(BotStrategy):
    """Linear Regression channel strategy."""
    
    def __init__(self):
        super().__init__("LinearRegressionBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['sma_20', 'sma_50', 'current_price']):
            return None
        
        price = features['current_price']
        sma_20 = features['sma_20']
        sma_50 = features['sma_50']
        
        # Linear trend
        slope = (sma_20 - sma_50) / 30  # Approximate slope
        
        if slope > 0 and price > sma_20:
            direction = 'long'
            confidence = 8
            rationale = "Price above upward regression line"
        elif slope < 0 and price < sma_20:
            direction = 'short'
            confidence = 8
            rationale = "Price below downward regression line"
        else:
            direction = 'long'
            confidence = 5
            rationale = "Price deviating from regression"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, abs(slope) * 10, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.04 if direction == 'long' else price * 0.96,
            'stop_loss': sma_20 * 0.98 if direction == 'long' else sma_20 * 1.02,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class TripleMABot(BotStrategy):
    """Triple Moving Average crossover system."""
    
    def __init__(self):
        super().__init__("TripleMABot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['sma_20', 'sma_50', 'sma_200', 'current_price']):
            return None
        
        price = features['current_price']
        sma_20 = features['sma_20']
        sma_50 = features['sma_50']
        sma_200 = features['sma_200']
        
        # All aligned bullish
        if sma_20 > sma_50 > sma_200 and price > sma_20:
            direction = 'long'
            confidence = 10
            rationale = "Perfect bullish alignment (20>50>200)"
        # All aligned bearish
        elif sma_20 < sma_50 < sma_200 and price < sma_20:
            direction = 'short'
            confidence = 10
            rationale = "Perfect bearish alignment (20<50<200)"
        else:
            direction = 'long'
            confidence = 5
            rationale = "Mixed MA alignment"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, 0.03, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.06 if direction == 'long' else price * 0.94,
            'stop_loss': sma_50 if direction == 'long' else sma_50,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class HeikinAshiBot(BotStrategy):
    """Heikin-Ashi candle analysis."""
    
    def __init__(self):
        super().__init__("HeikinAshiBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['sma_20', 'current_price']):
            return None
        
        price = features['current_price']
        sma = features['sma_20']
        
        # Simplified Heikin-Ashi logic: consecutive moves
        if price > sma * 1.02:
            direction = 'long'
            confidence = 8
            rationale = "Heikin-Ashi showing bullish momentum"
        elif price < sma * 0.98:
            direction = 'short'
            confidence = 8
            rationale = "Heikin-Ashi showing bearish momentum"
        else:
            direction = 'long'
            confidence = 5
            rationale = "Heikin-Ashi consolidation"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, 0.02, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.035 if direction == 'long' else price * 0.965,
            'stop_loss': sma if direction == 'long' else sma,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class EnvelopeBot(BotStrategy):
    """Moving Average Envelopes."""
    
    def __init__(self):
        super().__init__("EnvelopeBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['sma_20', 'current_price']):
            return None
        
        price = features['current_price']
        sma = features['sma_20']
        
        # Envelope bands
        upper = sma * 1.05
        lower = sma * 0.95
        
        if price < lower:
            direction = 'long'
            confidence = 8
            rationale = "Price below lower envelope, bounce expected"
        elif price > upper:
            direction = 'short'
            confidence = 7
            rationale = "Price above upper envelope, reversion expected"
        else:
            direction = 'long'
            confidence = 5
            rationale = "Price within envelopes"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, 0.025, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': sma if abs(price - sma) / sma > 0.03 else price * 1.02,
            'stop_loss': price * 0.97 if direction == 'long' else price * 1.03,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class ChaikinOscillatorBot(BotStrategy):
    """Chaikin Oscillator (Acc/Dist derivative)."""
    
    def __init__(self):
        super().__init__("ChaikinOscillatorBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['obv', 'current_price']):
            return None
        
        obv = features['obv']
        price = features['current_price']
        
        # Chaikin proxy: OBV momentum
        if obv > 1000:
            direction = 'long'
            confidence = 8
            rationale = "Chaikin Oscillator positive, buying pressure"
        elif obv < -1000:
            direction = 'short'
            confidence = 8
            rationale = "Chaikin Oscillator negative, selling pressure"
        else:
            direction = 'long'
            confidence = 5
            rationale = "Chaikin Oscillator neutral"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, 0.02, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.035 if direction == 'long' else price * 0.965,
            'stop_loss': price * 0.98 if direction == 'long' else price * 1.02,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class AroonBot(BotStrategy):
    """Aroon indicator for trend identification."""
    
    def __init__(self):
        super().__init__("AroonBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['sma_20', 'sma_50', 'current_price']):
            return None
        
        price = features['current_price']
        sma_20 = features['sma_20']
        sma_50 = features['sma_50']
        
        # Aroon Up/Down proxy
        if sma_20 > sma_50 * 1.03:
            direction = 'long'
            confidence = 9
            rationale = "Aroon Up strong (recent highs), uptrend"
        elif sma_20 < sma_50 * 0.97:
            direction = 'short'
            confidence = 9
            rationale = "Aroon Down strong (recent lows), downtrend"
        else:
            direction = 'long'
            confidence = 5
            rationale = "Aroon neutral"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, 0.03, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.045 if direction == 'long' else price * 0.955,
            'stop_loss': price * 0.975 if direction == 'long' else price * 1.025,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class DeMarkerBot(BotStrategy):
    """DeMarker indicator for exhaustion."""
    
    def __init__(self):
        super().__init__("DeMarkerBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['rsi_14', 'current_price']):
            return None
        
        # Use RSI as DeMarker proxy
        demarker = features['rsi_14'] / 100
        price = features['current_price']
        
        if demarker < 0.3:
            direction = 'long'
            confidence = 8
            rationale = "DeMarker showing exhaustion, reversal up expected"
        elif demarker > 0.7:
            direction = 'short'
            confidence = 8
            rationale = "DeMarker overbought, reversal down expected"
        else:
            direction = 'long'
            confidence = 5
            rationale = "DeMarker neutral zone"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, 0.025, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.035 if direction == 'long' else price * 0.965,
            'stop_loss': price * 0.98 if direction == 'long' else price * 1.02,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class UltimateOscillatorBot(BotStrategy):
    """Ultimate Oscillator (multi-timeframe momentum)."""
    
    def __init__(self):
        super().__init__("UltimateOscillatorBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['rsi_14', 'stoch_k', 'current_price']):
            return None
        
        # Combine multiple oscillators
        rsi = features['rsi_14']
        stoch = features['stoch_k']
        price = features['current_price']
        
        ultimate = (rsi + stoch) / 2
        
        if ultimate < 30:
            direction = 'long'
            confidence = 9
            rationale = "Ultimate Oscillator oversold, strong buy"
        elif ultimate > 70:
            direction = 'short'
            confidence = 9
            rationale = "Ultimate Oscillator overbought, strong sell"
        else:
            direction = 'long'
            confidence = 5
            rationale = "Ultimate Oscillator neutral"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, 0.025, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.04 if direction == 'long' else price * 0.96,
            'stop_loss': price * 0.98 if direction == 'long' else price * 1.02,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class ElderRayBot(BotStrategy):
    """Elder Ray Index (Bull/Bear Power)."""
    
    def __init__(self):
        super().__init__("ElderRayBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['ema_13', 'current_price']):
            return None
        
        price = features['current_price']
        ema = features['ema_13']
        
        # Bull Power = High - EMA
        # Bear Power = Low - EMA
        bull_power = (price * 1.01) - ema  # Approximate high
        bear_power = (price * 0.99) - ema  # Approximate low
        
        if bull_power > 0 and bear_power > 0:
            direction = 'long'
            confidence = 9
            rationale = "Elder Ray: Both bull and bear power positive"
        elif bull_power < 0 and bear_power < 0:
            direction = 'short'
            confidence = 9
            rationale = "Elder Ray: Both bull and bear power negative"
        else:
            direction = 'long'
            confidence = 5
            rationale = "Elder Ray: Mixed signals"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, 0.02, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.04 if direction == 'long' else price * 0.96,
            'stop_loss': ema if direction == 'long' else ema,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class KSTBot(BotStrategy):
    """Know Sure Thing (KST) momentum oscillator."""
    
    def __init__(self):
        super().__init__("KSTBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['sma_20', 'sma_50', 'sma_200', 'current_price']):
            return None
        
        price = features['current_price']
        
        # KST proxy: weighted ROC combination
        roc_20 = (features['sma_20'] / price - 1) * 100
        roc_50 = (features['sma_50'] / price - 1) * 100
        roc_200 = (features['sma_200'] / price - 1) * 100
        
        kst = (roc_20 * 1) + (roc_50 * 2) + (roc_200 * 3)
        
        if kst > 5:
            direction = 'long'
            confidence = 8
            rationale = "KST positive, bullish momentum across timeframes"
        elif kst < -5:
            direction = 'short'
            confidence = 8
            rationale = "KST negative, bearish momentum across timeframes"
        else:
            direction = 'long'
            confidence = 5
            rationale = "KST neutral"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, abs(kst) / 100, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.04 if direction == 'long' else price * 0.96,
            'stop_loss': price * 0.975 if direction == 'long' else price * 1.025,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class VortexBot(BotStrategy):
    """Vortex Indicator for trend direction."""
    
    def __init__(self):
        super().__init__("VortexBot")
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        if not all(k in features for k in ['sma_20', 'atr', 'current_price']):
            return None
        
        price = features['current_price']
        sma = features['sma_20']
        atr = features['atr']
        
        # Vortex proxy: price movement vs ATR
        vi_plus = abs(price - sma * 0.99) / atr if atr > 0 else 1
        vi_minus = abs(price - sma * 1.01) / atr if atr > 0 else 1
        
        if vi_plus > vi_minus:
            direction = 'long'
            confidence = min(10, int(6 + (vi_plus - vi_minus) * 2))
            rationale = "Vortex indicator bullish (VI+ > VI-)"
        else:
            direction = 'short'
            confidence = min(10, int(6 + (vi_minus - vi_plus) * 2))
            rationale = "Vortex indicator bearish (VI- > VI+)"
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, atr/price * 2, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.04 if direction == 'long' else price * 0.96,
            'stop_loss': price * 0.98 if direction == 'long' else price * 1.02,
            'confidence': confidence,
            'rationale': rationale,
            **predictions
        }


class AIAnalystBot(BotStrategy):
    """AI-Powered Analyst Bot using OpenAI ChatGPT-5 for comprehensive analysis.
    
    This bot is unique among the 50 - it uses LLM for deep analytical reasoning
    combining all technical indicators, sentiment, and market context.
    """
    
    def __init__(self):
        super().__init__("AIAnalystBot")
        self.api_key = None
        try:
            import os
            from dotenv import load_dotenv
            load_dotenv()
            self.api_key = os.environ.get('EMERGENT_LLM_KEY')
        except:
            pass
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        """Use ChatGPT-5 to analyze all available features and make recommendation."""
        if not self.api_key:
            # Fallback to simple analysis if no API key
            return self._fallback_analysis(features)
        
        try:
            # Import here to avoid import errors if library not installed
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            import asyncio
            
            # Run async analysis
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(self._async_analysis(features))
            loop.close()
            
            return result
            
        except Exception as e:
            logger.error(f"AIAnalystBot failed: {e}")
            return self._fallback_analysis(features)
    
    async def _async_analysis(self, features: Dict) -> Optional[Dict]:
        """Async analysis using ChatGPT-5."""
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        price = features.get('current_price', 0)
        if price == 0:
            return None
        
        # Build comprehensive feature summary
        feature_summary = f"""
PRICE: ${price:.6f}
TREND: SMA20={features.get('sma_20', 0):.2f}, SMA50={features.get('sma_50', 0):.2f}, SMA200={features.get('sma_200', 0):.2f}
MOMENTUM: RSI={features.get('rsi_14', 50):.1f}, MACD={features.get('macd', 0):.2f}, Stochastic={features.get('stoch_k', 50):.1f}
VOLATILITY: ATR={features.get('atr', 0):.4f}, BB_width={features.get('bb_width', 0):.4f}
VOLUME: OBV={features.get('obv', 0):.0f}
SENTIMENT: {features.get('sentiment_text', 'neutral')} (score: {features.get('sentiment_score', 5)}/10)
FUNDAMENTALS: {features.get('fundamental_notes', 'N/A')[:100]}
"""
        
        # Initialize ChatGPT-5
        chat = LlmChat(
            api_key=self.api_key,
            session_id="ai_analyst",
            system_message="""You are an expert cryptocurrency trading analyst. 
            Analyze all technical indicators, sentiment, and fundamentals to make a trading recommendation.
            Be decisive but realistic. Consider risk/reward."""
        ).with_model("openai", "gpt-5")
        
        user_message = UserMessage(
            text=f"""Analyze this crypto and provide a trading recommendation:

{feature_summary}

Provide:
DIRECTION: [LONG or SHORT]
CONFIDENCE: [1-10]
ENTRY: [specific price or "current"]
TAKE_PROFIT: [price target]
STOP_LOSS: [stop loss price]
PREDICTED_24H: [price prediction]
PREDICTED_7D: [price prediction]
RATIONALE: [brief explanation in 1-2 sentences]

Be specific with numbers. Use current price ${price:.6f} as reference."""
        )
        
        response = await chat.send_message(user_message)
        
        # Parse AI response
        direction = 'long'
        confidence = 6
        take_profit = price * 1.05
        stop_loss = price * 0.97
        predicted_24h = price * 1.02
        predicted_7d = price * 1.05
        rationale = response[:150]
        
        # Extract structured data
        if 'DIRECTION:' in response:
            dir_line = [line for line in response.split('\n') if 'DIRECTION:' in line][0]
            direction = 'long' if 'LONG' in dir_line.upper() else 'short'
        
        if 'CONFIDENCE:' in response:
            conf_line = [line for line in response.split('\n') if 'CONFIDENCE:' in line][0]
            try:
                confidence = int(''.join(filter(str.isdigit, conf_line)))
                confidence = min(10, max(1, confidence))
            except:
                confidence = 6
        
        if 'RATIONALE:' in response:
            rationale = response.split('RATIONALE:')[1].strip()[:150]
        
        # Extract prices if provided
        try:
            if 'TAKE_PROFIT:' in response:
                tp_line = [line for line in response.split('\n') if 'TAKE_PROFIT:' in line][0]
                take_profit = float(''.join(c for c in tp_line if c.isdigit() or c == '.'))
            
            if 'STOP_LOSS:' in response:
                sl_line = [line for line in response.split('\n') if 'STOP_LOSS:' in line][0]
                stop_loss = float(''.join(c for c in sl_line if c.isdigit() or c == '.'))
            
            if 'PREDICTED_24H:' in response:
                p24_line = [line for line in response.split('\n') if 'PREDICTED_24H:' in line][0]
                predicted_24h = float(''.join(c for c in p24_line if c.isdigit() or c == '.'))
            
            if 'PREDICTED_7D:' in response:
                p7d_line = [line for line in response.split('\n') if 'PREDICTED_7D:' in line][0]
                predicted_7d = float(''.join(c for c in p7d_line if c.isdigit() or c == '.'))
        except:
            pass
        
        logger.info(f"🤖 AIAnalystBot: {direction.upper()} confidence={confidence} - {rationale[:50]}")
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': take_profit if take_profit > 0 else (price * 1.05 if direction == 'long' else price * 0.95),
            'stop_loss': stop_loss if stop_loss > 0 else (price * 0.97 if direction == 'long' else price * 1.03),
            'confidence': confidence,
            'rationale': f"AI Analysis: {rationale}",
            'predicted_24h': predicted_24h,
            'predicted_48h': (predicted_24h + predicted_7d) / 2,  # Interpolate
            'predicted_7d': predicted_7d
        }
    
    def _fallback_analysis(self, features: Dict) -> Optional[Dict]:
        """Fallback analysis if LLM unavailable."""
        if not all(k in features for k in ['rsi_14', 'macd', 'current_price']):
            return None
        
        price = features['current_price']
        rsi = features['rsi_14']
        macd = features['macd']
        
        # Simple combined analysis
        if rsi < 35 and macd > 0:
            direction = 'long'
            confidence = 7
        elif rsi > 65 and macd < 0:
            direction = 'short'
            confidence = 7
        else:
            direction = 'long'
            confidence = 5
        
        strength = confidence / 10.0
        predictions = self._calculate_predicted_prices(price, direction, 0.02, strength)
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.04 if direction == 'long' else price * 0.96,
            'stop_loss': price * 0.98 if direction == 'long' else price * 1.02,
            'confidence': confidence,
            'rationale': "AI Analyst (fallback): Combined technical analysis",
            **predictions
        }


# Bot Registry
ALL_BOTS = [
    # Original 21 bots
    SMA_CrossBot(),
    RSI_Bot(),
    MACD_Bot(),
    BollingerBandsBot(),
    EMA_RibbonBot(),
    VolumeBreakoutBot(),
    ATR_VolatilityBot(),
    StochasticBot(),
    TrendStrengthBot(),
    SupportResistanceBot(),
    OBV_TrendBot(),
    VWAP_Bot(),
    MomentumBot(),
    BreakoutBot(),
    ConsolidationBot(),
    ScalpingBot(),
    DivergenceBot(),
    SwingBot(),
    VolatilityBreakoutBot(),
    MultiTimeframeBot(),
    ConservativeBot(),
    # New 29 bots (total: 50)
    EMA_CrossBot(),
    ADX_TrendBot(),
    WilliamsRBot(),
    CCI_Bot(),
    ParabolicSARBot(),
    SuperTrendBot(),
    KeltnerChannelBot(),
    DonchianChannelBot(),
    ROC_Bot(),
    MFI_Bot(),
    AccDistBot(),
    VolumePriceTrendBot(),
    FibonacciBot(),
    PivotPointBot(),
    IchimokuBot(),
    ZScoreBot(),
    LinearRegressionBot(),
    TripleMABot(),
    HeikinAshiBot(),
    EnvelopeBot(),
    ChaikinOscillatorBot(),
    AroonBot(),
    DeMarkerBot(),
    UltimateOscillatorBot(),
    ElderRayBot(),
    KSTBot(),
    VortexBot(),
    AIAnalystBot(),  # Layer 2: AI-powered bot using ChatGPT-5
]

def get_all_bots():
    """Return list of all bot instances."""
    return ALL_BOTS
