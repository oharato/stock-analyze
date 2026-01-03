import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LargeShareholdingFetchService } from './large-shareholding-fetch.service.js';
import { EdinetCommonService } from './edinet-common.service.js';
import { LoggerService } from './logger.service.js';
import { LargeShareholding } from 'stock-analyze-domain';

const { mockCommonServiceInstance } = vi.hoisted(() => {
    return {
        mockCommonServiceInstance: {
            fetchXbrl: vi.fn(),
            extractText: vi.fn(),
            extractNumber: vi.fn(),
            init: vi.fn(),
            updateMetadata: vi.fn()
        }
    };
});

// Mock EdinetCommonService completely
vi.mock('./edinet-common.service.js', () => ({
    EdinetCommonService: vi.fn().mockReturnValue(mockCommonServiceInstance)
}));

describe('LargeShareholdingFetchService', () => {
    let service: LargeShareholdingFetchService;
    let commonServiceMock: any;
    let logger: LoggerService;

    beforeEach(() => {
        logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;

        // Instantiate service (this will call new EdinetCommonService internally)
        service = new LargeShareholdingFetchService(logger, 'dummysub', 'dummy-data', 'dummy-db');

        // Reset mocks
        vi.clearAllMocks();
    });

    it('processDocument should return null if xbrl not found', async () => {
        mockCommonServiceInstance.fetchXbrl.mockResolvedValue(null);
        // @ts-ignore - Accessing private method for testing
        const result = await service['processDocument']({ docID: 'doc1' });
        expect(result).toBeNull();
    });

    it('processDocument should return LargeShareholding object', async () => {
        const mockXbrl = `
            <jpcrp_cor:SecurityCode>12340</jpcrp_cor:SecurityCode>
            <jplvh_cor:PurposeOfHolding>Purpose</jplvh_cor:PurposeOfHolding>
            <jplvh_cor:HoldingRatioOfShareCertificatesEtc>5.0</jplvh_cor:HoldingRatioOfShareCertificatesEtc>
            <jplvh_cor:HoldingRatioOfShareCertificatesEtcPerLastReport>4.0</jplvh_cor:HoldingRatioOfShareCertificatesEtcPerLastReport>
            <jplvh_cor:TotalNumberOfStocksEtcHeld>1000000</jplvh_cor:TotalNumberOfStocksEtcHeld>
        `;

        mockCommonServiceInstance.fetchXbrl.mockResolvedValue(mockXbrl);
        mockCommonServiceInstance.extractText.mockReturnValue('Purpose');
        mockCommonServiceInstance.extractNumber.mockImplementation((_xml: string, tag: string) => {
            if (tag.includes('PerLastReport')) return 4.0;
            if (tag.includes('HoldingRatioOfShareCertificatesEtc')) return 5.0;
            if (tag.includes('TotalNumberOfStocksEtcHeld')) return 1000000;
            return 0;
        });

        const mockDoc = {
            docID: 'doc1',
            submitDate: '2025-01-01',
            filerName: 'Filer A',
            docDescription: 'Report',
            docTypeCode: '340'
        };

        // Check if mock is set up correctly
        const internalService = (service as any).commonService;
        expect(internalService).toBe(mockCommonServiceInstance);

        // Execute
        // @ts-ignore
        const result = await service['processDocument'](mockDoc);

        expect(result).toBeDefined();
        const data = result as LargeShareholding;

        expect(data.doc_id).toBe('doc1');
        expect(data.ticker).toBe('1234');
        expect(data.holding_purpose).toBe('Purpose');
        expect(data.holding_ratio).toBe(5.0);
        expect(data.total_shares_held).toBe(1000000);
    });
});
