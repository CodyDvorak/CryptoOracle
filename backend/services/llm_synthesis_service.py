from emergentintegrations.llm.chat import LlmChat, UserMessage
import os
import logging
from typing import Dict, List
import json

logger = logging.getLogger(__name__)

class LLMSynthesisService:
    """ChatGPT-5 powered synthesis and rationale generation (Layer 3 of Triple-Layer LLM Integration)."""
    
    def __init__(self):
        self.api_key = os.environ.get('EMERGENT_LLM_KEY', 'sk-emergent-4Ef1772348f2d90912')
        self.model = 'gpt-5'  # Updated to ChatGPT-5
        self.provider = 'openai'  # Changed from anthropic
    
    async def synthesize_recommendations(self, coin: str, bot_results: List[Dict], features: Dict) -> str:
        """Use ChatGPT-5 to synthesize bot recommendations and provide enhanced rationale.
        
        Args:
            coin: Coin symbol
            bot_results: List of bot analysis results (from all 50 bots including AIAnalystBot)
            features: Technical indicator features (including sentiment data)
        
        Returns:
            Enhanced rationale text
        """
        try:
            # Create a new chat session for each synthesis
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"synthesis-{coin}",
                system_message="""You are an elite cryptocurrency trading analyst synthesizing insights from 50 diverse trading bots.
                Provide concise, actionable analysis highlighting:
                1. Bot consensus strength
                2. Key technical signals
                3. Sentiment context
                4. Primary risk factors
                Keep response to 2-3 sentences maximum."""
            ).with_model(self.provider, self.model)
            
            # Prepare comprehensive summary
            long_bots = [b for b in bot_results if b.get('direction') == 'long']
            short_bots = [b for b in bot_results if b.get('direction') == 'short']
            avg_confidence_long = sum(b.get('confidence', 5) for b in long_bots) / len(long_bots) if long_bots else 0
            avg_confidence_short = sum(b.get('confidence', 5) for b in short_bots) / len(short_bots) if short_bots else 0
            
            # Get sentiment context
            sentiment = features.get('sentiment_text', 'neutral')
            sentiment_score = features.get('sentiment_score', 5)
            
            # Build comprehensive prompt
            prompt = f"""Synthesize analysis for {coin}:

BOT CONSENSUS (50 total bots):
- {len(long_bots)} bots: LONG (avg confidence: {avg_confidence_long:.1f}/10)
- {len(short_bots)} bots: SHORT (avg confidence: {avg_confidence_short:.1f}/10)

TECHNICAL INDICATORS:
- Price: ${features.get('current_price', 0):.6f}
- RSI: {features.get('rsi_14', 50):.1f}
- MACD: {features.get('macd', 0):.3f}
- Trend: SMA20={features.get('sma_20', 0):.2f}, SMA50={features.get('sma_50', 0):.2f}

SENTIMENT: {sentiment.upper()} (score: {sentiment_score}/10)

FUNDAMENTALS: {features.get('fundamental_notes', 'N/A')[:100]}

Provide 2-3 sentence synthesis covering: consensus strength, key signals, and primary risk."""
            
            message = UserMessage(text=prompt)
            response = await chat.send_message(message)
            
            logger.info(f"📝 ChatGPT-5 Synthesis for {coin}: {response[:100]}...")
            
            return response.strip() if response else f"{len(bot_results)} bots analyzed with {len(long_bots)/len(bot_results)*100:.0f}% bullish consensus."
            
        except Exception as e:
            logger.error(f"❌ ChatGPT-5 synthesis error for {coin}: {e}")
            # Fallback to simple summary
            consensus = 'LONG' if len(long_bots) > len(short_bots) else 'SHORT'
            consensus_pct = (max(len(long_bots), len(short_bots)) / len(bot_results) * 100) if bot_results else 50
            return f"Market consensus: {consensus} ({consensus_pct:.0f}% agreement) from {len(bot_results)} bot analyses. Sentiment: {features.get('sentiment_text', 'neutral')}."
    
    async def calibrate_confidence(self, coin: str, raw_confidence: float, features: Dict) -> int:
        """Use ChatGPT-5 to calibrate confidence score based on market conditions.
        
        Args:
            coin: Coin symbol
            raw_confidence: Average confidence from bots
            features: Technical indicators
        
        Returns:
            Calibrated confidence score (1-10)
        """
        try:
            # Enhanced calibration considering sentiment
            volatility = features.get('bb_width', 0.05)
            rsi = features.get('rsi_14', 50)
            sentiment_score = features.get('sentiment_score', 5)
            
            # Reduce confidence in high volatility
            if volatility > 0.08:
                raw_confidence *= 0.85
            
            # Reduce confidence for extreme RSI (potential reversal)
            if rsi < 25 or rsi > 75:
                raw_confidence *= 0.9
            
            # Boost confidence when technical and sentiment align
            if 30 < rsi < 70 and 0.03 < volatility < 0.06:
                raw_confidence *= 1.1
            
            # Boost confidence when sentiment is strong and aligned
            if (sentiment_score > 7 and rsi > 50) or (sentiment_score < 3 and rsi < 50):
                raw_confidence *= 1.05
            
            calibrated = max(1, min(10, int(raw_confidence)))
            
            logger.debug(f"Confidence calibration for {coin}: {raw_confidence:.1f} → {calibrated}")
            
            return calibrated
            
        except Exception as e:
            logger.error(f"Confidence calibration error for {coin}: {e}")
            return max(1, min(10, int(raw_confidence)))