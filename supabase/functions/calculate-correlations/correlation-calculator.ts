// Correlation Calculator - Pearson Correlation Coefficient

interface PriceDataPoint {
  timestamp: number;
  price: number;
  volume?: number;
  marketCap?: number;
}

interface CoinPriceHistory {
  symbol: string;
  prices: PriceDataPoint[];
}

interface CorrelationResult {
  baseAsset: string;
  correlatedAsset: string;
  coefficient: number;
  strength: 'STRONG' | 'MODERATE' | 'WEAK';
  direction: 'POSITIVE' | 'NEGATIVE';
  dataPoints: number;
}

export class CorrelationCalculator {
  /**
   * Calculate Pearson correlation coefficient between two price series
   * Formula: r = Σ((x - x̄)(y - ȳ)) / √(Σ(x - x̄)² * Σ(y - ȳ)²)
   */
  calculatePearsonCorrelation(pricesX: number[], pricesY: number[]): number {
    if (pricesX.length !== pricesY.length || pricesX.length === 0) {
      throw new Error('Price arrays must have the same non-zero length');
    }

    const n = pricesX.length;

    // Calculate means
    const meanX = pricesX.reduce((sum, val) => sum + val, 0) / n;
    const meanY = pricesY.reduce((sum, val) => sum + val, 0) / n;

    // Calculate deviations and products
    let numerator = 0;
    let sumSquaredDeviationsX = 0;
    let sumSquaredDeviationsY = 0;

    for (let i = 0; i < n; i++) {
      const deviationX = pricesX[i] - meanX;
      const deviationY = pricesY[i] - meanY;

      numerator += deviationX * deviationY;
      sumSquaredDeviationsX += deviationX * deviationX;
      sumSquaredDeviationsY += deviationY * deviationY;
    }

    // Calculate correlation coefficient
    const denominator = Math.sqrt(sumSquaredDeviationsX * sumSquaredDeviationsY);

    if (denominator === 0) {
      return 0; // No correlation if no variation
    }

    const correlation = numerator / denominator;

    // Clamp to [-1, 1] to handle floating point errors
    return Math.max(-1, Math.min(1, correlation));
  }

  /**
   * Align two price series by timestamp
   * Returns arrays with matching timestamps only
   */
  alignPriceSeries(
    series1: PriceDataPoint[],
    series2: PriceDataPoint[]
  ): { prices1: number[]; prices2: number[] } {
    // Create maps for quick lookup
    const map1 = new Map(series1.map(p => [this.normalizeTimestamp(p.timestamp), p.price]));
    const map2 = new Map(series2.map(p => [this.normalizeTimestamp(p.timestamp), p.price]));

    // Find common timestamps
    const commonTimestamps = [...map1.keys()].filter(ts => map2.has(ts)).sort();

    if (commonTimestamps.length === 0) {
      throw new Error('No overlapping timestamps found');
    }

    const prices1 = commonTimestamps.map(ts => map1.get(ts)!);
    const prices2 = commonTimestamps.map(ts => map2.get(ts)!);

    return { prices1, prices2 };
  }

  /**
   * Normalize timestamp to daily granularity (remove time component)
   */
  private normalizeTimestamp(timestamp: number): number {
    const date = new Date(timestamp);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }

  /**
   * Classify correlation strength
   */
  classifyStrength(coefficient: number): 'STRONG' | 'MODERATE' | 'WEAK' {
    const abs = Math.abs(coefficient);

    if (abs >= 0.7) {
      return 'STRONG';
    } else if (abs >= 0.4) {
      return 'MODERATE';
    } else {
      return 'WEAK';
    }
  }

  /**
   * Determine correlation direction
   */
  classifyDirection(coefficient: number): 'POSITIVE' | 'NEGATIVE' {
    return coefficient >= 0 ? 'POSITIVE' : 'NEGATIVE';
  }

  /**
   * Calculate correlations for all pairs in a dataset
   */
  calculateCorrelationMatrix(
    priceHistories: CoinPriceHistory[],
    minDataPoints: number = 20
  ): CorrelationResult[] {
    const results: CorrelationResult[] = [];

    // Calculate correlations for all unique pairs
    for (let i = 0; i < priceHistories.length; i++) {
      for (let j = i + 1; j < priceHistories.length; j++) {
        const coin1 = priceHistories[i];
        const coin2 = priceHistories[j];

        try {
          // Align price series
          const { prices1, prices2 } = this.alignPriceSeries(
            coin1.prices,
            coin2.prices
          );

          // Skip if insufficient data
          if (prices1.length < minDataPoints) {
            console.warn(
              `Insufficient data for ${coin1.symbol}-${coin2.symbol}: ${prices1.length} points`
            );
            continue;
          }

          // Calculate correlation
          const coefficient = this.calculatePearsonCorrelation(prices1, prices2);
          const strength = this.classifyStrength(coefficient);
          const direction = this.classifyDirection(coefficient);

          results.push({
            baseAsset: coin1.symbol,
            correlatedAsset: coin2.symbol,
            coefficient: Number(coefficient.toFixed(4)),
            strength,
            direction,
            dataPoints: prices1.length
          });

          console.log(
            `${coin1.symbol}-${coin2.symbol}: ${coefficient.toFixed(3)} (${strength}, ${prices1.length} points)`
          );
        } catch (error) {
          console.error(`Error calculating ${coin1.symbol}-${coin2.symbol}:`, error.message);
        }
      }
    }

    return results;
  }

  /**
   * Calculate volume correlation (if available)
   */
  calculateVolumeCorrelation(
    series1: PriceDataPoint[],
    series2: PriceDataPoint[]
  ): number | null {
    try {
      const volumes1 = series1
        .filter(p => p.volume && p.volume > 0)
        .map(p => p.volume!);

      const volumes2 = series2
        .filter(p => p.volume && p.volume > 0)
        .map(p => p.volume!);

      if (volumes1.length < 10 || volumes2.length < 10) {
        return null; // Insufficient volume data
      }

      // Align by taking minimum length
      const minLength = Math.min(volumes1.length, volumes2.length);
      const alignedVolumes1 = volumes1.slice(0, minLength);
      const alignedVolumes2 = volumes2.slice(0, minLength);

      return this.calculatePearsonCorrelation(alignedVolumes1, alignedVolumes2);
    } catch (error) {
      console.error('Volume correlation error:', error.message);
      return null;
    }
  }

  /**
   * Calculate rolling correlation over a window
   */
  calculateRollingCorrelation(
    prices1: number[],
    prices2: number[],
    windowSize: number = 30
  ): number[] {
    if (prices1.length !== prices2.length) {
      throw new Error('Price arrays must have the same length');
    }

    const rollingCorrelations: number[] = [];

    for (let i = windowSize; i <= prices1.length; i++) {
      const window1 = prices1.slice(i - windowSize, i);
      const window2 = prices2.slice(i - windowSize, i);

      const correlation = this.calculatePearsonCorrelation(window1, window2);
      rollingCorrelations.push(correlation);
    }

    return rollingCorrelations;
  }

  /**
   * Find most correlated pairs
   */
  findTopCorrelations(
    correlations: CorrelationResult[],
    limit: number = 10,
    minStrength: 'STRONG' | 'MODERATE' | 'WEAK' = 'MODERATE'
  ): CorrelationResult[] {
    const strengthOrder = { STRONG: 3, MODERATE: 2, WEAK: 1 };

    return correlations
      .filter(c => strengthOrder[c.strength] >= strengthOrder[minStrength])
      .sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient))
      .slice(0, limit);
  }

  /**
   * Calculate market-wide correlation metrics
   */
  calculateMarketMetrics(correlations: CorrelationResult[]): {
    averageCorrelation: number;
    strongCorrelations: number;
    positiveCorrelations: number;
    negativeCorrelations: number;
  } {
    if (correlations.length === 0) {
      return {
        averageCorrelation: 0,
        strongCorrelations: 0,
        positiveCorrelations: 0,
        negativeCorrelations: 0
      };
    }

    const averageCorrelation =
      correlations.reduce((sum, c) => sum + c.coefficient, 0) / correlations.length;

    const strongCorrelations = correlations.filter(c => c.strength === 'STRONG').length;
    const positiveCorrelations = correlations.filter(c => c.direction === 'POSITIVE').length;
    const negativeCorrelations = correlations.filter(c => c.direction === 'NEGATIVE').length;

    return {
      averageCorrelation: Number(averageCorrelation.toFixed(4)),
      strongCorrelations,
      positiveCorrelations,
      negativeCorrelations
    };
  }
}
