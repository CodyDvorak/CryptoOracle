export class TokenBucket {
  private rate: number;
  private capacity: number;
  private tokens: number;
  private lastRefill: number;

  constructor(ratePerSecond: number, burstCapacity: number) {
    this.rate = ratePerSecond;
    this.capacity = burstCapacity;
    this.tokens = burstCapacity;
    this.lastRefill = Date.now();
  }

  allow(tokens: number = 1): boolean {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  private refill(): void {
    const now = Date.now();
    const delta = (now - this.lastRefill) / 1000;
    this.lastRefill = now;

    this.tokens = Math.min(
      this.capacity,
      this.tokens + (delta * this.rate)
    );
  }

  async waitForToken(tokens: number = 1, maxWaitMs: number = 5000): Promise<boolean> {
    const startTime = Date.now();

    while (!this.allow(tokens)) {
      if (Date.now() - startTime > maxWaitMs) {
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return true;
  }
}

export function createRateLimiter(
  ratePerSecond: number,
  burstCapacity: number
): (fn: () => Promise<any>, cost?: number) => Promise<any> {
  const bucket = new TokenBucket(ratePerSecond, burstCapacity);

  return async (fn: () => Promise<any>, cost: number = 1): Promise<any> => {
    const allowed = await bucket.waitForToken(cost);
    if (!allowed) {
      throw new Error('Rate limit exceeded');
    }
    return fn();
  };
}
