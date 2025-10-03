import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict
import logging

logger = logging.getLogger(__name__)

class ScanMonitor:
    """Monitor and protect scan operations with timeouts and health checks."""
    
    def __init__(self, default_timeout_minutes: int = 60):
        self.default_timeout_minutes = default_timeout_minutes
        self.current_scan_id: Optional[str] = None
        self.scan_start_time: Optional[datetime] = None
        self.scan_task: Optional[asyncio.Task] = None
        self.max_scan_time_minutes = {
            'quick_scan': 15,
            'smart_scan': 25,
            'focused_scan': 30,
            'deep_scan': 40,
            'all_in': 60,
            'lightning_fast': 10,
            'speed_run': 10,
            'turbo_scan': 12,
            'rapid_fire': 12,
            'default': 60
        }
        
    def start_monitoring(self, scan_id: str, scan_type: str = 'default'):
        """Start monitoring a new scan."""
        self.current_scan_id = scan_id
        self.scan_start_time = datetime.now(timezone.utc)
        timeout = self.max_scan_time_minutes.get(scan_type, self.default_timeout_minutes)
        logger.info(f"📊 Scan Monitor: Started monitoring scan {scan_id} (timeout: {timeout} min)")
        
    def stop_monitoring(self):
        """Stop monitoring current scan."""
        if self.current_scan_id:
            duration = (datetime.now(timezone.utc) - self.scan_start_time).total_seconds() / 60
            logger.info(f"✅ Scan Monitor: Scan {self.current_scan_id} completed in {duration:.1f} minutes")
        self.current_scan_id = None
        self.scan_start_time = None
        self.scan_task = None
        
    def is_scan_stuck(self, scan_type: str = 'default') -> bool:
        """Check if current scan has exceeded its timeout."""
        if not self.scan_start_time:
            return False
            
        max_time = self.max_scan_time_minutes.get(scan_type, self.default_timeout_minutes)
        elapsed = (datetime.now(timezone.utc) - self.scan_start_time).total_seconds() / 60
        
        if elapsed > max_time:
            logger.error(f"⚠️ Scan Monitor: Scan {self.current_scan_id} stuck! Elapsed: {elapsed:.1f} min, Max: {max_time} min")
            return True
        return False
    
    def get_scan_duration(self) -> Optional[float]:
        """Get current scan duration in minutes."""
        if not self.scan_start_time:
            return None
        return (datetime.now(timezone.utc) - self.scan_start_time).total_seconds() / 60
    
    def get_health_status(self) -> Dict:
        """Get current monitoring health status."""
        if not self.current_scan_id:
            return {
                'status': 'idle',
                'current_scan': None,
                'duration_minutes': None,
                'is_stuck': False
            }
        
        duration = self.get_scan_duration()
        is_stuck = self.is_scan_stuck()
        
        return {
            'status': 'stuck' if is_stuck else 'running',
            'current_scan': self.current_scan_id,
            'duration_minutes': round(duration, 2) if duration else None,
            'started_at': self.scan_start_time.isoformat() if self.scan_start_time else None,
            'is_stuck': is_stuck
        }
    
    async def cancel_scan(self):
        """Cancel current scan task."""
        if self.scan_task and not self.scan_task.done():
            logger.warning(f"⚠️ Scan Monitor: Cancelling stuck scan {self.current_scan_id}")
            self.scan_task.cancel()
            try:
                await self.scan_task
            except asyncio.CancelledError:
                logger.info(f"✅ Scan Monitor: Successfully cancelled scan {self.current_scan_id}")
        self.stop_monitoring()


# Global scan monitor instance
scan_monitor = ScanMonitor()
