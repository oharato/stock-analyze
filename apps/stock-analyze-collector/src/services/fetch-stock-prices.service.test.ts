import { FetchStockPricesService } from './fetch-stock-prices.service.js';
import { YahooFinanceClient } from '../clients/yahoo-finance.client.js';
import { StockRepository } from '../repositories/stock.repository.js';
import { PriceRepository } from '../repositories/price.repository.js';
import { CliArgsService } from './cli-args.service.js';
import { LoggerService } from './logger.service.js';
import { Stock } from 'stock-analyze-domain';
import { vi, describe, it, expect, beforeEach, afterEach, type Mocked } from 'vitest';

describe('FetchStockPricesService', () => {
    let service: FetchStockPricesService;
    let mockYahooFinanceClient: Mocked<YahooFinanceClient>;
    let mockStockRepository: Mocked<StockRepository>;
    let mockPriceRepository: Mocked<PriceRepository>;
    let mockCliArgsService: Mocked<CliArgsService>;
    let mockLogger: Mocked<LoggerService>;

    const dummyStockList: Stock[] = [
        { code: '1234', name: 'Stock A', market: 'TSE', sector33: 'A', sector17: 'X', scale: 'Large' },
        { code: '5678', name: 'Stock B', market: 'TSE', sector33: 'B', sector17: 'Y', scale: 'Small' },
        { code: '9012', name: 'Stock C', market: 'TSE', sector33: 'C', sector17: 'Z', scale: 'Medium' },
        { code: '1001', name: 'Stock D', market: 'TSE', sector33: 'D', sector17: 'W', scale: 'Large' },
        { code: '2002', name: 'Stock E', market: 'TSE', sector33: 'E', sector17: 'V', scale: 'Small' },
        { code: '3003', name: 'Stock F', market: 'TSE', sector33: 'F', sector17: 'U', scale: 'Medium' },
        { code: '4004', name: 'Stock G', market: 'TSE', sector33: 'G', sector17: 'T', scale: 'Large' },
        { code: '5005', name: 'Stock H', market: 'TSE', sector33: 'H', sector17: 'S', scale: 'Small' },
        { code: '6006', name: 'Stock I', market: 'TSE', sector33: 'I', sector17: 'R', scale: 'Medium' },
        { code: '7007', name: 'Stock J', market: 'TSE', sector33: 'J', sector17: 'Q', scale: 'Large' },
        { code: '8008', name: 'Stock K', market: 'TSE', sector33: 'K', sector17: 'P', scale: 'Small' },
    ];

    const dummyHistoricalData: any[] = [
        { date: new Date('2023-01-01'), open: 100, high: 110, low: 90, close: 105, adjClose: 105, volume: 1000 },
        { date: new Date('2023-01-02'), open: 105, high: 115, low: 95, close: 110, adjClose: 110, volume: 2000 },
        { date: new Date('2023-02-01'), open: 110, high: 120, low: 100, close: 115, adjClose: 115, volume: 1500 },
    ];

    const dummyQuote = { firstTradeDateMilliseconds: new Date('2000-01-01').getTime() };

    beforeEach(() => {
        mockYahooFinanceClient = {
            getHistoricalData: vi.fn().mockResolvedValue(dummyHistoricalData),
            getQuote: vi.fn().mockResolvedValue(dummyQuote),
            sleep: vi.fn().mockResolvedValue(undefined),
        } as unknown as Mocked<YahooFinanceClient>;

        mockStockRepository = {
            loadStockList: vi.fn().mockResolvedValue(dummyStockList),
            saveStockList: vi.fn(), // 今回は使わない
        } as unknown as Mocked<StockRepository>;

        mockPriceRepository = {
            writeMonthParquetFile: vi.fn().mockResolvedValue(undefined),
            checkStockPriceDirectoryExists: vi.fn().mockResolvedValue(false), // デフォルトは存在しない
        } as unknown as Mocked<PriceRepository>;

        mockCliArgsService = {
            parse: vi.fn().mockReturnValue({ codes: null, startDate: null, endDate: null }), // デフォルトは引数なし
        } as unknown as Mocked<CliArgsService>;

        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
            log: vi.fn(),
        } as unknown as Mocked<LoggerService>;

        service = new FetchStockPricesService(
            mockYahooFinanceClient,
            mockStockRepository,
            mockPriceRepository,
            mockCliArgsService,
            mockLogger
        );

        vi.spyOn(console, 'log').mockImplementation(() => { }); // console.logをモック
        vi.spyOn(console, 'warn').mockImplementation(() => { }); // console.warnをモック
        vi.spyOn(console, 'error').mockImplementation(() => { }); // console.errorをモック
    });

    afterEach(() => {
        vi.restoreAllMocks(); // console.logなどのモックを元に戻す
    });

    it('should process all stocks by default', async () => {
        await service.execute(['node', 'script.ts']);

        expect(mockCliArgsService.parse).toHaveBeenCalledTimes(1);
        expect(mockStockRepository.loadStockList).toHaveBeenCalledTimes(1);
        expect(mockYahooFinanceClient.getQuote).toHaveBeenCalledTimes(11); // 全11銘柄
        expect(mockYahooFinanceClient.getHistoricalData).toHaveBeenCalledTimes(11);
        expect(mockPriceRepository.writeMonthParquetFile).toHaveBeenCalled(); // 少なくとも1回は呼ばれる
        expect(mockYahooFinanceClient.sleep).toHaveBeenCalledTimes(11);
    });

    it('should process specified stocks when --codes is provided', async () => {
        mockCliArgsService.parse.mockReturnValue({ codes: ['1234', '9012'], startDate: null, endDate: null });

        await service.execute(['node', 'script.ts', '--codes', '1234,9012']);

        expect(mockCliArgsService.parse).toHaveBeenCalledTimes(1);
        expect(mockStockRepository.loadStockList).toHaveBeenCalledTimes(1);
        expect(mockYahooFinanceClient.getQuote).toHaveBeenCalledTimes(2); // 指定された2銘柄
        expect(mockYahooFinanceClient.getHistoricalData).toHaveBeenCalledTimes(2);
        expect(mockPriceRepository.writeMonthParquetFile).toHaveBeenCalled();
        expect(mockYahooFinanceClient.sleep).toHaveBeenCalledTimes(2);
    });

    it('should fetch data for a specified period in manual mode', async () => {
        const startDate = new Date('2023-01-01');
        const endDate = new Date('2023-01-31');
        mockCliArgsService.parse.mockReturnValue({ codes: ['1234'], startDate, endDate });

        await service.execute(['node', 'script.ts', '--codes', '1234', '--start-date', '2023-01-01', '--end-date', '2023-01-31']);

        expect(mockYahooFinanceClient.getHistoricalData).toHaveBeenCalledWith('1234.T', { period1: startDate, period2: endDate, interval: '1d' });
        expect(mockPriceRepository.writeMonthParquetFile).toHaveBeenCalledTimes(2); // 2ヶ月分のデータ
    });

    it('should perform initial data fetch in auto mode if directory does not exist', async () => {
        mockPriceRepository.checkStockPriceDirectoryExists.mockResolvedValue(false); // ディレクトリが存在しない
        mockCliArgsService.parse.mockReturnValue({ codes: ['1234'], startDate: null, endDate: null });

        await service.execute(['node', 'script.ts', '--codes', '1234']);

        expect(mockPriceRepository.checkStockPriceDirectoryExists).toHaveBeenCalledWith('1234');
        expect(mockYahooFinanceClient.getQuote).toHaveBeenCalledWith('1234.T');
        expect(mockYahooFinanceClient.getHistoricalData).toHaveBeenCalledWith('1234.T', expect.any(Object));
        expect(mockPriceRepository.writeMonthParquetFile).toHaveBeenCalledTimes(2); // dummyHistoricalDataが2ヶ月分なので
    });

    it('should perform differential update in auto mode if directory exists', async () => {
        mockPriceRepository.checkStockPriceDirectoryExists.mockResolvedValue(true); // ディレクトリが存在する
        mockCliArgsService.parse.mockReturnValue({ codes: ['1234'], startDate: null, endDate: null });

        // Mock returning data for a single month to align with expectation of 1 file write
        mockYahooFinanceClient.getHistoricalData.mockResolvedValue([
            { date: new Date('2023-01-01'), open: 100, high: 110, low: 90, close: 105, adjClose: 105, volume: 1000 }
        ]);

        await service.execute(['node', 'script.ts', '--codes', '1234']);

        expect(mockPriceRepository.checkStockPriceDirectoryExists).toHaveBeenCalledWith('1234');
        expect(mockYahooFinanceClient.getQuote).not.toHaveBeenCalled(); // 初回取得ではないので呼ばれない
        expect(mockYahooFinanceClient.getHistoricalData).toHaveBeenCalledWith('1234.T', expect.objectContaining({ interval: '1d' }));
        expect(mockPriceRepository.writeMonthParquetFile).toHaveBeenCalledTimes(1); // 当月分のみ
    });

    it('should skip stock if historical data fetch fails', async () => {
        mockYahooFinanceClient.getHistoricalData.mockRejectedValueOnce(new Error('API error'));
        mockCliArgsService.parse.mockReturnValue({ codes: ['1234'], startDate: null, endDate: null });

        await service.execute(['node', 'script.ts', '--codes', '1234']);

        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not process data for 1234.T'));
        expect(mockPriceRepository.writeMonthParquetFile).not.toHaveBeenCalled();
    });

    it('should skip stock if quote fetch fails during initial fetch', async () => {
        mockPriceRepository.checkStockPriceDirectoryExists.mockResolvedValue(false); // ディレクトリが存在しない
        mockYahooFinanceClient.getQuote.mockRejectedValueOnce(new Error('Quote API error'));
        mockCliArgsService.parse.mockReturnValue({ codes: ['1234'], startDate: null, endDate: null });

        await service.execute(['node', 'script.ts', '--codes', '1234']);

        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not process data for 1234.T'));
        expect(mockYahooFinanceClient.getHistoricalData).not.toHaveBeenCalled();
        expect(mockPriceRepository.writeMonthParquetFile).not.toHaveBeenCalled();
    });

    it('should handle no historical data for specified period', async () => {
        mockCliArgsService.parse.mockReturnValue({ codes: ['1234'], startDate: new Date('2024-01-01'), endDate: new Date('2024-01-31') });
        mockYahooFinanceClient.getHistoricalData.mockResolvedValueOnce([]); // データなし

        await service.execute(['node', 'script.ts', '--codes', '1234', '--start-date', '2024-01-01']);

        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('No data found for the specified period.'));
        expect(mockPriceRepository.writeMonthParquetFile).not.toHaveBeenCalled();
    });

    it('should handle no new data for current month in differential update', async () => {
        mockPriceRepository.checkStockPriceDirectoryExists.mockResolvedValue(true); // ディレクトリが存在する
        mockCliArgsService.parse.mockReturnValue({ codes: ['1234'], startDate: null, endDate: null });
        mockYahooFinanceClient.getHistoricalData.mockResolvedValueOnce([]); // データなし

        await service.execute(['node', 'script.ts', '--codes', '1234']);

        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('No new data for the current month.'));
        expect(mockPriceRepository.writeMonthParquetFile).not.toHaveBeenCalled();
    });
});
