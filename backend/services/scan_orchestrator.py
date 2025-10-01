import asyncio
from typing import List, Dict, Optional
import logging
from datetime import datetime, timezone

from services.coinalyze_client import CoinalyzeClient
from services.indicator_engine import IndicatorEngine
from services.llm_synthesis_service import LLMSynthesisService
from services.aggregation_engine import AggregationEngine
from services.email_service import EmailService
from services.google_sheets_service import GoogleSheetsService
from bots.bot_strategies import get_all_bots
from models.models import ScanRun, BotResult, Recommendation

logger = logging.getLogger(__name__)

class ScanOrchestrator:
    """Orchestrates the entire scanning process: data fetch -> bot analysis -> aggregation."""
    
    def __init__(self, db, coinalyze_api_key: str):
        self.db = db
        self.coinalyze_client = CoinalyzeClient(coinalyze_api_key)
        self.indicator_engine = IndicatorEngine()
        self.llm_service = LLMSynthesisService()
        self.aggregation_engine = AggregationEngine()
        self.bots = get_all_bots()
        
    async def run_scan(self, filter_scope: str = 'all', run_id: Optional[str] = None) -> Dict:
        """Execute a full scan of all coins.
        
        Args:
            filter_scope: 'all' or 'alt' (exclude major coins)
            run_id: Optional run ID (generated if not provided)
        
        Returns:
            Dict with run_id, status, recommendations
        """
        # Create scan run record
        scan_run = ScanRun(
            id=run_id or ScanRun().id,
            filter_scope=filter_scope,
            status='running'
        )
        await self.db.scan_runs.insert_one(scan_run.dict())
        logger.info(f"Starting scan run {scan_run.id} with scope={filter_scope}")
        
        try:
            # 1. Fetch coin list
            all_coins = await self.coinalyze_client.get_coins()
            
            # 2. Apply filter
            if filter_scope == 'alt':
                # Exclude major coins and stablecoins
                exclusions = ['BTC', 'ETH', 'USDT', 'USDC', 'DAI', 'TUSD', 'BUSD', 'USDC', 'USDD']
                coins = [c for c in all_coins if c not in exclusions]
            else:
                coins = all_coins
            
            logger.info(f"Analyzing {len(coins)} coins (all available from Coinalyze)")
            scan_run.total_coins = len(coins)
            
            # 3. Analyze each coin
            all_aggregated_results = []
            
            for coin in coins:
                try:
                    coin_result = await self._analyze_coin(coin, scan_run.id)
                    if coin_result:
                        all_aggregated_results.append(coin_result)
                except Exception as e:
                    logger.error(f"Error analyzing {coin}: {e}")
                    continue
            
            # 4. Get Top 5
            top_5 = self.aggregation_engine.get_top_n(all_aggregated_results, n=5)
            
            # 5. Save recommendations to DB
            for rec_data in top_5:
                recommendation = Recommendation(
                    run_id=scan_run.id,
                    **rec_data
                )
                await self.db.recommendations.insert_one(recommendation.dict())
            
            # 6. Update scan run status
            scan_run.status = 'completed'
            scan_run.completed_at = datetime.now(timezone.utc)
            await self.db.scan_runs.update_one(
                {'id': scan_run.id},
                {'$set': scan_run.dict()}
            )
            
            logger.info(f"Scan run {scan_run.id} completed. Top 5: {[r['coin'] for r in top_5]}")
            
            return {
                'run_id': scan_run.id,
                'status': 'completed',
                'total_coins': len(coins),
                'recommendations': top_5
            }
            
        except Exception as e:
            logger.error(f"Scan run {scan_run.id} failed: {e}")
            scan_run.status = 'failed'
            scan_run.error_message = str(e)
            scan_run.completed_at = datetime.now(timezone.utc)
            await self.db.scan_runs.update_one(
                {'id': scan_run.id},
                {'$set': scan_run.dict()}
            )
            
            return {
                'run_id': scan_run.id,
                'status': 'failed',
                'error': str(e)
            }
    
    async def _analyze_coin(self, coin: str, run_id: str) -> Optional[Dict]:
        """Analyze a single coin with all bots.
        
        Args:
            coin: Coin symbol
            run_id: Scan run ID
        
        Returns:
            Aggregated result dict or None if insufficient data
        """
        try:
            # 1. Fetch OHLCV data (2 years)
            candles = await self.coinalyze_client.get_ohlcv(coin, days=730)
            
            if len(candles) < 50:
                logger.warning(f"Insufficient data for {coin}: {len(candles)} candles")
                return None
            
            # 2. Compute indicators
            features = self.indicator_engine.compute_all_indicators(candles)
            
            if not features:
                logger.warning(f"Failed to compute indicators for {coin}")
                return None
            
            # 3. Run all bots
            bot_results = []
            current_price = features.get('current_price', 0)
            
            for bot in self.bots:
                try:
                    result = bot.analyze(features)
                    if result:
                        # Ensure predicted prices exist (fallback to current price)
                        if 'predicted_24h' not in result:
                            result['predicted_24h'] = current_price
                        if 'predicted_48h' not in result:
                            result['predicted_48h'] = current_price
                        if 'predicted_7d' not in result:
                            result['predicted_7d'] = current_price
                        
                        # Save bot result to DB
                        bot_result = BotResult(
                            run_id=run_id,
                            coin=coin,
                            bot_name=bot.name,
                            direction=result['direction'],
                            entry_price=result['entry'],
                            take_profit=result['take_profit'],
                            stop_loss=result['stop_loss'],
                            confidence=result['confidence'],
                            rationale=result['rationale'],
                            predicted_24h=result.get('predicted_24h'),
                            predicted_48h=result.get('predicted_48h'),
                            predicted_7d=result.get('predicted_7d')
                        )
                        await self.db.bot_results.insert_one(bot_result.dict())
                        bot_results.append(result)
                except Exception as e:
                    logger.error(f"Bot {bot.name} failed for {coin}: {e}", exc_info=True)
            
            if not bot_results:
                logger.warning(f"No bot results for {coin}")
                return None
            
            # 4. Aggregate results
            aggregated = self.aggregation_engine.aggregate_coin_results(coin, bot_results, current_price)
            
            # 5. Optional: LLM synthesis (if time permits)
            # This adds enhanced rationale but is not critical for MVP
            try:
                enhanced_rationale = await self.llm_service.synthesize_recommendations(coin, bot_results, features)
                aggregated['rationale'] = enhanced_rationale
            except Exception as e:
                logger.warning(f"LLM synthesis skipped for {coin}: {e}")
                aggregated['rationale'] = f"{len(bot_results)} bots analyzed"
            
            logger.info(f"Successfully analyzed {coin}: {len(bot_results)} bot results, confidence={aggregated.get('avg_confidence', 0):.1f}")
            return aggregated
            
        except Exception as e:
            logger.error(f"Critical error analyzing {coin}: {e}", exc_info=True)
            return None
    
    async def notify_results(self, run_id: str, email_config: Dict, sheets_config: Dict):
        """Send notifications via email and Google Sheets.
        
        Args:
            run_id: Scan run ID
            email_config: Email configuration dict
            sheets_config: Google Sheets configuration dict
        """
        import os
        
        # Fetch recommendations
        recommendations = await self.db.recommendations.find({'run_id': run_id}).to_list(5)
        
        if not recommendations:
            logger.warning(f"No recommendations found for run {run_id}")
            return
        
        # Email notification
        email_enabled = email_config.get('email_enabled', False)
        email_to = email_config.get('email_to') or os.environ.get('SMTP_USER')
        
        if email_enabled and email_to:
            try:
                # Use config or env variables
                smtp_host = email_config.get('smtp_host') or os.environ.get('SMTP_HOST', 'smtp.gmail.com')
                smtp_port = email_config.get('smtp_port') or int(os.environ.get('SMTP_PORT', 587))
                smtp_user = email_config.get('smtp_user') or os.environ.get('SMTP_USER', '')
                smtp_pass = email_config.get('smtp_pass') or os.environ.get('SMTP_PASS', '')
                
                email_service = EmailService(
                    smtp_host=smtp_host,
                    smtp_port=smtp_port,
                    smtp_user=smtp_user,
                    smtp_pass=smtp_pass
                )
                email_service.send_top5_notification(
                    recipient=email_to,
                    recommendations=recommendations,
                    run_id=run_id
                )
                logger.info(f"Email notification sent to {email_to}")
            except Exception as e:
                logger.error(f"Email notification failed: {e}")
        
        # Google Sheets logging
        if sheets_config.get('sheets_enabled') and sheets_config.get('sheet_id'):
            try:
                sheets_service = GoogleSheetsService()
                sheets_service.append_recommendations(
                    sheet_id=sheets_config['sheet_id'],
                    worksheet_name=sheets_config.get('worksheet', 'Sheet1'),
                    recommendations=recommendations,
                    run_id=run_id
                )
                logger.info(f"Recommendations logged to Google Sheets")
            except Exception as e:
                logger.error(f"Google Sheets logging failed: {e}")