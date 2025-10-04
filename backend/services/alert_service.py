"""
Alert & Notification Service with AI-Powered Smart Alerts

Features:
- Price alerts (above/below thresholds)
- AI-powered pattern detection alerts
- Risk warning alerts
- Custom alert conditions
- Multi-channel notifications (email, in-app)
"""

import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional
from emergentintegrations.llm.chat import LlmChat, UserMessage
import os

logger = logging.getLogger(__name__)


class AlertService:
    """Service for managing alerts and notifications with AI assistance."""

    def __init__(self, db, crypto_client, email_service=None):
        self.db = db
        self.crypto_client = crypto_client
        self.email_service = email_service
        self.api_key = os.environ.get('EMERGENT_LLM_KEY')
        logger.info("🔔 Alert Service initialized")

    async def create_alert(
        self,
        user_id: str,
        symbol: str,
        alert_type: str,
        condition: Dict,
        notification_channels: List[str] = None
    ) -> Dict:
        """Create a new alert for a user.

        Args:
            user_id: User ID
            symbol: Coin symbol
            alert_type: 'price_above', 'price_below', 'percent_change', 'ai_pattern'
            condition: Alert condition parameters
            notification_channels: List of channels ['email', 'in_app']
        """
        try:
            alert = {
                'id': f"alert_{datetime.now(timezone.utc).timestamp()}",
                'user_id': user_id,
                'symbol': symbol,
                'alert_type': alert_type,
                'condition': condition,
                'notification_channels': notification_channels or ['in_app'],
                'status': 'active',
                'triggered_count': 0,
                'created_at': datetime.now(timezone.utc),
                'last_checked': None,
                'last_triggered': None
            }

            await self.db.alerts.insert_one(alert)

            logger.info(f"Created alert for user {user_id}: {alert_type} on {symbol}")
            return {'success': True, 'alert_id': alert['id'], 'alert': alert}

        except Exception as e:
            logger.error(f"Error creating alert: {e}")
            return {'success': False, 'error': str(e)}

    async def get_user_alerts(self, user_id: str, status: Optional[str] = None) -> List[Dict]:
        """Get all alerts for a user."""
        try:
            query = {'user_id': user_id}
            if status:
                query['status'] = status

            alerts = await self.db.alerts.find(query).sort('created_at', -1).to_list(100)
            return alerts

        except Exception as e:
            logger.error(f"Error fetching alerts: {e}")
            return []

    async def delete_alert(self, user_id: str, alert_id: str) -> Dict:
        """Delete an alert."""
        try:
            result = await self.db.alerts.delete_one({
                'id': alert_id,
                'user_id': user_id
            })

            if result.get('deleted_count', 0) > 0:
                logger.info(f"Deleted alert {alert_id} for user {user_id}")
                return {'success': True, 'message': 'Alert deleted'}
            else:
                return {'success': False, 'error': 'Alert not found'}

        except Exception as e:
            logger.error(f"Error deleting alert: {e}")
            return {'success': False, 'error': str(e)}

    async def check_alerts(self) -> Dict:
        """Check all active alerts and trigger notifications."""
        try:
            # Get all active alerts
            alerts = await self.db.alerts.find({'status': 'active'}).to_list(1000)

            triggered_count = 0
            checked_count = 0

            for alert in alerts:
                checked_count += 1
                triggered = await self._check_single_alert(alert)
                if triggered:
                    triggered_count += 1

            logger.info(f"Alert check complete: {checked_count} checked, {triggered_count} triggered")
            return {
                'checked': checked_count,
                'triggered': triggered_count
            }

        except Exception as e:
            logger.error(f"Error checking alerts: {e}")
            return {'checked': 0, 'triggered': 0}

    async def _check_single_alert(self, alert: Dict) -> bool:
        """Check a single alert and trigger if condition met."""
        try:
            symbol = alert['symbol']
            alert_type = alert['alert_type']
            condition = alert['condition']

            # Get current price
            all_coins = await self.crypto_client.get_all_coins(max_coins=500)
            current_price = next(
                (coin[2] for coin in all_coins if coin[0] == symbol),
                None
            )

            if current_price is None:
                logger.warning(f"Could not get price for {symbol}")
                return False

            # Update last checked time
            await self.db.alerts.update_one(
                {'id': alert['id']},
                {'$set': {'last_checked': datetime.now(timezone.utc)}}
            )

            # Check alert condition
            triggered = False

            if alert_type == 'price_above':
                threshold = condition.get('price', 0)
                if current_price > threshold:
                    triggered = True

            elif alert_type == 'price_below':
                threshold = condition.get('price', 0)
                if current_price < threshold:
                    triggered = True

            elif alert_type == 'percent_change':
                # Get historical price
                timeframe = condition.get('timeframe', '24h')
                threshold_pct = condition.get('percent', 0)

                # Calculate percent change
                # (Simplified - would need historical data)
                # For now, skip this type
                pass

            elif alert_type == 'ai_pattern':
                # AI-powered pattern detection
                if self.api_key:
                    triggered = await self._check_ai_pattern(symbol, current_price, condition)

            if triggered:
                await self._trigger_alert(alert, current_price)
                return True

            return False

        except Exception as e:
            logger.error(f"Error checking alert {alert.get('id')}: {e}")
            return False

    async def _check_ai_pattern(self, symbol: str, current_price: float, condition: Dict) -> bool:
        """Use AI to detect trading patterns."""
        try:
            # Get recent data
            historical_data = await self.crypto_client.get_historical_data(symbol, days=7)

            if not historical_data or len(historical_data) < 5:
                return False

            # Initialize AI chat
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"pattern_detection_{symbol}",
                system_message="""You are a technical analysis expert.
                Detect chart patterns and market conditions. Be concise."""
            ).with_model("openai", "gpt-5")

            # Extract price data
            prices = [candle.get('close', 0) for candle in historical_data[-20:]]

            pattern_type = condition.get('pattern', 'any')

            prompt = f"""Analyze recent price action for {symbol}:
Current Price: ${current_price:.6f}
Recent Prices: {prices[-10:]}

Looking for: {pattern_type}

Does this show a {pattern_type} pattern? Reply with only YES or NO."""

            message = UserMessage(text=prompt)
            response = await chat.send_message(message)

            return 'YES' in response.upper()

        except Exception as e:
            logger.error(f"AI pattern detection error: {e}")
            return False

    async def _trigger_alert(self, alert: Dict, current_value: float):
        """Trigger an alert and send notifications."""
        try:
            # Update alert
            await self.db.alerts.update_one(
                {'id': alert['id']},
                {
                    '$set': {
                        'last_triggered': datetime.now(timezone.utc),
                        'status': 'triggered'
                    },
                    '$inc': {'triggered_count': 1}
                }
            )

            # Create notification
            notification = {
                'user_id': alert['user_id'],
                'type': 'alert',
                'title': f"Alert Triggered: {alert['symbol']}",
                'message': self._format_alert_message(alert, current_value),
                'data': {
                    'alert_id': alert['id'],
                    'symbol': alert['symbol'],
                    'current_value': current_value
                },
                'read': False,
                'created_at': datetime.now(timezone.utc)
            }

            await self.db.notifications.insert_one(notification)

            # Send email if requested
            if 'email' in alert.get('notification_channels', []):
                if self.email_service:
                    await self._send_email_notification(alert, notification)

            logger.info(f"Alert triggered: {alert['id']} for {alert['symbol']}")

        except Exception as e:
            logger.error(f"Error triggering alert: {e}")

    def _format_alert_message(self, alert: Dict, current_value: float) -> str:
        """Format alert notification message."""
        symbol = alert['symbol']
        alert_type = alert['alert_type']
        condition = alert['condition']

        if alert_type == 'price_above':
            return f"{symbol} is now ${current_value:.6f}, above your threshold of ${condition.get('price', 0):.6f}"
        elif alert_type == 'price_below':
            return f"{symbol} is now ${current_value:.6f}, below your threshold of ${condition.get('price', 0):.6f}"
        elif alert_type == 'ai_pattern':
            return f"{symbol} detected pattern: {condition.get('pattern', 'unknown')} at ${current_value:.6f}"
        else:
            return f"Alert triggered for {symbol} at ${current_value:.6f}"

    async def _send_email_notification(self, alert: Dict, notification: Dict):
        """Send email notification (if email service available)."""
        if not self.email_service:
            return

        try:
            # Get user email
            user = await self.db.users.find_one({'id': alert['user_id']})
            if not user or not user.get('email'):
                return

            subject = notification['title']
            body = f"""
{notification['message']}

Alert Details:
- Symbol: {alert['symbol']}
- Type: {alert['alert_type']}
- Triggered: {notification['created_at']}

View your dashboard for more details.
            """

            await self.email_service.send_email(
                to_email=user['email'],
                subject=subject,
                body=body
            )

            logger.info(f"Email notification sent to {user['email']}")

        except Exception as e:
            logger.error(f"Error sending email notification: {e}")
