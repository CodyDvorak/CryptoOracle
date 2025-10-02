from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

def uuid_str():
    return str(uuid.uuid4())

class User(BaseModel):
    id: str = Field(default_factory=uuid_str)
    username: str
    email: EmailStr
    hashed_password: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    created_at: datetime
    is_active: bool

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ScanRun(BaseModel):
    id: str = Field(default_factory=uuid_str)
    user_id: Optional[str] = None  # User who initiated the scan
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    interval: Optional[str] = None  # '6h', '12h', '24h' or None for manual
    filter_scope: str = 'all'  # 'all' or 'alt'
    min_price: Optional[float] = None  # Optional minimum price filter
    max_price: Optional[float] = None  # Optional maximum price filter
    scan_type: str = 'full_scan'  # 'quick_scan', 'focused_scan', 'fast_parallel', 'full_scan', 'speed_run'
    status: str = 'running'  # 'running', 'completed', 'failed'
    total_coins: int = 0  # Number of coins analyzed
    total_available_coins: int = 0  # Total coins available from source
    total_bots: int = 49
    error_message: Optional[str] = None

class BotResult(BaseModel):
    id: str = Field(default_factory=uuid_str)
    run_id: str
    coin: str
    bot_name: str
    direction: str  # 'long' or 'short'
    entry_price: float
    take_profit: float
    stop_loss: float
    confidence: int  # 1-10
    rationale: str
    recommended_leverage: Optional[float] = 5.0  # Recommended leverage (1x-20x)
    predicted_24h: Optional[float] = None
    predicted_48h: Optional[float] = None
    predicted_7d: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Recommendation(BaseModel):
    id: str = Field(default_factory=uuid_str)
    run_id: str
    user_id: Optional[str] = None  # User who owns this recommendation
    coin: str  # Full name (e.g., "Bitcoin")
    ticker: str = ""  # Ticker symbol (e.g., "BTC")
    current_price: float
    consensus_direction: str  # 'long' or 'short'
    avg_confidence: float
    avg_take_profit: float
    avg_stop_loss: float
    avg_entry: float
    avg_predicted_24h: float
    # Leverage recommendations
    avg_leverage: float = 5.0  # Average recommended leverage from all bots
    min_leverage: float = 1.0  # Minimum leverage suggested by any bot
    max_leverage: float = 10.0  # Maximum leverage suggested by any bot
    # Fields for tracking actual outcomes (for success rate)
    actual_price_24h: Optional[float] = None
    actual_price_48h: Optional[float] = None
    actual_price_7d: Optional[float] = None
    outcome_24h: Optional[str] = None  # 'success', 'failed', 'pending'
    outcome_7d: Optional[str] = None
    avg_predicted_48h: float
    avg_predicted_7d: float
    bot_count: int = 20
    trader_grade: float = 0  # TokenMetrics AI trader grade (0-100)
    investor_grade: float = 0  # TokenMetrics AI investor grade (0-100)
    ai_trend: str = ""  # AI trend analysis (bullish/bearish/neutral)
    category: str = ""  # confidence/percent_mover/dollar_mover
    predicted_percent_change: float = 0  # Predicted % change
    predicted_dollar_change: float = 0  # Predicted $ change
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class IntegrationsConfig(BaseModel):
    id: str = Field(default_factory=uuid_str)
    email_enabled: bool = False
    email_to: Optional[str] = None
    smtp_host: str = 'smtp.gmail.com'
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_pass: Optional[str] = None  # Encrypted/masked in production
    sheets_enabled: bool = False
    sheet_url: Optional[str] = None
    sheet_id: Optional[str] = None
    worksheet: str = 'Sheet1'
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Settings(BaseModel):
    id: str = Field(default_factory=uuid_str)
    schedule_enabled: bool = False
    schedule_interval: str = '12h'  # '6h', '12h', or '24h'
    scan_type: str = 'quick_scan'  # Scan type to run on schedule
    schedule_start_time: Optional[str] = None  # HH:MM format (e.g., "09:00")
    timezone: str = 'UTC'  # Timezone for schedule_start_time (e.g., "America/New_York", "Europe/London")
    filter_scope: str = 'all'  # 'all' or 'alt'
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    alt_exclusions: List[str] = ['BTC', 'ETH', 'USDT', 'USDC', 'DAI', 'TUSD', 'BUSD']
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BotStatus(BaseModel):
    bot_name: str
    status: str  # 'idle', 'running', 'error'
    last_run: Optional[datetime] = None
    latency_ms: Optional[int] = None

# API Request/Response models
class ScanRunRequest(BaseModel):
    scope: str = 'all'  # 'all' or 'alt' or 'custom'
    min_price: Optional[float] = None  # Optional: filter for coins above this price
    max_price: Optional[float] = None  # Optional: filter for coins under this price
    custom_symbols: Optional[List[str]] = None  # Optional: list of specific symbols to scan
    scan_type: str = 'quick_scan'  # 'quick_scan', 'focused_scan', 'fast_parallel', 'full_scan_lite', 'heavy_speed_run', 'complete_market_scan', 'full_scan', 'speed_run'

class Top5Response(BaseModel):
    recommendations: List[Recommendation]
    run_id: str
    scan_time: datetime

class UpdateIntegrationsRequest(BaseModel):
    email_enabled: bool = False
    email_to: Optional[str] = None
    smtp_host: str = 'smtp.gmail.com'
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_pass: Optional[str] = None
    sheets_enabled: bool = False
    sheet_url: Optional[str] = None
    worksheet: str = 'Sheet1'

class UpdateScheduleRequest(BaseModel):
    schedule_enabled: bool
    schedule_interval: str  # '6h', '12h', '24h'
    scan_type: str = 'quick_scan'  # Scan type to run on schedule
    schedule_start_time: Optional[str] = None  # HH:MM format
    timezone: str = 'UTC'  # Timezone string (e.g., "America/New_York")
    filter_scope: str = 'all'
    min_price: Optional[float] = None
    max_price: Optional[float] = None


# Bot Learning & Performance Tracking Models

class BotPrediction(BaseModel):
    """Individual bot prediction for tracking and learning."""
    id: str = Field(default_factory=uuid_str)
    run_id: str  # Link to scan run
    user_id: Optional[str] = None
    bot_name: str  # Name of the bot that made this prediction
    coin_symbol: str
    coin_name: str
    entry_price: float  # Price at time of prediction
    target_price: float  # Bot's price target
    stop_loss: Optional[float] = None  # Optional stop loss
    position_direction: str  # 'long' or 'short'
    confidence_score: float  # Bot's confidence (0-100)
    leverage: Optional[float] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Outcome tracking (filled by background job)
    outcome_checked_at: Optional[datetime] = None
    outcome_price: Optional[float] = None  # Price when outcome was checked
    outcome_status: Optional[str] = None  # 'pending', 'win', 'loss', 'neutral'
    profit_loss_percent: Optional[float] = None  # Actual % gain/loss
    
    class Config:
        json_schema_extra = {
            "example": {
                "bot_name": "MACDBot",
                "coin_symbol": "BTC",
                "entry_price": 50000.0,
                "target_price": 55000.0,
                "position_direction": "long",
                "confidence_score": 85.0
            }
        }

class BotPerformance(BaseModel):
    """Aggregate performance statistics for each bot."""
    id: str = Field(default_factory=uuid_str)
    bot_name: str  # Unique identifier for the bot
    
    # Performance metrics
    total_predictions: int = 0
    successful_predictions: int = 0  # Predictions that hit target
    failed_predictions: int = 0  # Predictions that hit stop loss or went wrong direction
    pending_predictions: int = 0  # Still being tracked
    
    accuracy_rate: float = 0.0  # % of successful predictions
    avg_profit_loss: float = 0.0  # Average % gain/loss across all closed predictions
    
    # Weighting for aggregation
    performance_weight: float = 1.0  # Default 1.0, adjusted based on accuracy
    
    # Timestamps
    first_prediction_at: Optional[datetime] = None
    last_prediction_at: Optional[datetime] = None
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_schema_extra = {
            "example": {
                "bot_name": "MACDBot",
                "total_predictions": 100,
                "successful_predictions": 65,
                "accuracy_rate": 65.0,
                "avg_profit_loss": 8.5,
                "performance_weight": 1.3
            }
        }
