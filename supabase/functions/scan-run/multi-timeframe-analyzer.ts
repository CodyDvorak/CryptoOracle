import { marketRegimeClassifier } from './market-regime-classifier.ts';

interface TimeframeAnalysis {
  timeframe: string;
  regime: 'BULL' | 'BEAR' | 'SIDEWAYS';
  confidence: number;
  reasons: string[];
}

interface MultiTimeframeResult {
  primary: TimeframeAnalysis;
  secondary: TimeframeAnalysis;
  daily: TimeframeAnalysis;
  weekly: TimeframeAnalysis;
  alignment: {
    isAligned: boolean;
    alignmentScore: number;
    dominantRegime: 'BULL' | 'BEAR' | 'SIDEWAYS';
    conflictLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    description: string;
  };
  confidenceBoost: number;
}

export class MultiTimeframeAnalyzer {
  async analyze(symbol: string, cryptoDataService: any): Promise<MultiTimeframeResult | null> {
    try {
      const timeframes = ['1h', '4h', '1d', '1w'];
      const analyses: TimeframeAnalysis[] = [];

      for (const tf of timeframes) {
        const ohlcv = await cryptoDataService.getOHLCVData(symbol, tf);
        if (!ohlcv) continue;

        const regime = marketRegimeClassifier.classifyMarketRegime(ohlcv);
        analyses.push({
          timeframe: tf,
          regime: regime.regime,
          confidence: regime.confidence,
          reasons: regime.reasons.slice(0, 3),
        });
      }

      if (analyses.length < 3) {
        return null;
      }

      const alignment = this.calculateAlignment(analyses);

      return {
        primary: analyses[0] || analyses[1],
        secondary: analyses[1] || analyses[0],
        daily: analyses[2] || analyses[1],
        weekly: analyses[3] || analyses[2],
        alignment,
        confidenceBoost: this.calculateConfidenceBoost(alignment),
      };
    } catch (error) {
      console.error('Multi-timeframe analysis error:', error);
      return null;
    }
  }

  private calculateAlignment(analyses: TimeframeAnalysis[]) {
    const regimeCounts = {
      BULL: 0,
      BEAR: 0,
      SIDEWAYS: 0,
    };

    analyses.forEach(a => regimeCounts[a.regime]++);

    const total = analyses.length;
    const maxCount = Math.max(...Object.values(regimeCounts));
    const dominantRegime = Object.entries(regimeCounts).find(
      ([_, count]) => count === maxCount
    )?.[0] as 'BULL' | 'BEAR' | 'SIDEWAYS';

    const alignmentScore = (maxCount / total) * 100;

    let isAligned = false;
    let conflictLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'HIGH';
    let description = '';

    if (alignmentScore === 100) {
      isAligned = true;
      conflictLevel = 'LOW';
      description = `Perfect alignment: All timeframes show ${dominantRegime} regime`;
    } else if (alignmentScore >= 75) {
      isAligned = true;
      conflictLevel = 'LOW';
      description = `Strong alignment: ${alignmentScore.toFixed(0)}% of timeframes agree on ${dominantRegime}`;
    } else if (alignmentScore >= 50) {
      isAligned = false;
      conflictLevel = 'MEDIUM';
      description = `Moderate conflict: ${alignmentScore.toFixed(0)}% lean ${dominantRegime}, but not all timeframes agree`;
    } else {
      isAligned = false;
      conflictLevel = 'HIGH';
      description = `High conflict: Timeframes disagree (${alignmentScore.toFixed(0)}% ${dominantRegime})`;
    }

    const higherTimeframeCheck = this.checkHigherTimeframeDominance(analyses);
    if (higherTimeframeCheck) {
      description += `. ${higherTimeframeCheck}`;
    }

    return {
      isAligned,
      alignmentScore,
      dominantRegime,
      conflictLevel,
      description,
    };
  }

  private checkHigherTimeframeDominance(analyses: TimeframeAnalysis[]): string | null {
    if (analyses.length < 3) return null;

    const daily = analyses.find(a => a.timeframe === '1d');
    const weekly = analyses.find(a => a.timeframe === '1w');

    if (daily && weekly && daily.regime === weekly.regime) {
      return `Higher timeframes (1D + 1W) both ${daily.regime} - strong trend`;
    }

    if (weekly && weekly.confidence > 0.8) {
      return `Weekly timeframe strongly ${weekly.regime} (${(weekly.confidence * 100).toFixed(0)}%)`;
    }

    return null;
  }

  private calculateConfidenceBoost(alignment: any): number {
    if (alignment.alignmentScore === 100) {
      return 1.3;
    } else if (alignment.alignmentScore >= 75) {
      return 1.2;
    } else if (alignment.alignmentScore >= 50) {
      return 1.0;
    } else {
      return 0.8;
    }
  }

  formatForDisplay(result: MultiTimeframeResult): string {
    const lines = [
      `Multi-Timeframe Analysis:`,
      `1H: ${result.primary?.regime || 'N/A'}`,
      `4H: ${result.secondary?.regime || 'N/A'}`,
      `1D: ${result.daily?.regime || 'N/A'}`,
      `1W: ${result.weekly?.regime || 'N/A'}`,
      ``,
      `${result.alignment.description}`,
      `Confidence boost: ${((result.confidenceBoost - 1) * 100).toFixed(0)}%`,
    ];
    return lines.join('\n');
  }
}

export const multiTimeframeAnalyzer = new MultiTimeframeAnalyzer();
