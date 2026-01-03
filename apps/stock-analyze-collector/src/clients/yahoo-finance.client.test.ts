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
        chart: mockedHistorical, // chart should use the same mock to respect test configurations
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
    const dummyQuotes = [{ date: new Date(), open: 100, close: 101 }];
    const dummyResult = { quotes: dummyQuotes };
    mockedHistorical.mockResolvedValue(dummyResult);

    const ticker = '1234.T';
    const options = { period1: '2023-01-01', period2: '2023-01-05', interval: '1d' as const };
    const result = await client.getHistoricalData(ticker, options);

    expect(mockedHistorical).toHaveBeenCalledTimes(1);
    expect(mockedHistorical).toHaveBeenCalledWith(ticker, options);
    // The client maps the result, so checking individual properties or equality is fine
    // But since dummyQuotes has matching structure (open, close etc), it should be equal
    // Note: client maps 'adjclose' -> 'adjClose'. dummyQuotes doesn't have it, so undefined.
    // The test dummy data might strictly need to match output but check 'toEqual' handles subset?
    // Actually the client MAPS it explicitly.
    // return result.quotes.map((q: any) => ({ date: q.date, ... adjClose: q.adjclose }))

    // Let's ensure expectation matches the manual mapping in client
    expect(result).toEqual([{
      date: dummyQuotes[0].date,
      open: dummyQuotes[0].open,
      high: undefined,
      low: undefined,
      close: dummyQuotes[0].close,
      adjClose: undefined,
      volume: undefined
    }]);
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
