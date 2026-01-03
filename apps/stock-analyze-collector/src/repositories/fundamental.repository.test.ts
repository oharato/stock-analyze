import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FundamentalRepository } from './fundamental.repository.js';
import { LoggerService } from '../services/logger.service.js';
import path from 'path';
import fs from 'fs';
import pkg from 'parquetjs';
const { ParquetReader } = pkg;

// Mock LoggerService
const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
} as unknown as LoggerService;

const TEST_DIR = path.join(__dirname, 'test_output');

describe('FundamentalRepository', () => {
    let repository: FundamentalRepository;

    beforeEach(() => {
        repository = new FundamentalRepository(mockLogger);
        if (!fs.existsSync(TEST_DIR)) {
            fs.mkdirSync(TEST_DIR, { recursive: true });
        }
        // Repositoryクラス内でBASE_DIRがハードコードされているため、
        // テスト専用のコード（TEST_CODE_9999など）を使用して衝突を避ける戦略を採用
    });

    afterEach(() => {
        // テストで作成したディレクトリをクリーンアップ
        const testCodeDir = path.join(process.cwd(), 'data', 'processed', 'fundamentals', 'code=TEST_9999');
        if (fs.existsSync(testCodeDir)) {
            fs.rmSync(testCodeDir, { recursive: true, force: true });
        }
    });

    it('should correctly infer schema and save data with hyphens', async () => {
        const code = 'TEST_9999';
        const mergedData = new Map<string, any[]>();

        const yearlyData = [
            { code: code, year: '2020', 売上高: 150000000, 営業利益: '-' }, // 数値とハイフン
            { code: code, year: '2021', 売上高: '-', 営業利益: 10000000 },  // ハイフンと数値
            { code: code, year: '2022', 売上高: 160000000, 営業利益: 20000000 }, // 両方数値
        ];

        mergedData.set(code, yearlyData);

        await repository.save(mergedData);

        // ... (path setup omitted) ...
        const workspaceRoot = path.join(process.cwd(), '..', '..');
        const savedPath = path.join(workspaceRoot, 'data', 'processed', 'fundamentals', `code=${code}`, 'fundamentals.parquet');

        expect(fs.existsSync(savedPath)).toBe(true);

        // Parquetファイルを読み込み
        const reader = await ParquetReader.openFile(savedPath);
        const cursor = reader.getCursor();
        const records = [];
        let record = await cursor.next();
        while (record) {
            records.push(record);
            record = await cursor.next();
        }
        await reader.close();

        expect(records.length).toBe(3);

        const row1 = records.find(r => r.year === '2020');
        expect(row1?.['売上高']).toBe(150000000);
        expect(row1?.['営業利益']).toBeUndefined();

        const row2 = records.find(r => r.year === '2021');
        expect(row2?.['売上高']).toBeUndefined();
        expect(row2?.['営業利益']).toBe(10000000);

        const row3 = records.find(r => r.year === '2022');
        expect(row3?.['売上高']).toBe(160000000);
        expect(row3?.['営業利益']).toBe(20000000);
    });
});
