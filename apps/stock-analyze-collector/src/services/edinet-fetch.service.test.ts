import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EdinetFetchService } from './edinet-fetch.service.js';
import { LoggerService } from './logger.service.js';
import * as fs from 'fs';
import * as path from 'path';

// Mock modules
vi.mock('edinet-ts', () => ({
    EdinetXbrlDownloader: vi.fn().mockImplementation(() => ({
        fetchXbrl: vi.fn()
    })),
    EdinetXbrlParser: vi.fn().mockImplementation(() => ({
        parse: vi.fn()
    })),
    EdinetDocumentType: {
        AnnualCards: '120',
        SemiAnnualReport: '160',
        QuarterlyReport: '140'
    },
    EdinetInfoSeeder: vi.fn(),
    EdinetRepository: vi.fn()
}));

vi.mock('@xenova/transformers', () => ({
    pipeline: vi.fn().mockResolvedValue(vi.fn().mockResolvedValue({ data: new Float32Array(384) }))
}));

vi.mock('fs');
vi.mock('./logger.service.js');

describe('EdinetFetchService', () => {
    let service: EdinetFetchService;
    let mockLogger: any;
    const testDataDir = '/test/data';
    const testDbPath = '/test/edinet.db';

    beforeEach(() => {
        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        };
        vi.mocked(LoggerService).mockImplementation(() => mockLogger);

        service = new EdinetFetchService(
            new LoggerService(),
            'test-api-key',
            testDataDir,
            testDbPath
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('XBRL Caching', () => {
        it('should use cached XBRL if it exists', async () => {
            const mockDoc = {
                docID: 'S100TEST',
                docDescription: 'Test Document',
                secCode: '12340'
            };
            const cachedXbrl = '<xbrl>cached content</xbrl>';
            const cachePath = path.join(testDataDir, '../xbrl-cache', 'S100TEST.xml');

            // Mock file system
            vi.mocked(fs.existsSync).mockImplementation((p) => {
                if (p === cachePath) return true;
                return false;
            });
            vi.mocked(fs.readFileSync).mockReturnValue(cachedXbrl);
            vi.mocked(fs.writeFileSync).mockImplementation(() => { });

            // Initialize service
            await service.init();

            // Mock parser
            const mockParser = (service as any).parser;
            mockParser.parse.mockReturnValue({
                getCommonMetadata: () => ({
                    docID: 'S100TEST',
                    filerName: 'Test Company',
                    edinetCode: 'E12345',
                    docDescription: 'Test Document',
                    submitDate: '2025-01-01'
                }),
                getQualitativeInfo: () => ({
                    businessRisks: 'Test risks',
                    financialAnalysis: 'Test analysis'
                }),
                getKeyMetrics: () => ({}),
                getMajorShareholders: () => []
            });

            // Process document
            await (service as any).processDocument(mockDoc, '2025-01-01', '1234');

            // Verify cache was used
            expect(fs.readFileSync).toHaveBeenCalledWith(cachePath, 'utf-8');
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Using cached XBRL'));
        });

        it('should fetch from API and cache if not cached', async () => {
            const mockDoc = {
                docID: 'S100NEW',
                docDescription: 'New Document',
                secCode: '12340'
            };
            const fetchedXbrl = '<xbrl>fresh content</xbrl>';
            const cachePath = path.join(testDataDir, '../xbrl-cache', 'S100NEW.xml');

            // Mock file system - cache doesn't exist
            vi.mocked(fs.existsSync).mockReturnValue(false);
            vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
            vi.mocked(fs.writeFileSync).mockImplementation(() => { });

            // Mock downloader
            await service.init();
            const mockDownloader = (service as any).downloader;
            mockDownloader.fetchXbrl.mockResolvedValue(fetchedXbrl);

            // Mock parser
            const mockParser = (service as any).parser;
            mockParser.parse.mockReturnValue({
                getCommonMetadata: () => ({
                    docID: 'S100NEW',
                    filerName: 'New Company',
                    edinetCode: 'E67890',
                    docDescription: 'New Document',
                    submitDate: '2025-01-01'
                }),
                getQualitativeInfo: () => ({
                    businessRisks: 'Test risks',
                    financialAnalysis: 'Test analysis'
                }),
                getKeyMetrics: () => ({}),
                getMajorShareholders: () => []
            });

            // Process document
            await (service as any).processDocument(mockDoc, '2025-01-01', '1234');

            // Verify API was called
            expect(mockDownloader.fetchXbrl).toHaveBeenCalledWith('S100NEW');
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Fetching XBRL from API'));

            // Verify cache was saved
            expect(fs.writeFileSync).toHaveBeenCalledWith(cachePath, fetchedXbrl, 'utf-8');
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Cached XBRL to'));
        });
    });

    describe('Fallback Parsing', () => {
        it('should use fallback parser when standard parsing returns empty', async () => {
            const mockXml = `
                <xbrl>
                    <jpcrp_cor:BusinessRisksTextBlock>Risk content here</jpcrp_cor:BusinessRisksTextBlock>
                    <jpcrp_cor:ManagementAnalysisOfFinancialPositionOperatingResultsAndCashFlowsTextBlock>
                        Analysis content
                    </jpcrp_cor:ManagementAnalysisOfFinancialPositionOperatingResultsAndCashFlowsTextBlock>
                </xbrl>
            `;

            const result = (service as any).parseFallback(mockXml);

            expect(result.qualInfo.businessRisks).toContain('Risk content here');
            expect(result.qualInfo.financialAnalysis).toContain('Analysis content');
        });

        it('should handle missing tags gracefully', async () => {
            const mockXml = '<xbrl></xbrl>';

            const result = (service as any).parseFallback(mockXml);

            expect(result.qualInfo.businessRisks).toBeUndefined();
            expect(result.qualInfo.financialAnalysis).toBeUndefined();
            expect(result.qualInfo.corporateGovernance).toBeUndefined();
        });
    });



    describe('Document Filtering', () => {
        it('should filter out documents without secCode', () => {
            const docs = [
                { docID: 'S1', secCode: '12340', submitDate: '2025-01-01', docTypeCode: '120' },
                { docID: 'S2', secCode: null, submitDate: '2025-01-02', docTypeCode: '120' },
                { docID: 'S3', secCode: '56780', submitDate: '2025-01-03', docTypeCode: '120' }
            ];

            const targetTypes = ['120'];
            const startStr = '2024-01-01';
            const endStr = '2025-12-31';

            const filtered = docs.filter((d: any) => {
                const date = d.submitDate || d.date;
                if (!date) return false;
                if (date < startStr || date > endStr) return false;
                if (!d.secCode) return false;
                return targetTypes.includes(String(d.docTypeCode));
            });

            expect(filtered).toHaveLength(2);
            expect(filtered[0].docID).toBe('S1');
            expect(filtered[1].docID).toBe('S3');
        });
    });

    describe('Vectorization', () => {
        it('should return empty array for empty text', async () => {
            const result = await (service as any).vectorize('');
            expect(result).toEqual([]);
        });

        it('should handle vectorization errors gracefully', async () => {
            await service.init();
            const mockExtractor = (service as any).extractor;
            mockExtractor.mockRejectedValueOnce(new Error('Vectorization failed'));

            const result = await (service as any).vectorize('test text');

            expect(result).toEqual([]);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Vectorization failed'));
        });
    });
});
