"""
Pre-Analysis Sentiment & News Service using OpenAI ChatGPT-5
Layer 1 of Triple-Layer LLM Integration
"""
import logging
import os
from typing import Dict, Optional
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv()

logger = logging.getLogger(__name__)


class SentimentAnalysisService:
    """Pre-analysis service for market sentiment and fundamental analysis using OpenAI ChatGPT-5."""
    
    def __init__(self):
        self.api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not self.api_key:
            logger.warning("EMERGENT_LLM_KEY not found, sentiment analysis will be limited")
    
    async def analyze_market_sentiment(self, symbol: str, coin_name: str, current_price: float) -> Dict:
        """
        Analyze overall market sentiment for a coin using ChatGPT-5.
        
        Args:
            symbol: Coin symbol (e.g., 'BTC')
            coin_name: Coin display name
            current_price: Current price
        
        Returns:
            Dict with sentiment analysis results
        """
        if not self.api_key:
            return {
                'sentiment_score': 5,  # Neutral
                'sentiment_text': 'neutral',
                'fundamental_notes': 'Sentiment analysis unavailable',
                'risk_level': 'medium'
            }
        
        try:
            # Initialize ChatGPT-5 chat
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"sentiment_{symbol}",
                system_message="""You are a cryptocurrency market analyst specializing in sentiment analysis and fundamental evaluation. 
                Provide concise, actionable insights about market sentiment, adoption trends, and fundamental strength."""
            ).with_model("openai", "gpt-5")
            
            # Create analysis prompt
            user_message = UserMessage(
                text=f"""Analyze {coin_name} ({symbol}) currently trading at ${current_price}.

Provide a brief analysis covering:
1. Overall market sentiment (bullish/neutral/bearish)
2. Key fundamentals (adoption, technology, team, use case)
3. Current market narrative around this coin
4. Risk assessment (low/medium/high)

Keep response under 100 words. Format:
SENTIMENT: [bullish/neutral/bearish]
SCORE: [1-10 where 10 is most bullish]
RISK: [low/medium/high]
NOTES: [brief fundamental analysis]"""
            )
            
            # Get analysis from ChatGPT-5
            response = await chat.send_message(user_message)
            
            # Parse response
            sentiment_score = 5  # Default neutral
            sentiment_text = 'neutral'
            risk_level = 'medium'
            notes = response
            
            # Extract structured data from response
            if 'SENTIMENT:' in response:
                sentiment_line = [line for line in response.split('\n') if 'SENTIMENT:' in line][0]
                sentiment_text = sentiment_line.split('SENTIMENT:')[1].strip().lower()
            
            if 'SCORE:' in response:
                score_line = [line for line in response.split('\n') if 'SCORE:' in line][0]
                try:
                    sentiment_score = int(score_line.split('SCORE:')[1].strip().split()[0])
                except:
                    sentiment_score = 5
            
            if 'RISK:' in response:
                risk_line = [line for line in response.split('\n') if 'RISK:' in line][0]
                risk_level = risk_line.split('RISK:')[1].strip().lower()
            
            if 'NOTES:' in response:
                notes = response.split('NOTES:')[1].strip()
            
            logger.info(f"✨ Sentiment analysis for {symbol}: {sentiment_text} (score: {sentiment_score})")
            
            return {
                'sentiment_score': sentiment_score,
                'sentiment_text': sentiment_text,
                'fundamental_notes': notes,
                'risk_level': risk_level,
                'full_analysis': response
            }
            
        except Exception as e:
            logger.error(f"Sentiment analysis failed for {symbol}: {e}")
            return {
                'sentiment_score': 5,
                'sentiment_text': 'neutral',
                'fundamental_notes': 'Analysis unavailable',
                'risk_level': 'medium'
            }
    
    def enrich_features(self, features: Dict, sentiment_data: Dict) -> Dict:
        """
        Enrich technical features with sentiment data.
        
        Args:
            features: Technical indicator features
            sentiment_data: Sentiment analysis results
        
        Returns:
            Enriched features dict
        """
        features['sentiment_score'] = sentiment_data.get('sentiment_score', 5)
        features['sentiment_text'] = sentiment_data.get('sentiment_text', 'neutral')
        features['risk_level'] = sentiment_data.get('risk_level', 'medium')
        features['fundamental_notes'] = sentiment_data.get('fundamental_notes', '')
        
        return features
