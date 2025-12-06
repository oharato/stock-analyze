import { YahooFinanceClient } from './yahoo-finance.client';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockedHistorical, mockedQuote } = vi.hoisted(() => {
  return {
    mockedHistorical: vi.fn(),
    mockedQuote: vi.fn(),
  };
});

vi.mock('yahoo-finance2', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      return {
        historical: mockedHistorical,
        quote: mockedQuote,
      };
    }),
  };
});

describe('YahooFinanceClient', () => {
  let client: YahooFinanceClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new YahooFinanceClient();
  });

  it('should fetch historical data correctly', async () => {
    const dummyHistoricalData = [{ date: new Date(), open: 100, close: 101 }];
    mockedHistorical.mockResolvedValue(dummyHistoricalData);

    const ticker = '1234.T';
    const options = { period1: '2023-01-01', period2: '2023-01-05', interval: '1d' as const };
    const result = await client.getHistoricalData(ticker, options);

    expect(mockedHistorical).toHaveBeenCalledTimes(1);
    expect(mockedHistorical).toHaveBeenCalledWith(ticker, options);
    expect(result).toEqual(dummyHistoricalData);
  });

  it('should fetch quote data correctly', async () => {
    const dummyQuoteData = { symbol: '1234.T', regularMarketPrice: 1000 };
    mockedQuote.mockResolvedValue(dummyQuoteData);

    const ticker = '1234.T';
    const result = await client.getQuote(ticker);

    expect(mockedQuote).toHaveBeenCalledTimes(1);
    expect(mockedQuote).toHaveBeenCalledWith(ticker);
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
    mockedHistorical.mockRejectedValue(new Error(errorMessage));

    const ticker = '1234.T';
    const options = { period1: '2023-01-01', period2: '2023-01-05', interval: '1d' as const };

    await expect(client.getHistoricalData(ticker, options)).rejects.toThrow(errorMessage);
  });

  it('should handle errors during quote data fetch', async () => {
    const errorMessage = 'Failed to fetch quote data';
    mockedQuote.mockRejectedValue(new Error(errorMessage));

    const ticker = '1234.T';

    await expect(client.getQuote(ticker)).rejects.toThrow(errorMessage);
  });
});
