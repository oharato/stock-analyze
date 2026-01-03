import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EdinetFetchService } from './edinet-fetch.service.js';
import { LoggerService } from './logger.service.js';
import { EdinetDocumentType } from 'edinet-ts';

// Mock dependencies
vi.mock('./edinet-common.service.js', () => ({
    EdinetCommonService: vi.fn().mockImplementation(() => ({
        init: vi.fn(),
        updateMetadata: vi.fn(),
    }))
}));
vi.mock('./vectorization.service.js', () => ({
    VectorizationService: vi.fn().mockImplementation(() => ({
        init: vi.fn(),
    }))
}));
vi.mock('./edinet-processor.service.js', () => ({
    EdinetProcessorService: vi.fn().mockImplementation(() => ({
        process: vi.fn().mockResolvedValue({ doc_id: 'processed_doc' })
    }))
}));

vi.mock('edinet-ts', () => ({
    EdinetRepository: vi.fn().mockImplementation(() => ({
        findDocuments: vi.fn().mockResolvedValue([
            { docID: 'doc1', submitDate: '2025-01-01', docTypeCode: '120', secCode: '12340' } // Annual Report
        ]),
        close: vi.fn()
    })),
    EdinetDocumentType: {
        AnnualCards: '120',
        SemiAnnualReport: '130',
        QuarterlyReport: '140'
    }
}));

import { EdinetCommonService } from './edinet-common.service.js';
import { VectorizationService } from './vectorization.service.js';
import { EdinetProcessorService } from './edinet-processor.service.js';

describe('EdinetFetchService', () => {
    let service: EdinetFetchService;
    let logger: LoggerService;

    beforeEach(() => {
        logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
        service = new EdinetFetchService(logger, 'api-key', '/tmp/data', '/tmp/db');
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize all services', async () => {
        await service.init();
        const commonService = (service as any).commonService;
        const vectorizationService = (service as any).vectorizationService;

        expect(commonService.init).toHaveBeenCalled();
        expect(vectorizationService.init).toHaveBeenCalled();
    });

    it('processAll should call updateMetadata and processDocsByMonth', async () => {
        // Mock internal processDocsByMonth to avoid complex fs mocking
        // But since it's private and we want to test orchestration, maybe we allow it to run but mock fs?
        // Or simpler: verify updateMetadata is called and repo.findDocuments is called.

        // Let's spy on the private method if possible, or just check the side effects (processor calls)
        const processSpy = vi.spyOn(service as any, 'processDocsByMonth');
        processSpy.mockImplementation(async () => { }); // Skip actual batch logic

        await service.processAll(1);

        const commonService = (service as any).commonService;
        expect(commonService.updateMetadata).toHaveBeenCalledWith(1);
        expect(processSpy).toHaveBeenCalled();
    });
});
