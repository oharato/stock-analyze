import { vi } from 'vitest';

vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn().mockImplementation(() => Promise.resolve()),
    access: vi.fn().mockImplementation(() => Promise.resolve())
  }
}));

import { PriceRepository } from './price.repository';
import { LoggerService } from '../services/logger.service';
import * as fs from 'fs';
import path from 'path';
import { ParquetWriter } from 'parquetjs';
import { Price } from 'stock-analyze-domain';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// parquetjsモジュールをモック化
// parquetjsモジュールをモック化
vi.mock('parquetjs', () => {
  const openFileMock = vi.fn().mockImplementation(() => Promise.resolve({
    appendRow: vi.fn().mockImplementation(() => Promise.resolve()),
    close: vi.fn().mockImplementation(() => Promise.resolve()),
  }));

  const ParquetWriterMock = {
    openFile: openFileMock
  };

  const ParquetSchemaMock = vi.fn();

  return {
    default: {
      ParquetWriter: ParquetWriterMock,
      ParquetSchema: ParquetSchemaMock,
    },
    ParquetWriter: ParquetWriterMock,
    ParquetSchema: ParquetSchemaMock,
  };
});

describe('PriceRepository', () => {
  let priceRepository: PriceRepository;
  let mockLogger: LoggerService;
  const dummyPrices: Price[] = [
    { date: new Date('2023-01-01'), code: '1234', open: 100, high: 110, low: 90, close: 105, adjClose: 105, volume: BigInt(1000) },
    { date: new Date('2023-01-02'), code: '1234', open: 105, high: 115, low: 95, close: 110, adjClose: 110, volume: BigInt(2000) },
  ];
  const code = '1234';
  const year = 2023;
  const month = 1;
  const expectedOutputDir = path.join(__dirname, '..', '..', '..', '..', 'data', 'processed', 'prices', `code=${code}`);
  const expectedOutputPath = path.join(expectedOutputDir, `${year}-${String(month).padStart(2, '0')}.parquet`);

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    } as any;

    priceRepository = new PriceRepository(mockLogger);
    vi.clearAllMocks(); // すべてのモックをリセット
  });

  it('should write monthly parquet file correctly', async () => {
    vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
    const mockAppendRow = vi.fn().mockImplementation(() => Promise.resolve());
    const mockClose = vi.fn().mockImplementation(() => Promise.resolve());
    const mockParquetWriter = {
      appendRow: mockAppendRow,
      close: mockClose
    };
    (ParquetWriter.openFile as any).mockResolvedValue(mockParquetWriter);

    await priceRepository.writeMonthParquetFile(code, year, month, dummyPrices);

    expect(fs.promises.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.promises.mkdir).toHaveBeenCalledWith(expectedOutputDir, { recursive: true });
    expect(ParquetWriter.openFile).toHaveBeenCalledTimes(1);
    expect(ParquetWriter.openFile).toHaveBeenCalledWith(expect.any(Object), expectedOutputPath); // schemaはanyでチェック
    expect(mockAppendRow).toHaveBeenCalledTimes(dummyPrices.length);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('should check if stock price directory exists', async () => {
    vi.mocked(fs.promises.access).mockResolvedValue(undefined); // ディレクトリが存在する場合

    const exists = await priceRepository.checkStockPriceDirectoryExists(code);

    expect(fs.promises.access).toHaveBeenCalledTimes(1);
    expect(fs.promises.access).toHaveBeenCalledWith(expectedOutputDir);
    expect(exists).toBe(true);
  });

  it('should return false if stock price directory does not exist (ENOENT error)', async () => {
    const error = new Error('File not found') as any;
    error.code = 'ENOENT';
    vi.mocked(fs.promises.access).mockRejectedValue(error); // ディレクトリが存在しない場合

    const exists = await priceRepository.checkStockPriceDirectoryExists(code);

    expect(fs.promises.access).toHaveBeenCalledTimes(1);
    expect(exists).toBe(false);
  });

  it('should throw an error if checking directory fails for other reasons', async () => {
    const errorMessage = 'Permission denied';
    vi.mocked(fs.promises.access).mockRejectedValue(new Error(errorMessage)); // その他のエラー

    await expect(priceRepository.checkStockPriceDirectoryExists(code)).rejects.toThrow(errorMessage);
    expect(fs.promises.access).toHaveBeenCalledTimes(1);
  });

  it('should not write row if volume is null or undefined', async () => {
    const pricesWithInvalidVolume: Price[] = [
      { date: new Date('2023-01-01'), code: '1234', open: 100, high: 110, low: 90, close: 105, adjClose: 105, volume: BigInt(1000) },
      { date: new Date('2023-01-02'), code: '1234', open: 105, high: 115, low: 95, close: 110, adjClose: 110, volume: undefined as any }, // volumeがundefined
      { date: new Date('2023-01-03'), code: '1234', open: 105, high: 115, low: 95, close: 110, adjClose: 110, volume: null as any }, // volumeがnull
    ];

    vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
    const mockAppendRow = vi.fn().mockResolvedValue(undefined);
    (ParquetWriter.openFile as any).mockResolvedValue({
      appendRow: mockAppendRow,
      close: vi.fn().mockResolvedValue(undefined),
    } as any);

    await priceRepository.writeMonthParquetFile(code, year, month, pricesWithInvalidVolume);

    expect(mockAppendRow).toHaveBeenCalledTimes(1); // 有効なvolumeを持つ行のみが書き込まれる
    expect(mockAppendRow).toHaveBeenCalledWith(expect.objectContaining({ code: '1234', volume: BigInt(1000) }));
  });
});
