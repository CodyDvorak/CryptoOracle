import pandas as pd
import numpy as np
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

class IndicatorEngine:
    """Technical indicator computation engine using pandas."""
    
    @staticmethod
    def prepare_dataframe(candles: List[Dict]) -> pd.DataFrame:
        """Convert candle list to pandas DataFrame."""
        if not candles:
            return pd.DataFrame()
        
        df = pd.DataFrame(candles)
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='s')
        df = df.sort_values('timestamp')
        df = df.reset_index(drop=True)
        return df
    
    @staticmethod
    def sma(df: pd.DataFrame, period: int, col: str = 'close') -> pd.Series:
        """Simple Moving Average."""
        return df[col].rolling(window=period).mean()
    
    @staticmethod
    def ema(df: pd.DataFrame, period: int, col: str = 'close') -> pd.Series:
        """Exponential Moving Average."""
        return df[col].ewm(span=period, adjust=False).mean()
    
    @staticmethod
    def rsi(df: pd.DataFrame, period: int = 14, col: str = 'close') -> pd.Series:
        """Relative Strength Index."""
        delta = df[col].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        return 100 - (100 / (1 + rs))
    
    @staticmethod
    def macd(df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9, col: str = 'close'):
        """MACD indicator."""
        fast_ema = df[col].ewm(span=fast, adjust=False).mean()
        slow_ema = df[col].ewm(span=slow, adjust=False).mean()
        macd_line = fast_ema - slow_ema
        signal_line = macd_line.ewm(span=signal, adjust=False).mean()
        histogram = macd_line - signal_line
        return macd_line, signal_line, histogram
    
    @staticmethod
    def bollinger_bands(df: pd.DataFrame, period: int = 20, std_dev: int = 2, col: str = 'close'):
        """Bollinger Bands."""
        sma = df[col].rolling(window=period).mean()
        std = df[col].rolling(window=period).std()
        upper = sma + (std * std_dev)
        lower = sma - (std * std_dev)
        return upper, sma, lower
    
    @staticmethod
    def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
        """Average True Range."""
        high_low = df['high'] - df['low']
        high_close = np.abs(df['high'] - df['close'].shift())
        low_close = np.abs(df['low'] - df['close'].shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        true_range = ranges.max(axis=1)
        return true_range.rolling(window=period).mean()
    
    @staticmethod
    def obv(df: pd.DataFrame) -> pd.Series:
        """On-Balance Volume."""
        obv = (np.sign(df['close'].diff()) * df['volume']).fillna(0).cumsum()
        return obv
    
    @staticmethod
    def vwap(df: pd.DataFrame) -> pd.Series:
        """Volume Weighted Average Price (approximation)."""
        typical_price = (df['high'] + df['low'] + df['close']) / 3
        return (typical_price * df['volume']).cumsum() / df['volume'].cumsum()
    
    @staticmethod
    def stochastic(df: pd.DataFrame, period: int = 14):
        """Stochastic Oscillator."""
        low_min = df['low'].rolling(window=period).min()
        high_max = df['high'].rolling(window=period).max()
        k = 100 * (df['close'] - low_min) / (high_max - low_min)
        d = k.rolling(window=3).mean()
        return k, d
    
    @classmethod
    def compute_all_indicators(cls, candles: List[Dict], derivatives_data: Dict = None) -> Dict:
        """Compute all indicators and return a feature dictionary.
        
        Args:
            candles: List of OHLCV candles
            derivatives_data: Optional dict with futures/derivatives metrics
        """
        df = cls.prepare_dataframe(candles)
        
        if len(df) < 50:
            logger.warning(f"Insufficient data: {len(df)} candles")
            return {}
        
        features = {
            'current_price': df['close'].iloc[-1],
            'sma_20': cls.sma(df, 20).iloc[-1],
            'sma_50': cls.sma(df, 50).iloc[-1],
            'sma_200': cls.sma(df, 200).iloc[-1] if len(df) >= 200 else cls.sma(df, 50).iloc[-1],
            'ema_9': cls.ema(df, 9).iloc[-1],
            'ema_12': cls.ema(df, 12).iloc[-1],
            'ema_13': cls.ema(df, 13).iloc[-1],
            'ema_20': cls.ema(df, 20).iloc[-1],
            'ema_21': cls.ema(df, 21).iloc[-1],
            'ema_26': cls.ema(df, 26).iloc[-1],
            'rsi_14': cls.rsi(df, 14).iloc[-1],
            'volume': df['volume'].iloc[-1],
            'volume_sma_20': df['volume'].rolling(20).mean().iloc[-1],
            'obv': cls.obv(df).iloc[-1],
            'vwap': cls.vwap(df).iloc[-1],
            'atr': cls.atr(df, 14).iloc[-1],  # Also store as 'atr' for consistency
            'atr_14': cls.atr(df, 14).iloc[-1],
            'adx': 50.0,  # Placeholder - ADX calculation is complex, use default value
        }
        
        # Add derivatives/futures data if available
        if derivatives_data and derivatives_data.get('has_derivatives_data'):
            features['open_interest'] = derivatives_data.get('open_interest', 0)
            features['funding_rate'] = derivatives_data.get('funding_rate', 0)
            features['long_short_ratio'] = derivatives_data.get('long_short_ratio', 1.0)
            features['long_account_percent'] = derivatives_data.get('long_account_percent', 50)
            features['short_account_percent'] = derivatives_data.get('short_account_percent', 50)
            features['liquidation_risk'] = derivatives_data.get('liquidation_risk', 'unknown')
            features['funding_direction'] = derivatives_data.get('funding_direction', 'neutral')
            features['has_derivatives'] = True
        else:
            features['has_derivatives'] = False
        
        # MACD
        macd_line, signal_line, histogram = cls.macd(df)
        features['macd'] = macd_line.iloc[-1]
        features['macd_signal'] = signal_line.iloc[-1]
        features['macd_histogram'] = histogram.iloc[-1]
        
        # Bollinger Bands
        bb_upper, bb_middle, bb_lower = cls.bollinger_bands(df)
        features['bb_upper'] = bb_upper.iloc[-1]
        features['bb_middle'] = bb_middle.iloc[-1]
        features['bb_lower'] = bb_lower.iloc[-1]
        features['bb_width'] = (bb_upper.iloc[-1] - bb_lower.iloc[-1]) / bb_middle.iloc[-1]
        
        # Stochastic
        stoch_k, stoch_d = cls.stochastic(df)
        features['stoch_k'] = stoch_k.iloc[-1]
        features['stoch_d'] = stoch_d.iloc[-1]
        
        # Trend indicators
        features['price_change_24h'] = ((df['close'].iloc[-1] - df['close'].iloc[-6]) / df['close'].iloc[-6]) * 100 if len(df) > 6 else 0
        features['price_change_7d'] = ((df['close'].iloc[-1] - df['close'].iloc[-42]) / df['close'].iloc[-42]) * 100 if len(df) > 42 else 0
        
        # Support/Resistance (recent highs/lows)
        recent_period = min(100, len(df))
        features['recent_high'] = df['high'].iloc[-recent_period:].max()
        features['recent_low'] = df['low'].iloc[-recent_period:].min()
        

    @classmethod
    def compute_4h_indicators(cls, candles_4h: List[Dict]) -> Dict:
        """Compute indicators for 4-hour timeframe.
        
        Phase 4: Multi-timeframe analysis
        Returns key indicators for 4h chart: trend, momentum, RSI
        """
        try:
            if not candles_4h or len(candles_4h) < 20:
                return {}
            
            df = cls.prepare_dataframe(candles_4h)
            if df.empty:
                return {}
            
            indicators_4h = {}
            
            # Trend indicators (4h)
            sma_10_4h = cls.sma(df, 10)
            sma_20_4h = cls.sma(df, 20)
            ema_9_4h = cls.ema(df, 9)
            
            indicators_4h['sma_10_4h'] = float(sma_10_4h.iloc[-1]) if not pd.isna(sma_10_4h.iloc[-1]) else 0
            indicators_4h['sma_20_4h'] = float(sma_20_4h.iloc[-1]) if not pd.isna(sma_20_4h.iloc[-1]) else 0
            indicators_4h['ema_9_4h'] = float(ema_9_4h.iloc[-1]) if not pd.isna(ema_9_4h.iloc[-1]) else 0
            
            # Momentum indicators (4h)
            rsi_14_4h = cls.rsi(df, 14)
            macd_line, signal_line, histogram = cls.macd(df)
            
            indicators_4h['rsi_14_4h'] = float(rsi_14_4h.iloc[-1]) if not pd.isna(rsi_14_4h.iloc[-1]) else 50
            indicators_4h['macd_4h'] = float(macd_line.iloc[-1]) if not pd.isna(macd_line.iloc[-1]) else 0
            indicators_4h['macd_signal_4h'] = float(signal_line.iloc[-1]) if not pd.isna(signal_line.iloc[-1]) else 0
            indicators_4h['macd_histogram_4h'] = float(histogram.iloc[-1]) if not pd.isna(histogram.iloc[-1]) else 0
            
            # 4h trend direction
            current_price = df['close'].iloc[-1]
            if indicators_4h['sma_10_4h'] > 0:
                if current_price > indicators_4h['sma_10_4h'] and indicators_4h['sma_10_4h'] > indicators_4h['sma_20_4h']:
                    indicators_4h['trend_4h'] = 'bullish'
                elif current_price < indicators_4h['sma_10_4h'] and indicators_4h['sma_10_4h'] < indicators_4h['sma_20_4h']:
                    indicators_4h['trend_4h'] = 'bearish'
                else:
                    indicators_4h['trend_4h'] = 'neutral'
            else:
                indicators_4h['trend_4h'] = 'neutral'
            
            # 4h momentum
            if indicators_4h['macd_histogram_4h'] > 0 and indicators_4h['rsi_14_4h'] > 50:
                indicators_4h['momentum_4h'] = 'positive'
            elif indicators_4h['macd_histogram_4h'] < 0 and indicators_4h['rsi_14_4h'] < 50:
                indicators_4h['momentum_4h'] = 'negative'
            else:
                indicators_4h['momentum_4h'] = 'neutral'
            
            return indicators_4h
            
        except Exception as e:
            logger.error(f"Error computing 4h indicators: {e}")
            return {}
    
    @classmethod
    def check_timeframe_alignment(cls, daily_features: Dict, features_4h: Dict) -> Dict:
        """Check if daily and 4h timeframes are aligned.
        
        Phase 4: Timeframe confirmation
        Returns alignment score and recommendations
        """
        if not features_4h:
            return {'alignment': 'unknown', 'confidence_modifier': 1.0}
        
        try:
            # Get daily trend
            current_price = daily_features.get('current_price', 0)
            sma_20 = daily_features.get('sma_20', 0)
            sma_50 = daily_features.get('sma_50', 0)
            
            if current_price > sma_20 > sma_50:
                daily_trend = 'bullish'
            elif current_price < sma_20 < sma_50:
                daily_trend = 'bearish'
            else:
                daily_trend = 'neutral'
            
            # Get 4h trend
            trend_4h = features_4h.get('trend_4h', 'neutral')
            momentum_4h = features_4h.get('momentum_4h', 'neutral')
            
            # Check alignment
            if daily_trend == 'bullish' and trend_4h == 'bullish' and momentum_4h == 'positive':
                alignment = 'strong_bullish'
                confidence_modifier = 1.3  # Boost confidence
            elif daily_trend == 'bearish' and trend_4h == 'bearish' and momentum_4h == 'negative':
                alignment = 'strong_bearish'
                confidence_modifier = 1.3  # Boost confidence
            elif daily_trend == trend_4h:
                alignment = 'aligned'
                confidence_modifier = 1.1  # Mild boost
            elif (daily_trend == 'bullish' and trend_4h == 'bearish') or (daily_trend == 'bearish' and trend_4h == 'bullish'):
                alignment = 'conflicting'
                confidence_modifier = 0.7  # Reduce confidence
            else:
                alignment = 'neutral'
                confidence_modifier = 1.0
            
            return {
                'alignment': alignment,
                'confidence_modifier': confidence_modifier,
                'daily_trend': daily_trend,
                'trend_4h': trend_4h,
                'momentum_4h': momentum_4h
            }
            
        except Exception as e:
            logger.error(f"Error checking timeframe alignment: {e}")
            return {'alignment': 'unknown', 'confidence_modifier': 1.0}

        return features