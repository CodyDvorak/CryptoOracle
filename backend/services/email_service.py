import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

class EmailService:
    """Email notification service via SMTP."""
    
    def __init__(self, smtp_host: str, smtp_port: int, smtp_user: str, smtp_pass: str):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_user = smtp_user
        self.smtp_pass = smtp_pass
    
    def send_top5_notification(self, recipient: str, recommendations: List[Dict], run_id: str) -> bool:
        """Send Top 5 recommendations email.
        
        Args:
            recipient: Email address to send to
            recommendations: List of top 5 recommendation dicts
            run_id: Scan run ID
        
        Returns:
            True if sent successfully, False otherwise
        """
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = f"Crypto Oracle: Top 5 Coin Predictions (Run {run_id[:8]})"
            msg['From'] = self.smtp_user
            msg['To'] = recipient
            
            # Create HTML email body
            html_body = self._create_html_email(recommendations, run_id)
            html_part = MIMEText(html_body, 'html')
            msg.attach(html_part)
            
            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_pass)
                server.send_message(msg)
            
            logger.info(f"Email sent successfully to {recipient}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False
    
    def _create_html_email(self, recommendations: List[Dict], run_id: str) -> str:
        """Create HTML email body."""
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; background-color: #0b0f14; color: #e7eef5; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #16d3b0 0%, #22b8f0 100%); padding: 20px; border-radius: 10px; margin-bottom: 20px; }}
                .coin-card {{ background-color: #12161d; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 15px; margin-bottom: 15px; }}
                .coin-header {{ font-size: 18px; font-weight: bold; color: #16d3b0; margin-bottom: 10px; }}
                .direction {{ display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: bold; }}
                .long {{ background-color: #2dd4bf; color: black; }}
                .short {{ background-color: #ff6b6b; color: white; }}
                .metrics {{ margin-top: 10px; }}
                .metric {{ display: inline-block; margin-right: 20px; }}
                .label {{ color: #99a3ad; font-size: 12px; }}
                .value {{ color: #e7eef5; font-weight: bold; font-family: 'Courier New', monospace; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 style="margin: 0; color: #0b0f14;">🔮 Crypto Oracle</h1>
                    <p style="margin: 5px 0 0 0; color: #0b0f14;">Top 5 AI-Powered Predictions</p>
                </div>
        """
        
        for i, rec in enumerate(recommendations, 1):
            coin = rec.get('coin', 'N/A')
            direction = rec.get('consensus_direction', 'long')
            confidence = rec.get('avg_confidence', 5)
            entry = rec.get('avg_entry', 0)
            tp = rec.get('avg_take_profit', 0)
            sl = rec.get('avg_stop_loss', 0)
            
            html += f"""
                <div class="coin-card">
                    <div class="coin-header">#{i} {coin}</div>
                    <span class="direction {'long' if direction == 'long' else 'short'}">{direction.upper()}</span>
                    <div class="metrics">
                        <div class="metric">
                            <div class="label">Confidence</div>
                            <div class="value">{confidence:.1f}/10</div>
                        </div>
                        <div class="metric">
                            <div class="label">Entry</div>
                            <div class="value">${entry:.2f}</div>
                        </div>
                        <div class="metric">
                            <div class="label">Take Profit</div>
                            <div class="value">${tp:.2f}</div>
                        </div>
                        <div class="metric">
                            <div class="label">Stop Loss</div>
                            <div class="value">${sl:.2f}</div>
                        </div>
                    </div>
                </div>
            """
        
        html += f"""
                <p style="margin-top: 30px; font-size: 12px; color: #99a3ad; text-align: center;">
                    Run ID: {run_id}<br>
                    This analysis was generated by 20 AI bots analyzing 2 years of historical data.<br>
                    <em>Not financial advice. DYOR.</em>
                </p>
            </div>
        </body>
        </html>
        """
        
        return html