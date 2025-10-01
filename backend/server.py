from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
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
    ScanRunRequest, Top5Response, UpdateIntegrationsRequest, UpdateScheduleRequest
)
from services.scan_orchestrator import ScanOrchestrator

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
tokenmetrics_api_key = os.environ.get('TOKENMETRICS_API_KEY', 'tm-8575b687-030b-4832-abbe-14d88f4c19c0')
scan_orchestrator = ScanOrchestrator(db, tokenmetrics_api_key)
scheduler = AsyncIOScheduler()
current_scan_task: Optional[asyncio.Task] = None
bot_statuses = {}


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


# ==================== Scan Endpoints ====================

@api_router.post("/scan/run")
async def run_scan(request: ScanRunRequest, background_tasks: BackgroundTasks):
    """Trigger a manual scan of all coins.
    
    This runs in the background and returns immediately.
    """
    global current_scan_task
    
    # Check if a scan is already running
    if current_scan_task and not current_scan_task.done():
        raise HTTPException(status_code=409, detail="A scan is already running")
    
    # Start scan in background
    async def run_scan_task():
        try:
            logger.info(f"Background scan task starting with scope={request.scope}, min_price={request.min_price}, max_price={request.max_price}")
            result = await scan_orchestrator.run_scan(
                filter_scope=request.scope, 
                min_price=request.min_price, 
                max_price=request.max_price,
                custom_symbols=request.custom_symbols if hasattr(request, 'custom_symbols') else None
            )
            logger.info(f"Scan completed: {result}")
            
            # Send notifications if configured
            integrations = await db.integrations_config.find_one({})
            if integrations:
                logger.info("Sending notifications...")
                await scan_orchestrator.notify_results(
                    run_id=result['run_id'],
                    email_config=integrations,
                    sheets_config=integrations
                )
            
            return result
        except Exception as e:
            logger.error(f"CRITICAL: Scan task error: {e}", exc_info=True)
            raise
    
    current_scan_task = asyncio.create_task(run_scan_task())
    
    return {
        "message": "Scan started",
        "status": "running",
        "scope": request.scope
    }


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
async def get_top5_recommendations(run_id: Optional[str] = None):
    """Get Top 5 recommendations categorized by confidence, % movers, and $ movers.
    
    If run_id is not provided, returns from the most recent completed run.
    """
    if not run_id:
        # Get most recent completed run
        recent_run = await db.scan_runs.find_one(
            {'status': 'completed'},
            sort=[('completed_at', -1)]
        )
        
        if not recent_run:
            raise HTTPException(status_code=404, detail="No completed scans found")
        
        run_id = recent_run['id']
    
    # Fetch all recommendations
    all_recs = await db.recommendations.find({'run_id': run_id}).to_list(100)
    
    if not all_recs:
        raise HTTPException(status_code=404, detail=f"No recommendations found for run {run_id}")
    
    # Convert ObjectId to string
    for rec in all_recs:
        if '_id' in rec:
            rec['_id'] = str(rec['_id'])
    
    # Categorize recommendations
    top_confidence = [r for r in all_recs if r.get('category') == 'confidence'][:5]
    top_percent = [r for r in all_recs if r.get('category') == 'percent_mover'][:5]
    top_dollar = [r for r in all_recs if r.get('category') == 'dollar_mover'][:5]
    
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


# ==================== Bots Status ====================

@api_router.get("/bots/status")
async def get_bots_status():
    """Get status of all 20 bots."""
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
        
        # Run scan
        result = await scan_orchestrator.run_scan(
            filter_scope=filter_scope,
            min_price=min_price,
            max_price=max_price
        )
        
        # Send notifications
        integrations = await db.integrations_config.find_one({})
        if integrations:
            await scan_orchestrator.notify_results(
                run_id=result['run_id'],
                email_config=integrations,
                sheets_config=integrations
            )
        
        logger.info(f"Scheduled scan completed: {result['run_id']}")
    
    except Exception as e:
        logger.error(f"Scheduled scan error: {e}")


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
