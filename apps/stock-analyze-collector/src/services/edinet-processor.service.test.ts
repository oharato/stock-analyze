import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EdinetProcessorService } from './edinet-processor.service.js';
import { EdinetCommonService } from './edinet-common.service.js';
import { VectorizationService } from './vectorization.service.js';
import { LoggerService } from './logger.service.js';

vi.mock('edinet-ts', () => ({
    EdinetXbrlParser: vi.fn().mockImplementation(() => ({
        parse: vi.fn().mockReturnValue({
            getCommonMetadata: () => ({ docID: 'doc1', filerName: 'Test Filer', submitDate: '2025-01-01' }),
            getQualitativeInfo: () => ({}),
            getKeyMetrics: () => ({}),
            getMajorShareholders: () => ([]),
            getJppfsCor: () => ({})
        })
    }))
}));

describe('EdinetProcessorService', () => {
    let service: EdinetProcessorService;
    let commonServiceMock: any;
    let vectorizationServiceMock: any;
    let logger: LoggerService;

    beforeEach(() => {
        logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
        commonServiceMock = {
            fetchXbrl: vi.fn(),
            extractText: vi.fn(),
            extractNumber: vi.fn()
        };
        vectorizationServiceMock = {
            vectorize: vi.fn().mockResolvedValue([0.1, 0.2, 0.3])
        };

        service = new EdinetProcessorService(logger, commonServiceMock, vectorizationServiceMock);
    });

    it('process should return null if xbrl not found', async () => {
        commonServiceMock.fetchXbrl.mockResolvedValue(null);
        const result = await service.process({ docID: 'doc1' }, '2025-01-01', '1234');
        expect(result).toBeNull();
    });

    it('process should return data object with vectors', async () => {
        commonServiceMock.fetchXbrl.mockResolvedValue('<xml>...</xml>');

        const result = await service.process({ docID: 'doc1' }, '2025-01-01', '1234');

        expect(result).toBeDefined();
        expect(result.doc_id).toBe('doc1');
        expect(result.ticker).toBe('1234');
        expect(result.business_policy_vector).toEqual([0.1, 0.2, 0.3]);
        expect(JSON.parse(result.major_shareholders)).toEqual([]);
    });
});
