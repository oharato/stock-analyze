import yahooFinance from "yahoo-finance2";
import type { HistoricalOptions } from "yahoo-finance2/modules/historical";
import type { Quote } from "yahoo-finance2/modules/quote";

export class YahooFinanceClient {
  constructor() { }

  public async getHistoricalData(ticker: string, options: HistoricalOptions): Promise<any[]> {
    return yahooFinance.historical(ticker, options);
  }

  public async getQuote(ticker: string): Promise<Quote | undefined> {
    return yahooFinance.quote(ticker);
  }

  public async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
