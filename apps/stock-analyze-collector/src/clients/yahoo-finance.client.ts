import YahooFinance from "yahoo-finance2";
import type { HistoricalOptions } from "yahoo-finance2/modules/historical";
import type { Quote } from "yahoo-finance2/modules/quote";
import { RateLimiter, RateLimiterConfig } from '../utils/rate-limiter.js';
import { LoggerService } from '../services/logger.service.js';

import { sleep } from '../services/wait.service.js';

export class YahooFinanceClient {
  private client: InstanceType<typeof YahooFinance>;
  private rateLimiter: RateLimiter;

  constructor(
    config: RateLimiterConfig = { minIntervalMs: 2000 },
    private logger: LoggerService | null = null
  ) {
    this.client = new YahooFinance();
    this.rateLimiter = new RateLimiter(config, logger);
  }

  public async getHistoricalData(ticker: string, options: HistoricalOptions): Promise<any[]> {
    return this.withRetry(() => this.client.historical(ticker, options));
  }

  public async getQuote(ticker: string): Promise<Quote | undefined> {
    return this.withRetry(() => this.client.quote(ticker));
  }

  private async withRetry<T>(fn: () => Promise<T>, retries = 3, initialDelayMs = 5000): Promise<T> {
    let attempt = 0;
    while (attempt <= retries) {
      try {
        await this.rateLimiter.waitIfNeeded();
        return await fn();
      } catch (error: any) {
        attempt++;
        console.log(error);
        const isRateLimit = error.message?.includes('Too Many Requests') || error.message?.includes('429');

        if (isRateLimit && attempt <= retries) {
          const delay = initialDelayMs * Math.pow(2, attempt - 1);
          if (this.logger) {
            this.logger.warn(`Rate limit hit for request. Retrying in ${delay}ms... (Attempt ${attempt}/${retries})`);
          }
          await sleep(delay);
          // Reset rate limiter timer to avoid immediate subsequent calls triggering another limit
          this.rateLimiter.setLastRequestTime(Date.now());
          continue;
        }
        throw error;
      }
    }
    throw new Error('Max retries exceeded');
  }
}

