import YahooFinance from "yahoo-finance2";
import type { HistoricalOptions } from "yahoo-finance2/modules/historical";
import type { Quote } from "yahoo-finance2/modules/quote";

export class YahooFinanceClient {
  private client: InstanceType<typeof YahooFinance>;

  constructor() {
    this.client = new YahooFinance();
  }

  public async getHistoricalData(ticker: string, options: HistoricalOptions): Promise<any[]> {
    return this.client.historical(ticker, options);
  }

  public async getQuote(ticker: string): Promise<Quote | undefined> {
    return this.client.quote(ticker);
  }

  public async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
