import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EdinetCommonService } from './edinet-common.service.js';
import { LoggerService } from './logger.service.js';
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

// Mock dependencies
vi.mock('edinet-ts', () => ({
    EdinetXbrlDownloader: vi.fn().mockImplementation(() => ({
        fetchXbrl: vi.fn()
    })),
    EdinetInfoSeeder: vi.fn().mockImplementation(() => ({
        run: vi.fn()
    }))
}));

vi.mock('better-sqlite3');
// Mock fs and Database specifically for getLastSeededDate logic
vi.mock('fs');

describe('EdinetCommonService', () => {
    let service: EdinetCommonService;
    let logger: LoggerService;
    const mockDataDir = '/tmp/data/edinet';
    const mockDbPath = '/tmp/data/edinet.db';

    beforeEach(() => {
        logger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        } as unknown as LoggerService;
        service = new EdinetCommonService(logger, 'api-key', mockDataDir, mockDbPath);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('init() should initialize downloader', async () => {
        await service.init();
        expect(service.downloader).toBeDefined();
    });

    it('extractText should extract text from XML tags', () => {
        const xml = '<test:Tag>Hello World</test:Tag>';
        const result = service.extractText(xml, 'test:Tag');
        expect(result).toBe('Hello World');
    });

    it('extractNumber should extract number from XML tags', () => {
        const xml = '<test:Num>1,234.56</test:Num>';
        const result = service.extractNumber(xml, 'test:Num');
        expect(result).toBe(1234.56);
    });

    // Add more tests for updateMetadata, fetchXbrl mocking fs...
});
