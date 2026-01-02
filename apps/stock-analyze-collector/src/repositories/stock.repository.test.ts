import { StockRepository } from './stock.repository';
import { LoggerService } from '../services/logger.service';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';
import { Stock } from 'stock-analyze-domain';
import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';

// Mock fs (promises and sync)
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(),
    promises: {
      ...actual.promises,
      mkdir: vi.fn(),
      unlink: vi.fn(),
    },
  };
});

// Hoist mocks
const { mockParquetWriter, mockParquetReader, mockCursor } = vi.hoisted(() => {
  const mockCursor = {
    next: vi.fn(),
  };
  const mockParquetWriter = {
    appendRow: vi.fn(),
    close: vi.fn(),
  };
  const mockParquetReader = {
    getCursor: vi.fn().mockReturnValue(mockCursor),
    close: vi.fn(),
  };
  return { mockParquetWriter, mockParquetReader, mockCursor };
});

const mockedFs = vi.mocked(fsSync);
const mockedFsPromises = vi.mocked(fs);

vi.mock('parquetjs', () => {
  return {
    default: {
      ParquetWriter: {
        openFile: vi.fn().mockResolvedValue(mockParquetWriter),
      },
      ParquetReader: {
        openFile: vi.fn().mockResolvedValue(mockParquetReader),
      },
      ParquetSchema: class {
        constructor() { }
      }
    }
  };
});

import parquetjs from 'parquetjs';

describe('StockRepository', () => {
  let stockRepository: StockRepository;
  let mockLogger: LoggerService;
  const dummyStockList: Stock[] = [
    { code: '1234', name: 'Test Stock 1', market: 'Market A', sector33: 'Sector A', sector17: 'Sector X', scale: 'Large' },
    { code: '5678', name: 'Test Stock 2', market: 'Market B', sector33: 'Sector B', sector17: 'Sector Y', scale: 'Small' },
  ];

  const expectedOutputPath = path.join(__dirname, '..', '..', '..', '..', 'data', 'master', 'stock_list.parquet');

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    } as any;

    stockRepository = new StockRepository(mockLogger);

    vi.clearAllMocks();
    mockedFsPromises.mkdir.mockResolvedValue(undefined);
    mockedFsPromises.unlink.mockResolvedValue(undefined);
  });

  it('should save the stock list to a Parquet file', async () => {
    mockedFs.existsSync.mockReturnValue(false);

    await stockRepository.saveStockList(dummyStockList);

    expect(mockedFsPromises.mkdir).toHaveBeenCalledWith(path.dirname(expectedOutputPath), { recursive: true });
    expect(parquetjs.ParquetWriter.openFile).toHaveBeenCalledWith(expect.anything(), expectedOutputPath);
    expect(mockParquetWriter.appendRow).toHaveBeenCalledTimes(dummyStockList.length);
    expect(mockParquetWriter.appendRow).toHaveBeenCalledWith(dummyStockList[0]);
    expect(mockParquetWriter.close).toHaveBeenCalled();
  });

  it('should delete existing file before saving', async () => {
    mockedFs.existsSync.mockReturnValue(true);

    await stockRepository.saveStockList(dummyStockList);

    expect(mockedFsPromises.unlink).toHaveBeenCalledWith(expectedOutputPath);
  });

  it('should load the stock list from a Parquet file', async () => {
    mockedFs.existsSync.mockReturnValue(true);

    // Mock cursor yielding data then null
    mockCursor.next
      .mockResolvedValueOnce(dummyStockList[0])
      .mockResolvedValueOnce(dummyStockList[1])
      .mockResolvedValueOnce(null);

    const result = await stockRepository.loadStockList();

    expect(parquetjs.ParquetReader.openFile).toHaveBeenCalledWith(expectedOutputPath);
    expect(result).toEqual(dummyStockList);
    expect(mockParquetReader.close).toHaveBeenCalled();
  });

  it('should return an empty array if the Parquet file does not exist', async () => {
    mockedFs.existsSync.mockReturnValue(false);

    const result = await stockRepository.loadStockList();

    expect(result).toEqual([]);
    expect(parquetjs.ParquetReader.openFile).not.toHaveBeenCalled();
  });

  it('should throw an error if reading fails', async () => {
    mockedFs.existsSync.mockReturnValue(true);
    const errorMessage = 'Read Error';
    (parquetjs.ParquetReader.openFile as any).mockRejectedValueOnce(new Error(errorMessage));

    await expect(stockRepository.loadStockList()).rejects.toThrow(errorMessage);
  });
});
