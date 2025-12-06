import { YahooFinanceClient } from './yahoo-finance.client';
import yahooFinance from 'yahoo-finance2';
import { vi, type Mock, describe, it, expect, beforeEach } from 'vitest';

vi.mock('yahoo-finance2', () => ({
  default: {
    historical: vi.fn(),
    quote: vi.fn(),
  },
}));

describe('YahooFinanceClient', () => {
  let client: YahooFinanceClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new YahooFinanceClient();
  });

  it('should fetch historical data correctly', async () => {
    const dummyHistoricalData = [{ date: new Date(), open: 100, close: 101 }];
    (yahooFinance.historical as Mock).mockResolvedValue(dummyHistoricalData);

    const ticker = '1234.T';
    const options = { period1: '2023-01-01', period2: '2023-01-05', interval: '1d' };
    const result = await client.getHistoricalData(ticker, options);

    expect(yahooFinance.historical).toHaveBeenCalledTimes(1);
    expect(yahooFinance.historical).toHaveBeenCalledWith(ticker, options);
    expect(result).toEqual(dummyHistoricalData);
  });

  it('should fetch quote data correctly', async () => {
    const dummyQuoteData = { symbol: '1234.T', regularMarketPrice: 1000 };
    (yahooFinance.quote as Mock).mockResolvedValue(dummyQuoteData);

    const ticker = '1234.T';
    const result = await client.getQuote(ticker);

    expect(yahooFinance.quote).toHaveBeenCalledTimes(1);
    expect(yahooFinance.quote).toHaveBeenCalledWith(ticker);
    expect(result).toEqual(dummyQuoteData);
  });

  it('should sleep for the specified duration', async () => {
    const sleepTime = 100; // ms
    const start = Date.now();
    await client.sleep(sleepTime);
    const end = Date.now();

    expect(end - start).toBeGreaterThanOrEqual(sleepTime);
    expect(end - start).toBeLessThan(sleepTime + 50); // 許容範囲
  });

  it('should handle errors during historical data fetch', async () => {
    const errorMessage = 'Failed to fetch historical data';
    (yahooFinance.historical as Mock).mockRejectedValue(new Error(errorMessage));

    const ticker = '1234.T';
    const options = { period1: '2023-01-01', period2: '2023-01-05', interval: '1d' };

    await expect(client.getHistoricalData(ticker, options)).rejects.toThrow(errorMessage);
  });

  it('should handle errors during quote data fetch', async () => {
    const errorMessage = 'Failed to fetch quote data';
    (yahooFinance.quote as Mock).mockRejectedValue(new Error(errorMessage));

    const ticker = '1234.T';

    await expect(client.getQuote(ticker)).rejects.toThrow(errorMessage);
  });
});
