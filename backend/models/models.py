from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

def uuid_str():
    return str(uuid.uuid4())

class ScanRun(BaseModel):
    id: str = Field(default_factory=uuid_str)
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    interval: Optional[str] = None  # '6h', '12h', '24h' or None for manual
    filter_scope: str = 'all'  # 'all' or 'alt'
    min_price: Optional[float] = None  # Optional minimum price filter
    max_price: Optional[float] = None  # Optional maximum price filter
    status: str = 'running'  # 'running', 'completed', 'failed'
    total_coins: int = 0  # Number of coins analyzed
    total_available_coins: int = 0  # Total coins available from source
    total_bots: int = 20
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
    predicted_24h: Optional[float] = None
    predicted_48h: Optional[float] = None
    predicted_7d: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Recommendation(BaseModel):
    id: str = Field(default_factory=uuid_str)
    run_id: str
    coin: str
    current_price: float
    consensus_direction: str  # 'long' or 'short'
    avg_confidence: float
    avg_take_profit: float
    avg_stop_loss: float
    avg_entry: float
    avg_predicted_24h: float
    avg_predicted_48h: float
    avg_predicted_7d: float
    bot_count: int = 20
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
    schedule_start_time: Optional[str] = None  # HH:MM format
    filter_scope: str = 'all'  # 'all' or 'alt'
    alt_exclusions: List[str] = ['BTC', 'ETH', 'USDT', 'USDC', 'DAI', 'TUSD', 'BUSD']
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BotStatus(BaseModel):
    bot_name: str
    status: str  # 'idle', 'running', 'error'
    last_run: Optional[datetime] = None
    latency_ms: Optional[int] = None

# API Request/Response models
class ScanRunRequest(BaseModel):
    scope: str = 'all'  # 'all' or 'alt'
    min_price: Optional[float] = None  # Optional: filter for coins above this price
    max_price: Optional[float] = None  # Optional: filter for coins under this price

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
    schedule_start_time: Optional[str] = None
    filter_scope: str = 'all'
    min_price: Optional[float] = None
    max_price: Optional[float] = None