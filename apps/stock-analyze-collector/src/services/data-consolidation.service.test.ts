
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataConsolidationService } from './data-consolidation.service.js';
import { LoggerService } from './logger.service.js';
import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
vi.mock('@duckdb/node-api');
vi.mock('fs/promises');
vi.mock('./logger.service.js');

describe('DataConsolidationService', () => {
    let service: DataConsolidationService;
    let logger: LoggerService;
    let mockConn: { run: any; runAndRead: any };
    let mockInstance: { connect: any };

    const dbPath = '/tmp/test.duckdb';
    const dataDir = '/tmp/data';

    beforeEach(() => {
        logger = new LoggerService();

        mockConn = {
            run: vi.fn().mockResolvedValue(undefined),
            runAndRead: vi.fn(),
        };
        mockInstance = {
            connect: vi.fn().mockResolvedValue(mockConn),
        };

        // @ts-ignore
        DuckDBInstance.create.mockResolvedValue(mockInstance);

        service = new DataConsolidationService(logger, dbPath, dataDir);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize duckdb connection on init', async () => {
        await service.init();
        expect(DuckDBInstance.create).toHaveBeenCalledWith(dbPath);
        expect(mockInstance.connect).toHaveBeenCalled();
        expect(mockConn.run).toHaveBeenCalledWith(expect.stringContaining('PRAGMA memory_limit'));
    });

    describe('consolidatePrices (Incremental)', () => {
        it('should process pending codes in chunks and update state', async () => {
            // Mock fs.readdir to return some stock codes
            const mockDirents = [
                { name: 'code=1001', isDirectory: () => true },
                { name: 'code=1002', isDirectory: () => true },
                { name: 'code=1003', isDirectory: () => true },
            ];
            // @ts-ignore
            vi.mocked(fs.readdir).mockResolvedValue(mockDirents);

            // Mock consolidation_state check (empty state)
            const mockReaderState = {
                getRows: vi.fn().mockResolvedValue([]),
            };
            mockConn.runAndRead.mockResolvedValueOnce(mockReaderState);

            // Mock check for existing 'prices' table (not exists -> throw error)
            // The service tries: run('SELECT 1 FROM prices LIMIT 1')
            // Don't use mockRejectedValueOnce because earlier calls (PRAGMA, etc) might consume it.

            // We need to carefully mock the sequence of `run` calls.
            // 1. Create consolidation_state (ok)
            // 2. Load processed codes (via runAndRead) -> Handled above
            // 3. Table check (fail -> not exists) -> Handled above
            // 4. CREATE TABLE prices ...
            // 5. INSERT state
            // 6. CHECKPOINT

            // To simplify, let's just spy on all calls and asserting the args later.
            // But we need to handle the specific rejection for table check.

            // Because 'run' is called multiple times, we need mockImplementation to conditionally reject.
            mockConn.run.mockImplementation(async (query: string) => {
                if (query.includes('SELECT 1 FROM prices LIMIT 1')) {
                    throw new Error('Table not found');
                }
                return;
            });

            // Initialize connection first (implicitly via execute or explicitly)
            // We'll call private method via casting or just generic execute.
            // execute calls other consolidate methods too, so we might want to mock them if they are complex.
            // But here we can just test execute and assume others fail gracefully or run quickly.
            // For this test, let's isolate and call private logic manually if possible, or just use execute.
            // To use execute, we have to mock checking passed codes for stockList/Edinet etc.

            // Let's rely on `execute` calling `consolidatePrices`. 
            // We need to mock readdir for other directories if they are read.
            // data-consolidation.service.ts reads:
            // - stock_list.json (via read_json_auto inside DuckDB) -> no fs.readdir
            // - prices (via fs.readdir)
            // - fundamentals (no fs.readdir, just path)
            // - edinet (no fs.readdir, just path)

            // So fs.readdir is ONLY called for prices. Safe to mock globally.

            await service.execute();

            // Verify fs.readdir called for prices
            expect(fs.readdir).toHaveBeenCalledWith(path.join(dataDir, 'processed/prices'), { withFileTypes: true });

            // Verify logic
            // 1. consolidation_state creation
            expect(mockConn.run).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS consolidation_state'));

            // 2. Fetching state
            expect(mockConn.runAndRead).toHaveBeenCalledWith(expect.stringContaining("SELECT key FROM consolidation_state WHERE category = 'prices'"));

            // 3. Table check failed (caught internally), so subsequent query should be CREATE TABLE AS
            expect(mockConn.run).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE prices AS'));
            expect(mockConn.run).toHaveBeenCalledWith(expect.stringContaining('read_parquet'));

            // 4. State update (batch insert)
            // ('prices', '1001', ...), ('prices', '1002', ...), ('prices', '1003', ...)
            expect(mockConn.run).toHaveBeenCalledWith(expect.stringContaining("INSERT OR IGNORE INTO consolidation_state VALUES ('prices', '1001', current_timestamp)"));
            expect(mockConn.run).toHaveBeenCalledWith(expect.stringContaining("'1002'"));
            expect(mockConn.run).toHaveBeenCalledWith(expect.stringContaining("'1003'"));

            // 5. Checkpoint
            expect(mockConn.run).toHaveBeenCalledWith('CHECKPOINT');
        });

        it('should skip processed codes and resume', async () => {
            // Mock fs.readdir
            const mockDirents = [
                { name: 'code=1001', isDirectory: () => true },
                { name: 'code=1002', isDirectory: () => true },
            ];
            // @ts-ignore
            vi.mocked(fs.readdir).mockResolvedValue(mockDirents);

            // Mock consolidation_state check (1001 already done)
            const mockReaderState = {
                getRows: vi.fn().mockResolvedValue([['1001']]), // Returning code 1001
            };
            mockConn.runAndRead.mockResolvedValueOnce(mockReaderState);

            // Mock check for existing 'prices' table (exists -> ok)
            mockConn.run.mockImplementation(async (query: string) => {
                if (query.includes('SELECT 1 FROM prices LIMIT 1')) {
                    return; // Table exists
                }
                return;
            });

            await service.execute();

            // Should verify:
            // - 1001 is NOT processed
            // - 1002 IS processed
            // - Query is INSERT INTO (not CREATE TABLE)

            // Check that the file list in read_parquet ONLY contains 1002
            const calls = mockConn.run.mock.calls.map(c => c[0]);
            const insertCalls = calls.filter(c => c.includes('read_parquet'));
            expect(insertCalls.length).toBe(1);

            const query = insertCalls[0];
            expect(query).toContain('INSERT INTO prices');
            expect(query).not.toContain('CREATE TABLE prices AS');
            expect(query).toContain('code=1002');
            expect(query).not.toContain('code=1001');

            // State update for 1002 only
            const stateUpdateCall = calls.find(c => c.includes('INSERT OR IGNORE INTO consolidation_state'));
            expect(stateUpdateCall).toContain('1002');
            expect(stateUpdateCall).not.toContain('1001');
        });

        it('should default to CREATE TABLE if prices table check fails', async () => {
            // Case: 1001 done, but prices table gone? 
            // Actually currently code logic: if state says 1001 done, it is skipped.
            // If prices table gone, subsequent codes will trigger CREATE TABLE.
            // But existing data (1001) would be missing from new table.
            // This is a known limitation/behavior. Verification here just ensures code behavior matches.

            const mockDirents = [
                { name: 'code=2001', isDirectory: () => true },
            ];
            // @ts-ignore
            vi.mocked(fs.readdir).mockResolvedValue(mockDirents);

            // Empty state
            const mockReaderState = { getRows: vi.fn().mockResolvedValue([]) };
            mockConn.runAndRead.mockResolvedValueOnce(mockReaderState);

            // Table check fails
            mockConn.run.mockImplementation(async (query: string) => {
                if (query.includes('SELECT 1 FROM prices LIMIT 1')) throw new Error('Not found');
            });

            await service.execute();

            const calls = mockConn.run.mock.calls.map(c => c[0]);
            const createCall = calls.find(c => c.includes('CREATE TABLE prices AS'));
            expect(createCall).toBeDefined();
        });
    });
});
