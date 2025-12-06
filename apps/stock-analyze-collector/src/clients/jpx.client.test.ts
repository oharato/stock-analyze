import { downloadStockList } from './jpx.client';
import { LoggerService } from '../services/logger.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// fetchをモック化
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('downloadStockList', () => {
  let mockLogger: LoggerService;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    } as any;

    // 各テストの前にモックをリセット
    mockFetch.mockReset();
  });

  it('should download the stock list Excel file as a Buffer', async () => {
    const dummyExcelBuffer = Buffer.from('dummy excel data');
    const mockResponse = {
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array(dummyExcelBuffer).buffer),
    };
    mockFetch.mockResolvedValueOnce(mockResponse);

    const result = await downloadStockList(mockLogger);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xls'
    );
    expect(result.equals(dummyExcelBuffer)).toBe(true);
  });

  it('should throw an error if the download fails', async () => {
    const errorMessage = 'Failed to download file: 500 Internal Server Error';
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    };
    mockFetch.mockResolvedValueOnce(mockResponse);

    await expect(downloadStockList(mockLogger)).rejects.toThrow(errorMessage);
  });
});
