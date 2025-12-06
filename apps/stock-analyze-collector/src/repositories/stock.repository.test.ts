import { StockRepository } from './stock.repository';
import { LoggerService } from '../services/logger.service';
import { promises as fs } from 'fs';
import path from 'path';
import { Stock } from 'stock-analyze-domain';
import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';

// fs.promisesモジュールをモック化
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    promises: {
      ...actual.promises,
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      readFile: vi.fn(),
    },
  };
});

const mockedFsPromises = vi.mocked(fs);

describe('StockRepository', () => {
  let stockRepository: StockRepository;
  let mockLogger: LoggerService;
  const dummyStockList: Stock[] = [
    { code: '1234', name: 'Test Stock 1', market: 'Market A', sector33: 'Sector A', sector17: 'Sector X', scale: 'Large' },
    { code: '5678', name: 'Test Stock 2', market: 'Market B', sector33: 'Sector B', sector17: 'Sector Y', scale: 'Small' },
  ];
  const expectedJsonString = JSON.stringify(dummyStockList, null, 2);
  const expectedOutputPath = path.join(__dirname, '..', '..', '..', '..', 'data', 'master', 'stock_list.json');

  // consoleのモック
  const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    } as any;
    
    stockRepository = new StockRepository(mockLogger);
    // 各テストの前にモックをリセット
    mockedFsPromises.mkdir.mockReset();
    mockedFsPromises.writeFile.mockReset();
    mockedFsPromises.readFile.mockReset();
    consoleLogSpy.mockClear();
    consoleWarnSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should save the stock list to a JSON file', async () => {
    mockedFsPromises.mkdir.mockResolvedValue(undefined);
    mockedFsPromises.writeFile.mockResolvedValue(undefined);

    await stockRepository.saveStockList(dummyStockList);

    expect(mockedFsPromises.mkdir).toHaveBeenCalledTimes(1);
    expect(mockedFsPromises.mkdir).toHaveBeenCalledWith(path.dirname(expectedOutputPath), { recursive: true });
    expect(mockedFsPromises.writeFile).toHaveBeenCalledTimes(1);
    expect(mockedFsPromises.writeFile).toHaveBeenCalledWith(expectedOutputPath, expectedJsonString);
  });

  it('should load the stock list from a JSON file', async () => {
    mockedFsPromises.readFile.mockResolvedValue(Buffer.from(expectedJsonString));

    const result = await stockRepository.loadStockList();

    expect(mockedFsPromises.readFile).toHaveBeenCalledTimes(1);
    expect(mockedFsPromises.readFile).toHaveBeenCalledWith(expectedOutputPath);
    expect(result).toEqual(dummyStockList);
  });

  it('should return an empty array if the stock list file does not exist', async () => {
    const error = new Error('File not found') as any;
    error.code = 'ENOENT';
    mockedFsPromises.readFile.mockRejectedValue(error);

    const result = await stockRepository.loadStockList();

    expect(mockedFsPromises.readFile).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });

  it('should throw an error if reading the file fails for other reasons', async () => {
    const errorMessage = 'Permission denied';
    mockedFsPromises.readFile.mockRejectedValue(new Error(errorMessage));

    await expect(stockRepository.loadStockList()).rejects.toThrow(errorMessage);
  });
});
