import gspread
from oauth2client.service_account import ServiceAccountCredentials
from typing import List, Dict, Optional
import logging
import re

logger = logging.getLogger(__name__)

class GoogleSheetsService:
    """Google Sheets integration for logging recommendations."""
    
    def __init__(self, credentials_json: Optional[Dict] = None):
        self.credentials_json = credentials_json
        self.client = None
    
    def extract_sheet_id(self, sheet_url: str) -> Optional[str]:
        """Extract Google Sheet ID from URL.
        
        Args:
            sheet_url: Full Google Sheets URL
        
        Returns:
            Sheet ID or None if not found
        """
        # Pattern: https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit...
        match = re.search(r'/spreadsheets/d/([a-zA-Z0-9-_]+)', sheet_url)
        if match:
            return match.group(1)
        return None
    
    def authenticate(self) -> bool:
        """Authenticate with Google Sheets API.
        
        Returns:
            True if successful, False otherwise
        """
        if self.client:
            return True
        
        if not self.credentials_json:
            logger.warning("No Google Sheets credentials configured")
            return False
        
        try:
            scope = [
                'https://spreadsheets.google.com/feeds',
                'https://www.googleapis.com/auth/drive'
            ]
            creds = ServiceAccountCredentials.from_json_keyfile_dict(self.credentials_json, scope)
            self.client = gspread.authorize(creds)
            logger.info("Google Sheets authentication successful")
            return True
        except Exception as e:
            logger.error(f"Google Sheets authentication failed: {e}")
            return False
    
    def append_recommendations(self, sheet_id: str, worksheet_name: str, recommendations: List[Dict], run_id: str) -> bool:
        """Append recommendations to Google Sheet.
        
        Args:
            sheet_id: Google Sheet ID
            worksheet_name: Name of the worksheet (e.g., 'Sheet1')
            recommendations: List of recommendation dicts
            run_id: Scan run ID
        
        Returns:
            True if successful, False otherwise
        """
        if not self.authenticate():
            logger.error("Cannot append to sheets: authentication failed")
            return False
        
        try:
            spreadsheet = self.client.open_by_key(sheet_id)
            
            # Try to get worksheet, create if doesn't exist
            try:
                worksheet = spreadsheet.worksheet(worksheet_name)
            except gspread.exceptions.WorksheetNotFound:
                worksheet = spreadsheet.add_worksheet(title=worksheet_name, rows="1000", cols="10")
                # Add header row
                headers = ['Run ID', 'Timestamp', 'Coin', 'Direction', 'Confidence', 'Entry', 'Take Profit', 'Stop Loss', 'Bot Count']
                worksheet.append_row(headers)
            
            # Append each recommendation
            from datetime import datetime, timezone
            timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
            
            for rec in recommendations:
                row = [
                    run_id[:8],
                    timestamp,
                    rec.get('coin', ''),
                    rec.get('consensus_direction', ''),
                    f"{rec.get('avg_confidence', 0):.1f}",
                    f"{rec.get('avg_entry', 0):.2f}",
                    f"{rec.get('avg_take_profit', 0):.2f}",
                    f"{rec.get('avg_stop_loss', 0):.2f}",
                    str(rec.get('bot_count', 20))
                ]
                worksheet.append_row(row)
            
            logger.info(f"Appended {len(recommendations)} recommendations to Google Sheets")
            return True
            
        except Exception as e:
            logger.error(f"Failed to append to Google Sheets: {e}")
            return False