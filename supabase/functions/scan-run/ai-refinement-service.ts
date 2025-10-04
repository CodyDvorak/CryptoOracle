interface AIAnalysis {
  refinedConfidence: number;
  reasoning: string;
  actionPlan: string;
  riskAssessment: string;
  marketContext: string;
}

class AIRefinementService {
  private groqApiKey: string;
  private geminiApiKey: string;
  private groqApiUrl = 'https://api.groq.com/openai/v1/chat/completions';
  private geminiApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  constructor() {
    this.groqApiKey = Deno.env.get('GROQ_API_KEY') || '';
    this.geminiApiKey = Deno.env.get('GEMINI_API_KEY') || '';

    if (!this.groqApiKey && !this.geminiApiKey) {
      console.warn('No AI API keys set. Using rule-based fallback.');
    } else if (this.groqApiKey) {
      console.log('Using Groq for AI analysis');
    } else if (this.geminiApiKey) {
      console.log('Using Google Gemini for AI analysis');
    }
  }

  async analyzeSignal(data: {
    coin: string;
    ticker: string;
    currentPrice: number;
    botPredictions: any[];
    regime: string;
    regimeConfidence: number;
    consensus: string;
    botConfidence: number;
    sentiment?: any;
    onchain?: any;
    timeframe?: any;
  }): Promise<AIAnalysis | null> {
    try {
      const longPredictions = data.botPredictions.filter(p => p.direction === 'LONG');
      const shortPredictions = data.botPredictions.filter(p => p.direction === 'SHORT');

      if (!this.groqApiKey && !this.geminiApiKey) {
        return this.ruleBasedAnalysis(data, longPredictions, shortPredictions);
      }

      const prompt = this.buildPrompt(data, longPredictions, shortPredictions);

      if (this.groqApiKey) {
        try {
          return await this.analyzeWithGroq(prompt, data, longPredictions, shortPredictions);
        } catch (error) {
          console.error('Groq failed, trying Gemini:', error);
          if (this.geminiApiKey) {
            return await this.analyzeWithGemini(prompt, data, longPredictions, shortPredictions);
          }
        }
      } else if (this.geminiApiKey) {
        try {
          return await this.analyzeWithGemini(prompt, data, longPredictions, shortPredictions);
        } catch (error) {
          console.error('Gemini failed:', error);
        }
      }

      return this.ruleBasedAnalysis(data, longPredictions, shortPredictions);
    } catch (error) {
      console.error('AI refinement error:', error);
      return this.ruleBasedAnalysis(data, longPredictions, shortPredictions);
    }
  }

  private async analyzeWithGroq(prompt: string, data: any, longPredictions: any[], shortPredictions: any[]): Promise<AIAnalysis | null> {
    const response = await fetch(this.groqApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are an expert crypto trading analyst. Respond in valid JSON format:
{
  "refinedConfidence": <number 0-1>,
  "reasoning": "<detailed analysis>",
  "actionPlan": "<specific steps>",
  "riskAssessment": "<risks and mitigation>",
  "marketContext": "<broader context>"
}`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content from Groq');
    }

    const analysis = JSON.parse(content);
    return {
      refinedConfidence: Math.max(0, Math.min(1, analysis.refinedConfidence)),
      reasoning: analysis.reasoning || 'No reasoning provided',
      actionPlan: analysis.actionPlan || 'No action plan provided',
      riskAssessment: analysis.riskAssessment || 'No risk assessment provided',
      marketContext: analysis.marketContext || 'No market context provided',
    };
  }

  private async analyzeWithGemini(prompt: string, data: any, longPredictions: any[], shortPredictions: any[]): Promise<AIAnalysis | null> {
    const systemPrompt = `You are an expert crypto trading analyst. Respond in valid JSON format:
{
  "refinedConfidence": <number 0-1>,
  "reasoning": "<detailed analysis>",
  "actionPlan": "<specific steps>",
  "riskAssessment": "<risks and mitigation>",
  "marketContext": "<broader context>"
}`;

    const response = await fetch(`${this.geminiApiUrl}?key=${this.geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${systemPrompt}\n\n${prompt}`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error('No content from Gemini');
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Gemini response');
    }

    const analysis = JSON.parse(jsonMatch[0]);
    return {
      refinedConfidence: Math.max(0, Math.min(1, analysis.refinedConfidence)),
      reasoning: analysis.reasoning || 'No reasoning provided',
      actionPlan: analysis.actionPlan || 'No action plan provided',
      riskAssessment: analysis.riskAssessment || 'No risk assessment provided',
      marketContext: analysis.marketContext || 'No market context provided',
    };
  }

  private ruleBasedAnalysis(
    data: any,
    longPredictions: any[],
    shortPredictions: any[]
  ): AIAnalysis {
    const totalVotes = data.botPredictions.length;
    const longVotes = longPredictions.length;
    const shortVotes = shortPredictions.length;
    const voteRatio = Math.max(longVotes, shortVotes) / totalVotes;

    let baseConfidence = data.botConfidence;

    const reasons = [];
    const risks = [];
    const actions = [];

    if (voteRatio > 0.8) {
      baseConfidence *= 1.15;
      reasons.push(`Strong consensus (${(voteRatio * 100).toFixed(0)}% agreement)`);
    } else if (voteRatio < 0.6) {
      baseConfidence *= 0.9;
      reasons.push(`Weak consensus (${(voteRatio * 100).toFixed(0)}% agreement)`);
      risks.push('High uncertainty due to conflicting bot signals');
    }

    if (data.regimeConfidence > 0.8) {
      baseConfidence *= 1.1;
      reasons.push(`Strong ${data.regime} regime (${(data.regimeConfidence * 100).toFixed(0)}% confidence)`);
    }

    if (data.timeframe?.alignment?.isAligned) {
      baseConfidence *= 1.15;
      reasons.push(`Multi-timeframe alignment confirmed`);
      actions.push('Higher confidence due to timeframe confluence');
    } else if (data.timeframe?.alignment?.conflictLevel === 'HIGH') {
      baseConfidence *= 0.85;
      reasons.push(`Timeframe conflict detected`);
      risks.push('Different timeframes show conflicting regimes');
    }

    if (data.sentiment) {
      if (data.sentiment.sentiment === 'VERY_BULLISH' && data.consensus === 'LONG') {
        baseConfidence *= 1.08;
        reasons.push(`Bullish social sentiment confirms signal`);
      } else if (data.sentiment.sentiment === 'VERY_BEARISH' && data.consensus === 'SHORT') {
        baseConfidence *= 1.08;
        reasons.push(`Bearish social sentiment confirms signal`);
      } else if (
        (data.sentiment.sentiment === 'VERY_BULLISH' && data.consensus === 'SHORT') ||
        (data.sentiment.sentiment === 'VERY_BEARISH' && data.consensus === 'LONG')
      ) {
        baseConfidence *= 0.9;
        reasons.push(`Social sentiment conflicts with signal`);
        risks.push('Market sentiment opposes bot consensus');
      }
    }

    if (data.onchain) {
      if (data.onchain.overallSignal === 'BULLISH' && data.consensus === 'LONG') {
        baseConfidence *= 1.05;
        reasons.push(`On-chain data supports bullish outlook`);
      } else if (data.onchain.overallSignal === 'BEARISH' && data.consensus === 'SHORT') {
        baseConfidence *= 1.05;
        reasons.push(`On-chain data supports bearish outlook`);
      }
    }

    baseConfidence = Math.max(0.1, Math.min(0.95, baseConfidence));

    if (baseConfidence > 0.75) {
      actions.push(`Strong signal - consider ${data.consensus} position`);
      actions.push(`Entry: $${data.currentPrice.toFixed(8)}`);
      actions.push(`Position size: 3-5% of portfolio`);
    } else if (baseConfidence > 0.6) {
      actions.push(`Moderate signal - use smaller position size`);
      actions.push(`Position size: 1-2% of portfolio`);
    } else {
      actions.push(`Weak signal - wait for better setup`);
      actions.push(`Consider sitting out this trade`);
    }

    risks.push(`Stop loss required at ${data.consensus === 'LONG' ? 'support' : 'resistance'} levels`);
    risks.push(`Monitor regime changes that could invalidate signal`);

    const marketContext = `${data.coin} in ${data.regime} regime. ` +
      `${longVotes} bots bullish, ${shortVotes} bearish. ` +
      `${data.timeframe ? `Timeframe alignment: ${data.timeframe.alignment?.description}. ` : ''}` +
      `Current market conditions ${baseConfidence > 0.7 ? 'favorable' : 'mixed'} for this trade.`;

    return {
      refinedConfidence: baseConfidence,
      reasoning: reasons.join('. '),
      actionPlan: actions.join('\n'),
      riskAssessment: risks.join('. '),
      marketContext,
    };
  }

  private buildPrompt(
    data: any,
    longPredictions: any[],
    shortPredictions: any[]
  ): string {
    const lines = [
      `Analyze this trading signal for ${data.coin} (${data.ticker}):`,
      ``,
      `Current Price: $${data.currentPrice}`,
      `Market Regime: ${data.regime} (${(data.regimeConfidence * 100).toFixed(0)}% confidence)`,
      ``,
      `Bot Voting:`,
      `- ${longPredictions.length} bots voting LONG (${((longPredictions.length / data.botPredictions.length) * 100).toFixed(0)}%)`,
      `- ${shortPredictions.length} bots voting SHORT (${((shortPredictions.length / data.botPredictions.length) * 100).toFixed(0)}%)`,
      `- Consensus: ${data.consensus}`,
      `- Average Bot Confidence: ${(data.botConfidence * 100).toFixed(1)}%`,
      ``,
    ];

    if (data.timeframe) {
      lines.push(
        `Multi-Timeframe Analysis:`,
        `- 1H: ${data.timeframe.primary?.regime || 'N/A'}`,
        `- 4H: ${data.timeframe.secondary?.regime || 'N/A'}`,
        `- 1D: ${data.timeframe.daily?.regime || 'N/A'}`,
        `- 1W: ${data.timeframe.weekly?.regime || 'N/A'}`,
        `- Alignment: ${data.timeframe.alignment?.description || 'N/A'}`,
        ``
      );
    }

    if (data.sentiment) {
      lines.push(
        `Social Sentiment:`,
        `- Aggregated Score: ${data.sentiment.aggregatedScore.toFixed(2)} (${data.sentiment.sentiment})`,
        `- Volume: ${data.sentiment.aggregatedVolume} mentions`,
        `- Confidence: ${(data.sentiment.confidence * 100).toFixed(0)}%`,
        ``
      );
    }

    if (data.onchain) {
      lines.push(
        `On-Chain Data:`,
        `- Overall Signal: ${data.onchain.overallSignal}`,
        `- Whale Activity: ${data.onchain.whaleActivity.signal}`,
        `- Exchange Flows: ${data.onchain.exchangeFlows.signal}`,
        `- Network Activity: ${data.onchain.networkActivity.trend}`,
        ``
      );
    }

    lines.push(
      `Top 5 LONG Bots:`,
      ...longPredictions.slice(0, 5).map(
        p => `- ${p.botName}: ${(p.confidence * 100).toFixed(0)}% confidence`
      ),
      ``,
      `Top 5 SHORT Bots:`,
      ...shortPredictions.slice(0, 5).map(
        p => `- ${p.botName}: ${(p.confidence * 100).toFixed(0)}% confidence`
      ),
      ``,
      `Provide refined confidence (0-1), reasoning, action plan, risk assessment, and market context.`
    );

    return lines.join('\n');
  }

  async analyzeConflict(data: {
    coin: string;
    longVotes: number;
    shortVotes: number;
    botPredictions: any[];
    regime: string;
  }): Promise<string> {
    const fallbackResponse = () => {
      const diff = Math.abs(data.longVotes - data.shortVotes);
      if (diff < 5) {
        return `${data.coin} shows extreme uncertainty with nearly equal LONG/SHORT votes (${data.longVotes}/${data.shortVotes}). This suggests the market is at a critical decision point in the ${data.regime} regime. Consider waiting for clearer direction.`;
      }
      return `${data.coin} has mixed signals with ${data.longVotes} LONG vs ${data.shortVotes} SHORT votes. The conflict likely stems from different bot strategies reacting to various timeframes or indicators. Trade with caution or reduce position size.`;
    };

    if (!this.groqApiKey && !this.geminiApiKey) {
      return fallbackResponse();
    }

    const prompt = `${data.coin} has conflicting signals: ${data.longVotes} LONG vs ${data.shortVotes} SHORT votes in a ${data.regime} market. Provide a brief (2-3 sentences) explanation of why this conflict exists and what it means for traders.`;

    if (this.groqApiKey) {
      try {
        const response = await fetch(this.groqApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.groqApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
              {
                role: 'system',
                content: 'You are a concise crypto trading analyst. Provide brief, actionable insights.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 150,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          return result.choices?.[0]?.message?.content || fallbackResponse();
        }
      } catch (error) {
        console.error('Groq conflict analysis failed:', error);
      }
    }

    if (this.geminiApiKey) {
      try {
        const response = await fetch(`${this.geminiApiUrl}?key=${this.geminiApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are a concise crypto trading analyst. ${prompt}`
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 150,
            },
          }),
        });

        if (response.ok) {
          const result = await response.json();
          const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
          return content || fallbackResponse();
        }
      } catch (error) {
        console.error('Gemini conflict analysis failed:', error);
      }
    }

    return fallbackResponse();
  }
}

export const aiRefinementService = new AIRefinementService();
