"""
Portfolio Tracking Service with AI-Powered Insights

Features:
- Real-time portfolio value tracking
- AI-powered portfolio analysis and recommendations
- Risk assessment and diversification scoring
- Performance tracking with historical comparisons
"""

import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional
from emergentintegrations.llm.chat import LlmChat, UserMessage
import os

logger = logging.getLogger(__name__)


class PortfolioService:
    """Service for tracking and analyzing user portfolios with AI insights."""

    def __init__(self, db, crypto_client):
        self.db = db
        self.crypto_client = crypto_client
        self.api_key = os.environ.get('EMERGENT_LLM_KEY')
        logger.info("📊 Portfolio Service initialized")

    async def get_portfolio(self, user_id: str) -> Optional[Dict]:
        """Get user's portfolio with current values."""
        try:
            portfolio = await self.db.portfolios.find_one({'user_id': user_id})

            if not portfolio:
                return None

            # Calculate current values for all holdings
            holdings = portfolio.get('holdings', [])
            total_value = 0
            total_cost = 0

            for holding in holdings:
                symbol = holding['symbol']
                quantity = holding['quantity']
                avg_buy_price = holding['avg_buy_price']

                # Get current price
                all_coins = await self.crypto_client.get_all_coins(max_coins=500)
                current_price = next(
                    (coin[2] for coin in all_coins if coin[0] == symbol),
                    avg_buy_price
                )

                holding['current_price'] = current_price
                holding['current_value'] = quantity * current_price
                holding['cost_basis'] = quantity * avg_buy_price
                holding['profit_loss'] = holding['current_value'] - holding['cost_basis']
                holding['profit_loss_pct'] = (
                    (holding['profit_loss'] / holding['cost_basis'] * 100)
                    if holding['cost_basis'] > 0 else 0
                )

                total_value += holding['current_value']
                total_cost += holding['cost_basis']

            portfolio['total_value'] = total_value
            portfolio['total_cost'] = total_cost
            portfolio['total_profit_loss'] = total_value - total_cost
            portfolio['total_profit_loss_pct'] = (
                (portfolio['total_profit_loss'] / total_cost * 100)
                if total_cost > 0 else 0
            )
            portfolio['updated_at'] = datetime.now(timezone.utc)

            return portfolio

        except Exception as e:
            logger.error(f"Error fetching portfolio: {e}")
            return None

    async def add_holding(self, user_id: str, symbol: str, quantity: float, buy_price: float) -> Dict:
        """Add or update a holding in user's portfolio."""
        try:
            portfolio = await self.db.portfolios.find_one({'user_id': user_id})

            if not portfolio:
                # Create new portfolio
                portfolio = {
                    'user_id': user_id,
                    'holdings': [],
                    'created_at': datetime.now(timezone.utc),
                    'updated_at': datetime.now(timezone.utc)
                }

            holdings = portfolio.get('holdings', [])

            # Check if holding already exists
            existing_holding = next(
                (h for h in holdings if h['symbol'] == symbol),
                None
            )

            if existing_holding:
                # Update existing holding with new average
                old_quantity = existing_holding['quantity']
                old_avg_price = existing_holding['avg_buy_price']
                new_quantity = old_quantity + quantity
                new_avg_price = (
                    (old_quantity * old_avg_price + quantity * buy_price) / new_quantity
                )

                existing_holding['quantity'] = new_quantity
                existing_holding['avg_buy_price'] = new_avg_price
                existing_holding['updated_at'] = datetime.now(timezone.utc)
            else:
                # Add new holding
                holdings.append({
                    'symbol': symbol,
                    'quantity': quantity,
                    'avg_buy_price': buy_price,
                    'added_at': datetime.now(timezone.utc),
                    'updated_at': datetime.now(timezone.utc)
                })

            portfolio['holdings'] = holdings
            portfolio['updated_at'] = datetime.now(timezone.utc)

            # Upsert portfolio
            await self.db.portfolios.update_one(
                {'user_id': user_id},
                {'$set': portfolio},
                upsert=True
            )

            logger.info(f"Added holding: {quantity} {symbol} @ ${buy_price} for user {user_id}")
            return {'success': True, 'message': f'Added {quantity} {symbol}'}

        except Exception as e:
            logger.error(f"Error adding holding: {e}")
            return {'success': False, 'error': str(e)}

    async def remove_holding(self, user_id: str, symbol: str, quantity: Optional[float] = None) -> Dict:
        """Remove or reduce a holding from user's portfolio."""
        try:
            portfolio = await self.db.portfolios.find_one({'user_id': user_id})

            if not portfolio:
                return {'success': False, 'error': 'Portfolio not found'}

            holdings = portfolio.get('holdings', [])
            holding = next((h for h in holdings if h['symbol'] == symbol), None)

            if not holding:
                return {'success': False, 'error': f'{symbol} not found in portfolio'}

            if quantity is None or quantity >= holding['quantity']:
                # Remove entire holding
                holdings = [h for h in holdings if h['symbol'] != symbol]
                message = f'Removed all {symbol} holdings'
            else:
                # Reduce quantity
                holding['quantity'] -= quantity
                holding['updated_at'] = datetime.now(timezone.utc)
                message = f'Reduced {symbol} by {quantity}'

            portfolio['holdings'] = holdings
            portfolio['updated_at'] = datetime.now(timezone.utc)

            await self.db.portfolios.update_one(
                {'user_id': user_id},
                {'$set': portfolio}
            )

            logger.info(f"{message} for user {user_id}")
            return {'success': True, 'message': message}

        except Exception as e:
            logger.error(f"Error removing holding: {e}")
            return {'success': False, 'error': str(e)}

    async def analyze_portfolio_with_ai(self, user_id: str) -> Dict:
        """Use AI to analyze portfolio and provide insights."""
        if not self.api_key:
            return {
                'analysis': 'AI analysis unavailable - missing API key',
                'risk_score': 5,
                'diversification_score': 5,
                'recommendations': []
            }

        try:
            portfolio = await self.get_portfolio(user_id)

            if not portfolio or not portfolio.get('holdings'):
                return {
                    'analysis': 'No holdings in portfolio',
                    'risk_score': 0,
                    'diversification_score': 0,
                    'recommendations': ['Add holdings to your portfolio to get AI insights']
                }

            # Prepare portfolio data for AI
            holdings_summary = []
            for holding in portfolio['holdings']:
                holdings_summary.append({
                    'symbol': holding['symbol'],
                    'value': holding.get('current_value', 0),
                    'allocation_pct': (
                        holding.get('current_value', 0) / portfolio['total_value'] * 100
                        if portfolio['total_value'] > 0 else 0
                    ),
                    'profit_loss_pct': holding.get('profit_loss_pct', 0)
                })

            # Initialize AI chat
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"portfolio_analysis_{user_id}",
                system_message="""You are an expert cryptocurrency portfolio analyst.
                Analyze portfolios for risk, diversification, and provide actionable recommendations.
                Be concise and specific."""
            ).with_model("openai", "gpt-5")

            # Create analysis prompt
            prompt = f"""Analyze this cryptocurrency portfolio:

PORTFOLIO SUMMARY:
- Total Value: ${portfolio['total_value']:.2f}
- Total P/L: ${portfolio['total_profit_loss']:.2f} ({portfolio['total_profit_loss_pct']:.1f}%)
- Number of Holdings: {len(holdings_summary)}

HOLDINGS:
{chr(10).join([f"- {h['symbol']}: ${h['value']:.2f} ({h['allocation_pct']:.1f}% allocation, {h['profit_loss_pct']:.1f}% P/L)" for h in holdings_summary])}

Provide:
1. RISK_SCORE: [1-10 where 10 is highest risk]
2. DIVERSIFICATION_SCORE: [1-10 where 10 is best diversified]
3. ANALYSIS: [2-3 sentence portfolio assessment]
4. RECOMMENDATIONS: [3-5 specific actionable recommendations]

Format as:
RISK_SCORE: X
DIVERSIFICATION_SCORE: Y
ANALYSIS: [your analysis]
RECOMMENDATIONS:
- [recommendation 1]
- [recommendation 2]
- [recommendation 3]"""

            message = UserMessage(text=prompt)
            response = await chat.send_message(message)

            # Parse AI response
            risk_score = 5
            diversification_score = 5
            analysis = response
            recommendations = []

            if 'RISK_SCORE:' in response:
                risk_line = [l for l in response.split('\n') if 'RISK_SCORE:' in l][0]
                risk_score = int(''.join(filter(str.isdigit, risk_line)) or '5')

            if 'DIVERSIFICATION_SCORE:' in response:
                div_line = [l for l in response.split('\n') if 'DIVERSIFICATION_SCORE:' in l][0]
                diversification_score = int(''.join(filter(str.isdigit, div_line)) or '5')

            if 'ANALYSIS:' in response:
                analysis = response.split('ANALYSIS:')[1].split('RECOMMENDATIONS:')[0].strip()

            if 'RECOMMENDATIONS:' in response:
                rec_text = response.split('RECOMMENDATIONS:')[1]
                recommendations = [
                    line.strip().lstrip('-').strip()
                    for line in rec_text.split('\n')
                    if line.strip() and line.strip().startswith('-')
                ]

            result = {
                'analysis': analysis,
                'risk_score': risk_score,
                'diversification_score': diversification_score,
                'recommendations': recommendations,
                'analyzed_at': datetime.now(timezone.utc)
            }

            logger.info(f"AI portfolio analysis completed for user {user_id}")
            return result

        except Exception as e:
            logger.error(f"Error in AI portfolio analysis: {e}")
            return {
                'analysis': f'Analysis error: {str(e)}',
                'risk_score': 5,
                'diversification_score': 5,
                'recommendations': ['Unable to generate recommendations']
            }
