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
            Dict with keys: direction, entry, take_profit, stop_loss, confidence, rationale
            or None if no signal
        """
        raise NotImplementedError


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
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * (1 + tp_pct) if direction == 'long' else price * (1 - tp_pct),
            'stop_loss': price * (1 - sl_pct) if direction == 'long' else price * (1 + sl_pct),
            'confidence': confidence,
            'rationale': f"SMA20 {'above' if direction == 'long' else 'below'} SMA50, indicating {direction} trend"
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
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * (1 + tp_pct) if direction == 'long' else price * (1 - tp_pct),
            'stop_loss': price * (1 - sl_pct) if direction == 'long' else price * (1 + sl_pct),
            'confidence': confidence,
            'rationale': rationale
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
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.035 if direction == 'long' else price * 0.965,
            'stop_loss': price * 0.98 if direction == 'long' else price * 1.02,
            'confidence': confidence,
            'rationale': f"MACD {'above' if direction == 'long' else 'below'} signal line"
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
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': bb_middle if direction == 'long' else bb_lower,
            'stop_loss': bb_lower * 0.98 if direction == 'long' else bb_upper * 1.02,
            'confidence': confidence,
            'rationale': rationale
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
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.04 if direction == 'long' else price * 0.96,
            'stop_loss': price * 0.975 if direction == 'long' else price * 1.025,
            'confidence': confidence,
            'rationale': rationale
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
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.05 if direction == 'long' else price * 0.95,
            'stop_loss': price * 0.97 if direction == 'long' else price * 1.03,
            'confidence': confidence,
            'rationale': rationale
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
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * (1 + tp_pct) if direction == 'long' else price * (1 - tp_pct),
            'stop_loss': price * (1 - sl_pct) if direction == 'long' else price * (1 + sl_pct),
            'confidence': confidence,
            'rationale': rationale
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
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.035 if direction == 'long' else price * 0.965,
            'stop_loss': price * 0.98 if direction == 'long' else price * 1.02,
            'confidence': confidence,
            'rationale': rationale
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
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.04 if direction == 'long' else price * 0.96,
            'stop_loss': price * 0.975 if direction == 'long' else price * 1.025,
            'confidence': confidence,
            'rationale': rationale
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
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': tp,
            'stop_loss': sl,
            'confidence': confidence,
            'rationale': rationale
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
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.035 if direction == 'long' else price * 0.965,
            'stop_loss': price * 0.98 if direction == 'long' else price * 1.02,
            'confidence': confidence,
            'rationale': rationale
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
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': vwap,
            'stop_loss': price * 0.975 if direction == 'long' else price * 1.025,
            'confidence': confidence,
            'rationale': rationale
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
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.04 if direction == 'long' else price * 0.96,
            'stop_loss': price * 0.97 if direction == 'long' else price * 1.03,
            'confidence': confidence,
            'rationale': rationale
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
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.05 if direction == 'long' else price * 0.95,
            'stop_loss': price * 0.97 if direction == 'long' else price * 1.03,
            'confidence': confidence,
            'rationale': rationale
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
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.04 if direction == 'long' else price * 0.96,
            'stop_loss': price * 0.98 if direction == 'long' else price * 1.02,
            'confidence': confidence,
            'rationale': rationale
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
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.015 if direction == 'long' else price * 0.985,
            'stop_loss': price * 0.99 if direction == 'long' else price * 1.01,
            'confidence': confidence,
            'rationale': rationale
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
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.04 if direction == 'long' else price * 0.96,
            'stop_loss': price * 0.975 if direction == 'long' else price * 1.025,
            'confidence': confidence,
            'rationale': rationale
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
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.06 if direction == 'long' else price * 0.94,
            'stop_loss': price * 0.96 if direction == 'long' else price * 1.04,
            'confidence': confidence,
            'rationale': rationale
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
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.05 if direction == 'long' else price * 0.95,
            'stop_loss': price * 0.97 if direction == 'long' else price * 1.03,
            'confidence': confidence,
            'rationale': rationale
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
        
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.045 if direction == 'long' else price * 0.955,
            'stop_loss': price * 0.975 if direction == 'long' else price * 1.025,
            'confidence': confidence,
            'rationale': rationale
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
        return {
            'direction': direction,
            'entry': price,
            'take_profit': price * 1.025 if direction == 'long' else price * 0.975,
            'stop_loss': price * 0.985 if direction == 'long' else price * 1.015,
            'confidence': confidence,
            'rationale': rationale
        }


# Bot Registry
ALL_BOTS = [
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
]

def get_all_bots():
    """Return list of all bot instances."""
    return ALL_BOTS
