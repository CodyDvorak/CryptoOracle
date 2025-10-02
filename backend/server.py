from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import asyncio

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from models.models import (
    ScanRun, BotResult, Recommendation, IntegrationsConfig, Settings, BotStatus,
    ScanRunRequest, Top5Response, UpdateIntegrationsRequest, UpdateScheduleRequest,
    User, UserCreate, UserLogin, UserResponse, Token
)
from services.scan_orchestrator import ScanOrchestrator
from services.auth_service import hash_password, verify_password, create_access_token, decode_access_token
from services.outcome_tracker import OutcomeTracker
from services.cryptocompare_client import CryptoCompareClient

# Setup
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'crypto_oracle')]

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="Crypto Oracle API")
api_router = APIRouter(prefix="/api")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
scan_orchestrator = ScanOrchestrator(db)
crypto_client = CryptoCompareClient()
outcome_tracker = OutcomeTracker(db, crypto_client)
scheduler = AsyncIOScheduler()
current_scan_task: Optional[asyncio.Task] = None
bot_statuses = {}


# ==================== Auth Helper ====================

security = HTTPBearer()

async def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """Get current user from JWT token (optional - returns None if not authenticated)"""
    if not authorization:
        return None
    
    try:
        # Extract token from "Bearer <token>"
        token = authorization.replace("Bearer ", "")
        payload = decode_access_token(token)
        
        if not payload:
            return None
        
        user_id = payload.get("sub")
        if not user_id:
            return None
        
        # Fetch user from database
        user = await db.users.find_one({"id": user_id})
        if not user:
            return None
        
        return user
    except Exception as e:
        logger.error(f"Error getting current user: {e}")
        return None

async def require_auth(authorization: Optional[str] = Header(None)) -> dict:
    """Require authentication - raises 401 if not authenticated"""
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


# ==================== Health Check ====================

@api_router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {
            "database": "connected",
            "scheduler": "running" if scheduler.running else "stopped"
        }
    }


# ==================== Authentication ====================

@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    """Register a new user"""
    # Check if username already exists
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Check if email already exists
    existing_email = await db.users.find_one({"email": user_data.email})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hash_password(user_data.password)
    )
    
    await db.users.insert_one(user.dict())
    
    # Create access token
    access_token = create_access_token(data={"sub": user.id})
    
    user_response = UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        created_at=user.created_at,
        is_active=user.is_active
    )
    
    logger.info(f"New user registered: {user.username}")
    return Token(access_token=access_token, user=user_response)


@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    """Login user"""
    # Find user
    user = await db.users.find_one({"username": credentials.username})
    
    if not user or not verify_password(credentials.password, user['hashed_password']):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Create access token
    access_token = create_access_token(data={"sub": user['id']})
    
    user_response = UserResponse(
        id=user['id'],
        username=user['username'],
        email=user['email'],
        created_at=user['created_at'],
        is_active=user['is_active']
    )
    
    logger.info(f"User logged in: {user['username']}")
    return Token(access_token=access_token, user=user_response)


@api_router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(require_auth)):
    """Get current user information"""
    return UserResponse(
        id=current_user['id'],
        username=current_user['username'],
        email=current_user['email'],
        created_at=current_user['created_at'],
        is_active=current_user['is_active']
    )


# ==================== Outcome Tracking ====================

@api_router.post("/outcomes/track")
async def track_outcomes(current_user: Optional[dict] = Depends(get_current_user)):
    """Manually trigger outcome tracking for all pending recommendations"""
    try:
        result = await outcome_tracker.track_all_pending_recommendations()
        
        if result:
            return {
                'status': 'success',
                'message': 'Outcome tracking completed',
                **result
            }
        else:
            raise HTTPException(status_code=500, detail="Outcome tracking failed")
            
    except Exception as e:
        logger.error(f"Error in outcome tracking endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/outcomes/bot-success-rates")
async def get_bot_success_rates():
    """Get success rates for each bot based on historical outcomes"""
    try:
        success_rates = await outcome_tracker.calculate_bot_success_rates()
        return {
            'bot_success_rates': success_rates,
            'total_bots': len(success_rates)
        }
    except Exception as e:
        logger.error(f"Error fetching bot success rates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== User History ====================

@api_router.get("/user/history")
async def get_user_history(current_user: dict = Depends(require_auth), limit: int = 50):
    """Get user's scan history with success rate metrics"""
    user_id = current_user['id']
    
    # Get all user's scan runs
    scan_runs = await db.scan_runs.find(
        {'user_id': user_id, 'status': 'completed'}
    ).sort('completed_at', -1).limit(limit).to_list(limit)
    
    history = []
    total_predictions = 0
    successful_predictions = 0
    
    for scan_run in scan_runs:
        run_id = scan_run['id']
        
        # Get recommendations count for this run
        recommendations = await db.recommendations.find({'run_id': run_id}).to_list(100)
        
        # Calculate success rate for this run
        run_successes = sum(1 for r in recommendations if r.get('outcome_7d') == 'success')
        run_total = sum(1 for r in recommendations if r.get('outcome_7d') in ['success', 'failed'])
        
        total_predictions += run_total
        successful_predictions += run_successes
        
        run_success_rate = (run_successes / run_total * 100) if run_total > 0 else 0
        
        # Clean up ObjectId
        if '_id' in scan_run:
            del scan_run['_id']
        
        history.append({
            **scan_run,
            'recommendations_count': len(recommendations),
            'success_rate': round(run_success_rate, 2)
        })
    
    overall_success_rate = (successful_predictions / total_predictions * 100) if total_predictions > 0 else 0
    
    return {
        'history': history,
        'total_scans': len(history),
        'total_predictions': total_predictions,
        'successful_predictions': successful_predictions,
        'overall_success_rate': round(overall_success_rate, 2)
    }


@api_router.get("/user/recommendations/{run_id}")
async def get_user_run_recommendations(run_id: str, current_user: dict = Depends(require_auth)):
    """Get all recommendations for a specific user's scan run"""
    user_id = current_user['id']
    
    # Verify run belongs to user
    scan_run = await db.scan_runs.find_one({'id': run_id, 'user_id': user_id})
    if not scan_run:
        raise HTTPException(status_code=404, detail="Scan run not found")
    
    # Get recommendations
    recommendations = await db.recommendations.find({'run_id': run_id}).to_list(100)
    
    # Clean up ObjectIds
    for rec in recommendations:
        if '_id' in rec:
            del rec['_id']
    
    if '_id' in scan_run:
        del scan_run['_id']
    
    return {
        'run': scan_run,
        'recommendations': recommendations
    }


# ==================== Scan Endpoints ====================

@api_router.post("/scan/run")
async def run_scan(request: ScanRunRequest, background_tasks: BackgroundTasks, current_user: Optional[dict] = Depends(get_current_user)):
    """Trigger a crypto scan (user-specific if authenticated)."""
    global current_scan_task
    
    if current_scan_task and not current_scan_task.done():
        raise HTTPException(status_code=409, detail="A scan is already running")
    
    user_id = current_user['id'] if current_user else None
    
    # Create a background task for the scan
    async def scan_task():
        global current_scan_task
        try:
            await scan_orchestrator.run_scan(
                filter_scope=request.scope,
                min_price=request.min_price,
                max_price=request.max_price,
                custom_symbols=request.custom_symbols,
                user_id=user_id,
                scan_type=request.scan_type
            )
        except Exception as e:
            logger.error(f"Scan error: {e}")
        finally:
            current_scan_task = None
    
    current_scan_task = asyncio.create_task(scan_task())
    
    return {"status": "started", "message": "Scan initiated"}


@api_router.get("/scan/runs")
async def get_scan_runs(limit: int = 10):
    """Get recent scan runs."""
    runs = await db.scan_runs.find().sort('started_at', -1).limit(limit).to_list(limit)
    return {"runs": runs}


@api_router.get("/scan/status")
async def get_scan_status():
    """Get current scan status."""
    global current_scan_task
    
    is_running = current_scan_task and not current_scan_task.done()
    
    # Get most recent run
    recent_run = await db.scan_runs.find_one(sort=[('started_at', -1)])
    
    # Convert ObjectId to string if present
    if recent_run and '_id' in recent_run:
        recent_run['_id'] = str(recent_run['_id'])
    
    # Get total coins analyzed from most recent completed run
    coins_analyzed = 0
    total_available = 0
    if recent_run:
        coins_analyzed = recent_run.get('total_coins', 0)
        total_available = recent_run.get('total_available_coins', 0)
    
    return {
        "is_running": is_running,
        "recent_run": recent_run,
        "coins_analyzed": coins_analyzed,
        "total_available_coins": total_available
    }


# ==================== Recommendations Endpoints ====================

@api_router.get("/recommendations/top5")
async def get_top5_recommendations(run_id: Optional[str] = None, current_user: Optional[dict] = Depends(get_current_user)):
    """Get Top 8 recommendations categorized by confidence, % movers, and $ movers.
    
    If run_id is not provided, returns from the most recent completed run for the user (or global if not authenticated).
    """
    user_id = current_user['id'] if current_user else None
    
    if not run_id:
        # Build query filter
        query_filter = {'status': 'completed'}
        if user_id:
            query_filter['user_id'] = user_id
        
        # Get most recent completed run for this user
        recent_run = await db.scan_runs.find_one(
            query_filter,
            sort=[('completed_at', -1)]
        )
        
        if not recent_run:
            raise HTTPException(status_code=404, detail="No completed scans found")
        
        run_id = recent_run['id']
    
    # Fetch all recommendations for this run
    all_recs = await db.recommendations.find({'run_id': run_id}).to_list(100)
    
    if not all_recs:
        raise HTTPException(status_code=404, detail=f"No recommendations found for run {run_id}")
    
    # Convert ObjectId to string
    for rec in all_recs:
        if '_id' in rec:
            rec['_id'] = str(rec['_id'])
    
    # Categorize recommendations - now returning top 8 instead of 5
    top_confidence = [r for r in all_recs if r.get('category') == 'confidence'][:8]
    top_percent = [r for r in all_recs if r.get('category') == 'percent_mover'][:8]
    top_dollar = [r for r in all_recs if r.get('category') == 'dollar_mover'][:8]
    
    # Get scan info
    scan_run = await db.scan_runs.find_one({'id': run_id})
    if scan_run and '_id' in scan_run:
        scan_run['_id'] = str(scan_run['_id'])
    
    return {
        "run_id": run_id,
        "scan_time": scan_run.get('started_at') if scan_run else None,
        "top_confidence": top_confidence,
        "top_percent_movers": top_percent,
        "top_dollar_movers": top_dollar,
        "recommendations": all_recs  # All unique recommendations
    }


@api_router.get("/recommendations/history")
async def get_recommendations_history(limit: int = 50):
    """Get historical recommendations."""
    recommendations = await db.recommendations.find().sort('created_at', -1).limit(limit).to_list(limit)
    return {"recommendations": recommendations}


@api_router.get("/recommendations/{run_id}/{coin_symbol}/bot_details")
async def get_bot_details(run_id: str, coin_symbol: str):
    """Get individual bot confidence scores for a specific coin from a scan run.
    
    Args:
        run_id: The scan run ID
        coin_symbol: The coin symbol (e.g., 'BTC', 'ETH')
    
    Returns:
        Dictionary with bot details including individual confidence scores
    """
    # Find the recommendation to get the coin display name
    recommendation = await db.recommendations.find_one({
        'run_id': run_id,
        'ticker': coin_symbol
    })
    
    if not recommendation:
        # Try matching by coin name if ticker doesn't match
        recommendation = await db.recommendations.find_one({
            'run_id': run_id,
            'coin': {'$regex': coin_symbol, '$options': 'i'}
        })
    
    if not recommendation:
        raise HTTPException(
            status_code=404, 
            detail=f"No recommendation found for coin {coin_symbol} in run {run_id}"
        )
    
    coin_name = recommendation.get('coin')
    
    # Fetch all bot results for this coin in this run
    bot_results = await db.bot_results.find({
        'run_id': run_id,
        'coin': coin_name
    }).to_list(100)
    
    if not bot_results:
        raise HTTPException(
            status_code=404,
            detail=f"No bot results found for {coin_name} in run {run_id}"
        )
    
    # Convert ObjectId to string and format response
    bot_details = []
    for result in bot_results:
        if '_id' in result:
            result['_id'] = str(result['_id'])
        
        bot_details.append({
            'bot_name': result.get('bot_name'),
            'confidence': result.get('confidence', 0),
            'direction': result.get('direction'),
            'entry_price': result.get('entry_price'),
            'take_profit': result.get('take_profit'),
            'stop_loss': result.get('stop_loss'),
            'rationale': result.get('rationale', '')
        })
    
    # Sort by confidence (highest first)
    bot_details.sort(key=lambda x: x['confidence'], reverse=True)
    
    return {
        'run_id': run_id,
        'coin': coin_name,
        'ticker': coin_symbol,
        'total_bots': len(bot_details),
        'avg_confidence': recommendation.get('avg_confidence', 0),
        'bot_results': bot_details
    }


# ==================== Bots Status ====================

@api_router.get("/bots/status")
async def get_bots_status():
    """Get status of all 50 bots (including AIAnalystBot with ChatGPT-5)."""
    from bots.bot_strategies import get_all_bots
    
    bots = get_all_bots()
    statuses = []
    
    for bot in bots:
        # Check if bot has recent results
        recent_result = await db.bot_results.find_one(
            {'bot_name': bot.name},
            sort=[('created_at', -1)]
        )
        
        status = {
            'bot_name': bot.name,
            'status': 'running' if recent_result else 'idle',
            'last_run': recent_result['created_at'].isoformat() if recent_result else None,
            'latency_ms': None
        }
        
        statuses.append(status)
    
    return {"bots": statuses, "total": len(statuses)}



# ==================== Bot Performance & Learning Endpoints ====================

@api_router.get("/bots/performance")
async def get_bot_performance(bot_name: Optional[str] = None):
    """Get performance statistics for bots.
    
    Query params:
    - bot_name: Optional specific bot name, or omit for all bots
    """
    performances = await scan_orchestrator.bot_performance_service.get_bot_performance(bot_name)
    
    return {
        "bot_performances": performances,
        "total_bots": len(performances)
    }

@api_router.post("/bots/evaluate")
async def trigger_evaluation(hours_old: int = 24):
    """Manually trigger evaluation of pending predictions.
    
    Query params:
    - hours_old: Minimum age of predictions to evaluate (default 24h)
    """
    result = await scan_orchestrator.bot_performance_service.evaluate_predictions(hours_old)
    
    return {
        "message": "Evaluation complete",
        "result": result
    }

@api_router.get("/bots/predictions")
async def get_bot_predictions(
    run_id: Optional[str] = None,
    bot_name: Optional[str] = None,
    outcome_status: Optional[str] = None,
    limit: int = 100
):
    """Get bot predictions with optional filters.
    
    Query params:
    - run_id: Filter by scan run ID
    - bot_name: Filter by bot name
    - outcome_status: Filter by outcome ('pending', 'win', 'loss', 'neutral')
    - limit: Max number of predictions to return (default 100)
    """
    query = {}
    if run_id:
        query['run_id'] = run_id
    if bot_name:
        query['bot_name'] = bot_name
    if outcome_status:
        query['outcome_status'] = outcome_status
    
    predictions = await db.bot_predictions.find(query).sort('timestamp', -1).limit(limit).to_list(limit)
    
    # Clean up ObjectIds
    for pred in predictions:
        if '_id' in pred:
            del pred['_id']
    
    return {
        "predictions": predictions,
        "count": len(predictions)
    }


# ==================== Configuration Endpoints ====================

@api_router.get("/config/integrations")
async def get_integrations_config():
    """Get current integrations configuration."""
    import os
    
    config = await db.integrations_config.find_one({})
    
    if not config:
        # Return default config with env variables if available
        default_config = IntegrationsConfig(
            smtp_host=os.environ.get('SMTP_HOST', 'smtp.gmail.com'),
            smtp_port=int(os.environ.get('SMTP_PORT', 587)),
            smtp_user=os.environ.get('SMTP_USER', ''),
            email_to=os.environ.get('SMTP_USER', '')  # Default to same email
        )
        return default_config.dict()
    
    # Remove MongoDB _id field
    if '_id' in config:
        del config['_id']
    
    # Mask sensitive data
    if config.get('smtp_pass'):
        config['smtp_pass'] = '***MASKED***'
    
    return config


@api_router.put("/config/integrations")
async def update_integrations_config(request: UpdateIntegrationsRequest):
    """Update integrations configuration."""
    config_dict = request.dict()
    config_dict['updated_at'] = datetime.now(timezone.utc)
    
    # Upsert configuration
    await db.integrations_config.update_one(
        {},
        {'$set': config_dict},
        upsert=True
    )
    
    logger.info("Integrations config updated")
    return {"message": "Integrations configuration updated successfully"}


@api_router.post("/config/integrations/test-email")
async def test_email():
    """Test email configuration by sending a test email."""
    import os
    from services.email_service import EmailService
    
    try:
        # Get config from DB or env
        config = await db.integrations_config.find_one({})
        
        if config and config.get('email_to'):
            email_to = config['email_to']
            smtp_config = config
        else:
            # Use env variables
            email_to = os.environ.get('SMTP_USER', '')
            smtp_config = {
                'smtp_host': os.environ.get('SMTP_HOST', 'smtp.gmail.com'),
                'smtp_port': int(os.environ.get('SMTP_PORT', 587)),
                'smtp_user': os.environ.get('SMTP_USER', ''),
                'smtp_pass': os.environ.get('SMTP_PASS', '')
            }
        
        if not email_to:
            raise HTTPException(status_code=400, detail="No email address configured")
        
        # Create test email
        email_service = EmailService(
            smtp_host=smtp_config['smtp_host'],
            smtp_port=smtp_config['smtp_port'],
            smtp_user=smtp_config['smtp_user'],
            smtp_pass=smtp_config['smtp_pass']
        )
        
        # Send test email with mock recommendations
        test_recommendations = [{
            'coin': 'BTC',
            'consensus_direction': 'long',
            'avg_confidence': 8.5,
            'avg_entry': 50000,
            'avg_take_profit': 52000,
            'avg_stop_loss': 49000
        }]
        
        success = email_service.send_top5_notification(
            recipient=email_to,
            recommendations=test_recommendations,
            run_id='test-email'
        )
        
        if success:
            return {"message": f"Test email sent successfully to {email_to}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send test email")
    
    except Exception as e:
        logger.error(f"Test email error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/config/schedule")
async def get_schedule_config():
    """Get current schedule configuration."""
    config = await db.settings.find_one({})
    
    if not config:
        default_config = Settings()
        return default_config.dict()
    
    # Remove MongoDB _id field
    if '_id' in config:
        del config['_id']
    
    # Add next run time if scheduler is active
    next_run = None
    if scheduler.running:
        jobs = scheduler.get_jobs()
        if jobs:
            job = jobs[0]  # Get the crypto scan job
            if job.next_run_time:
                next_run = job.next_run_time.isoformat()
    
    config['next_run_time'] = next_run
    return config


@api_router.put("/config/schedule")
async def update_schedule_config(request: UpdateScheduleRequest):
    """Update schedule configuration and restart scheduler."""
    config_dict = request.dict()
    config_dict['updated_at'] = datetime.now(timezone.utc)
    
    # Upsert configuration
    await db.settings.update_one(
        {},
        {'$set': config_dict},
        upsert=True
    )
    
    # Restart scheduler with new config
    await restart_scheduler(config_dict)
    
    logger.info(f"Schedule updated: {request.schedule_interval} intervals, enabled={request.schedule_enabled}")
    return {"message": "Schedule configuration updated successfully"}


@api_router.get("/config/schedules/all")
async def get_all_schedules():
    """Get all saved schedule configurations."""
    # For now we only have one schedule (can extend to multiple later)
    current_schedule = await db.settings.find_one({})
    
    if not current_schedule:
        return {"schedules": []}
    
    # Add next run time
    next_run = None
    if scheduler.running:
        jobs = scheduler.get_jobs()
        if jobs:
            job = jobs[0]
            if job.next_run_time:
                next_run = job.next_run_time.isoformat()
    
    current_schedule['next_run_time'] = next_run
    current_schedule['schedule_id'] = 'default'  # For future multi-schedule support
    
    if '_id' in current_schedule:
        current_schedule['_id'] = str(current_schedule['_id'])
    
    return {"schedules": [current_schedule]}


@api_router.delete("/config/schedule/{schedule_id}")
async def delete_schedule(schedule_id: str):
    """Delete/disable a schedule."""
    if schedule_id == 'default':
        # Disable the schedule
        await db.settings.update_one(
            {},
            {'$set': {'schedule_enabled': False, 'updated_at': datetime.now(timezone.utc)}},
            upsert=True
        )
        
        # Stop scheduler
        if scheduler.running:
            scheduler.remove_all_jobs()
        
        logger.info("Schedule disabled")
        return {"message": "Schedule disabled successfully"}
    
    raise HTTPException(status_code=404, detail="Schedule not found")


# ==================== Coins Endpoint ====================

@api_router.get("/coins")
async def get_coins(scope: str = 'all'):
    """Get list of coins based on filter scope."""
    tokens_data = await scan_orchestrator.token_client.get_all_tokens(limit=100)
    coins = [symbol for symbol, name, price, token_id, trader_grade, investor_grade in tokens_data]
    
    if scope == 'alt':
        exclusions = ['BTC', 'ETH', 'USDT', 'USDC', 'DAI', 'TUSD', 'BUSD']
        coins = [c for c in coins if c not in exclusions]
    
    return {"coins": coins, "total": len(coins), "scope": scope}


# ==================== Scheduler Functions ====================

async def scheduled_scan_job():
    """Job function called by scheduler."""
    logger.info("Starting scheduled scan")
    
    try:
        # Get current settings
        settings = await db.settings.find_one({})
        filter_scope = settings.get('filter_scope', 'all') if settings else 'all'
        min_price = settings.get('min_price') if settings else None
        max_price = settings.get('max_price') if settings else None
        scan_type = settings.get('scan_type', 'quick_scan') if settings else 'quick_scan'
        
        # Run scan with configured scan type
        result = await scan_orchestrator.run_scan(
            filter_scope=filter_scope,
            min_price=min_price,
            max_price=max_price,
            scan_type=scan_type
        )
        
        # Send notifications
        integrations = await db.integrations_config.find_one({})
        if integrations:
            await scan_orchestrator.notify_results(
                run_id=result['run_id'],
                email_config=integrations,
                sheets_config=integrations
            )
        
        logger.info(f"Scheduled scan completed: {result['run_id']} with scan type: {scan_type}")
    
    except Exception as e:
        logger.error(f"Scheduled scan error: {e}")


async def track_outcomes_job():
    """Job function to track outcomes for pending recommendations."""
    logger.info("Starting scheduled outcome tracking")
    
    try:
        result = await outcome_tracker.track_all_pending_recommendations()
        
        if result:
            logger.info(f"Outcome tracking completed: {result.get('tracked_count', 0)} recommendations tracked")
        else:
            logger.warning("Outcome tracking returned no results")
    
    except Exception as e:
        logger.error(f"Scheduled outcome tracking error: {e}")


async def restart_scheduler(config: dict):
    """Restart scheduler with new configuration."""
    global scheduler
    
    # Remove existing jobs
    if scheduler.running:
        scheduler.remove_all_jobs()
    
    # Add new job if enabled
    if config.get('schedule_enabled'):
        interval = config.get('schedule_interval', '12h')
        start_time = config.get('schedule_start_time')  # HH:MM format
        tz_str = config.get('timezone', 'UTC')
        
        # Parse interval
        hours_map = {'6h': 6, '12h': 12, '24h': 24}
        hours = hours_map.get(interval, 12)
        
        # Create trigger
        from datetime import datetime
        import pytz
        
        # Get timezone
        try:
            tz = pytz.timezone(tz_str)
        except:
            tz = pytz.UTC
            logger.warning(f"Invalid timezone {tz_str}, using UTC")
        
        # If custom start time provided, calculate next run
        if start_time:
            try:
                # Parse HH:MM
                hour, minute = map(int, start_time.split(':'))
                
                # Calculate next occurrence
                now = datetime.now(tz)
                next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
                
                # If time has passed today, schedule for tomorrow
                if next_run <= now:
                    next_run = next_run + timedelta(days=1)
                
                # Add job with interval and start date
                scheduler.add_job(
                    scheduled_scan_job,
                    trigger=IntervalTrigger(hours=hours, start_date=next_run, timezone=tz),
                    id='crypto_scan_job',
                    replace_existing=True
                )
                
                logger.info(f"Scheduler configured: {interval} intervals starting at {start_time} {tz_str}, next run: {next_run}")
            except Exception as e:
                logger.error(f"Error parsing start time: {e}, falling back to immediate start")
                scheduler.add_job(
                    scheduled_scan_job,
                    trigger=IntervalTrigger(hours=hours, timezone=tz),
                    id='crypto_scan_job',
                    replace_existing=True
                )
        else:
            # No custom start time, start immediately
            scheduler.add_job(
                scheduled_scan_job,
                trigger=IntervalTrigger(hours=hours, timezone=tz),
                id='crypto_scan_job',
                replace_existing=True
            )
            
            logger.info(f"Scheduler configured: {interval} intervals (immediate start)")


# ==================== Startup & Shutdown ====================

@app.on_event("startup")
async def startup_event():
    """Initialize scheduler on startup."""
    logger.info("Starting Crypto Oracle API")
    
    # Start scheduler
    scheduler.start()
    logger.info("Scheduler started")
    
    # Load existing schedule config
    settings = await db.settings.find_one({})
    if settings and settings.get('schedule_enabled'):
        await restart_scheduler(settings)
    
    # Schedule outcome tracking to run every 15 minutes
    scheduler.add_job(
        track_outcomes_job,
        'interval',
        minutes=15,
        id='outcome_tracker',
        replace_existing=True
    )
    logger.info("Outcome tracking scheduled to run every 15 minutes")
    
    logger.info("Application startup complete")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("Shutting down application")
    
    # Shutdown scheduler
    if scheduler.running:
        scheduler.shutdown()
    
    # Close MongoDB connection
    client.close()
    
    # Close TokenMetrics client
    await scan_orchestrator.token_client.close()
    
    logger.info("Application shutdown complete")


# Include router
app.include_router(api_router)
