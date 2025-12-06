import { parseStockList } from './stock-list.parser';
import { LoggerService } from '../services/logger.service';
import { promises as fs } from 'fs';
import path from 'path';
import { Stock } from 'stock-analyze-domain';
import * as xlsx from 'xlsx'; // xlsxをインポート
import { vi, describe, it, expect, beforeAll } from 'vitest';

describe('parseStockList', () => {
  let dummyExcelBuffer: Buffer;
  let expectedStockList: Stock[];
  let mockLogger: LoggerService;

  beforeAll(async () => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    } as any;

    const testDataDir = path.join(__dirname, 'test_data');
    dummyExcelBuffer = await fs.readFile(path.join(testDataDir, 'jpx_stock_list.xls'));
    const expectedJsonBuffer = await fs.readFile(path.join(testDataDir, 'expected_stock_list.json'));
    expectedStockList = JSON.parse(expectedJsonBuffer.toString());
  });

  it('should parse the Excel buffer and return a list of stocks', () => {
    const result = parseStockList(dummyExcelBuffer, mockLogger);
    expect(result).toEqual(expectedStockList);
  });

  it('should filter out invalid stock entries', () => {
    const mockLogger2 = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    } as any;

    // 有効なデータと無効なデータを含むJSONオブジェクト
    const rawData = [
      { 'コード': '1234', '銘柄名': '有効銘柄', '市場・商品区分': '市場A', '33業種区分': 'A', '17業種区分': 'X', '規模区分': 'Large' },
      { 'コード': 'ABC', '銘柄名': '無効コード', '市場・商品区分': '市場B', '33業種区分': 'B', '17業種区分': 'Y', '規模区分': 'Small' }, // コードが不正
      { 'コード': '12345', '銘柄名': '桁数オーバー', '市場・商品区分': '市場C', '33業種区分': 'C', '17業種区分': 'Z', '規模区分': 'Medium' }, // コードが不正
      { 'コード': '1234', '銘柄名': '', '市場・商品区分': '市場D', '33業種区分': 'D', '17業種区分': 'W', '規模区分': 'Small' }, // 銘柄名なし
    ];
    // xlsxを使ってExcel形式のBufferを生成
    const ws = xlsx.utils.json_to_sheet(rawData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
    const invalidExcelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xls' });

    const result = parseStockList(invalidExcelBuffer, mockLogger2);

    expect(result.length).toBe(1);
    expect(result[0].code).toBe('1234');
    expect(result[0].name).toBe('有効銘柄');
  });

  it('should throw an error if no stocks are extracted', () => {
    const mockLogger3 = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    } as any;

    const emptyExcelBuffer = Buffer.from('コード,銘柄名\n', 'utf8');
    expect(() => parseStockList(emptyExcelBuffer, mockLogger3)).toThrow('Could not extract any stocks. The Excel sheet format might have changed.');
  });
});
