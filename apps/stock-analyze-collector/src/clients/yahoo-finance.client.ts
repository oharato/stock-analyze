import YahooFinance from "yahoo-finance2";
import type { HistoricalOptions } from "yahoo-finance2/modules/historical";
import type { Quote } from "yahoo-finance2/modules/quote";
import { RateLimiter, RateLimiterConfig } from '../utils/rate-limiter.js';
import { LoggerService } from '../services/logger.service.js';

export class YahooFinanceClient {
  private client: InstanceType<typeof YahooFinance>;
  private rateLimiter: RateLimiter;

  constructor(
    config: RateLimiterConfig = { minIntervalMs: 2000 }, // Default 2s
    logger: LoggerService | null = null
  ) {
    this.client = new YahooFinance();
    this.rateLimiter = new RateLimiter(config, logger);
  }

  public async getHistoricalData(ticker: string, options: HistoricalOptions): Promise<any[]> {
    await this.rateLimiter.waitIfNeeded();
    return this.client.historical(ticker, options);
  }

  public async getQuote(ticker: string): Promise<Quote | undefined> {
    await this.rateLimiter.waitIfNeeded();
    return this.client.quote(ticker);
  }
}
