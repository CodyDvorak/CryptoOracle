from emergentintegrations.llm.chat import LlmChat, UserMessage
import os
import logging
from typing import Dict, List
import json

logger = logging.getLogger(__name__)

class LLMSynthesisService:
    """Claude-powered synthesis and rationale generation."""
    
    def __init__(self):
        self.api_key = os.environ.get('EMERGENT_LLM_KEY', 'sk-emergent-4Ef1772348f2d90912')
        self.model = 'claude-sonnet-4-20250514'
        self.provider = 'anthropic'
    
    async def synthesize_recommendations(self, coin: str, bot_results: List[Dict], features: Dict) -> str:
        """Use Claude to synthesize bot recommendations and provide enhanced rationale.
        
        Args:
            coin: Coin symbol
            bot_results: List of bot analysis results
            features: Technical indicator features
        
        Returns:
            Enhanced rationale text
        """
        try:
            # Create a new chat session for each synthesis
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"synthesis-{coin}",
                system_message="You are a professional crypto analyst. Provide concise, data-driven analysis in 1-2 sentences."
            ).with_model(self.provider, self.model)
            
            # Prepare summary of bot analyses
            long_bots = [b for b in bot_results if b.get('direction') == 'long']
            short_bots = [b for b in bot_results if b.get('direction') == 'short']
            avg_confidence_long = sum(b.get('confidence', 5) for b in long_bots) / len(long_bots) if long_bots else 0
            avg_confidence_short = sum(b.get('confidence', 5) for b in short_bots) / len(short_bots) if short_bots else 0
            
            prompt = f"""Analyze {coin}:
- {len(long_bots)} bots recommend LONG (avg confidence: {avg_confidence_long:.1f}/10)
- {len(short_bots)} bots recommend SHORT (avg confidence: {avg_confidence_short:.1f}/10)
- Current price: ${features.get('current_price', 0):.2f}
- RSI: {features.get('rsi_14', 50):.1f}
- 24h change: {features.get('price_change_24h', 0):.1f}%

Provide a brief 1-2 sentence summary of the market consensus and key risk factor."""
            
            message = UserMessage(text=prompt)
            response = await chat.send_message(message)
            
            return response.strip() if response else "Market analysis completed."
            
        except Exception as e:
            logger.error(f"LLM synthesis error for {coin}: {e}")
            # Fallback to simple summary
            consensus = 'LONG' if len(long_bots) > len(short_bots) else 'SHORT'
            return f"Market consensus: {consensus} based on {len(bot_results)} bot analyses."
    
    async def calibrate_confidence(self, coin: str, raw_confidence: float, features: Dict) -> int:
        """Use Claude to calibrate confidence score based on market conditions.
        
        Args:
            coin: Coin symbol
            raw_confidence: Average confidence from bots
            features: Technical indicators
        
        Returns:
            Calibrated confidence score (1-10)
        """
        try:
            # Quick calibration based on volatility and trend clarity
            volatility = features.get('bb_width', 0.05)
            rsi = features.get('rsi_14', 50)
            
            # Reduce confidence in high volatility or extreme RSI
            if volatility > 0.08:
                raw_confidence *= 0.85
            if rsi < 25 or rsi > 75:
                raw_confidence *= 0.9  # Extreme RSI can reverse
            
            # Boost confidence in trending markets with clear signals
            if 30 < rsi < 70 and 0.03 < volatility < 0.06:
                raw_confidence *= 1.1
            
            return max(1, min(10, int(raw_confidence)))
            
        except Exception as e:
            logger.error(f"Confidence calibration error for {coin}: {e}")
            return int(raw_confidence)