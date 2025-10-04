import { OpenAI } from 'npm:openai@4.20.1';

interface AIAnalysis {
  refinedConfidence: number;
  reasoning: string;
  actionPlan: string;
  riskAssessment: string;
  marketContext: string;
}

class AIRefinementService {
  private openai: OpenAI;

  constructor() {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not set');
    }
    this.openai = new OpenAI({ apiKey });
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
      const longPredictions = data.botPredictions.filter(
        p => p.direction === 'LONG'
      );
      const shortPredictions = data.botPredictions.filter(
        p => p.direction === 'SHORT'
      );

      const prompt = this.buildPrompt(
        data,
        longPredictions,
        shortPredictions
      );

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an expert crypto trading analyst with deep knowledge of technical analysis, market psychology, and risk management. Your role is to analyze trading signals and provide actionable insights.

You must respond in valid JSON format with the following structure:
{
  "refinedConfidence": <number between 0 and 1>,
  "reasoning": "<detailed analysis of why this signal is strong or weak>",
  "actionPlan": "<specific steps a trader should take>",
  "riskAssessment": "<potential risks and how to mitigate them>",
  "marketContext": "<broader market context and relevant factors>"
}`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        return null;
      }

      const analysis = JSON.parse(response);

      return {
        refinedConfidence: Math.max(
          0,
          Math.min(1, analysis.refinedConfidence)
        ),
        reasoning: analysis.reasoning || 'No reasoning provided',
        actionPlan: analysis.actionPlan || 'No action plan provided',
        riskAssessment:
          analysis.riskAssessment || 'No risk assessment provided',
        marketContext:
          analysis.marketContext || 'No market context provided',
      };
    } catch (error) {
      console.error('AI refinement error:', error);
      return null;
    }
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
      `- ${longPredictions.length} bots voting LONG (${(
        (longPredictions.length / data.botPredictions.length) *
        100
      ).toFixed(0)}%)`,
      `- ${shortPredictions.length} bots voting SHORT (${(
        (shortPredictions.length / data.botPredictions.length) *
        100
      ).toFixed(0)}%)`,
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
        `- Whale Activity: ${data.onchain.whaleActivity.signal} (${data.onchain.whaleActivity.largeTransactions} large txs)`,
        `- Exchange Flows: ${data.onchain.exchangeFlows.signal} (net: ${data.onchain.exchangeFlows.netFlow.toFixed(0)})`,
        `- Network Activity: ${data.onchain.networkActivity.trend}`,
        ``
      );
    }

    lines.push(
      `Top 5 LONG Bots:`,
      ...longPredictions.slice(0, 5).map(
        p =>
          `- ${p.botName}: ${(p.confidence * 100).toFixed(0)}% confidence, Target: $${p.takeProfit}, Stop: $${p.stopLoss}`
      ),
      ``,
      `Top 5 SHORT Bots:`,
      ...shortPredictions.slice(0, 5).map(
        p =>
          `- ${p.botName}: ${(p.confidence * 100).toFixed(0)}% confidence, Target: $${p.takeProfit}, Stop: $${p.stopLoss}`
      ),
      ``,
      `Please analyze this signal and provide:`,
      `1. A refined confidence score (0-1) accounting for all factors`,
      `2. Detailed reasoning for your assessment`,
      `3. A specific action plan for traders`,
      `4. A thorough risk assessment`,
      `5. Relevant market context`,
      ``,
      `Consider:`,
      `- Are all indicators aligned or conflicting?`,
      `- Does the market regime support this trade?`,
      `- What are the key risks?`,
      `- What would invalidate this signal?`,
      `- Is there sufficient confluence across timeframes?`
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
    try {
      const prompt = `${data.coin} has conflicting signals: ${data.longVotes} LONG vs ${data.shortVotes} SHORT votes in a ${data.regime} market. Provide a brief (2-3 sentences) explanation of why this conflict exists and what it means for traders.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content:
              'You are a concise crypto trading analyst. Provide brief, actionable insights.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 150,
      });

      return (
        completion.choices[0]?.message?.content ||
        'Unable to analyze conflict'
      );
    } catch (error) {
      console.error('Conflict analysis error:', error);
      return 'Unable to analyze signal conflict';
    }
  }
}

export const aiRefinementService = new AIRefinementService();
