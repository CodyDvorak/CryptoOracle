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
    def compute_all_indicators(cls, candles: List[Dict]) -> Dict:
        """Compute all indicators and return a feature dictionary."""
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
        
        return features