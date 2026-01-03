import { YahooFinanceClient } from '../clients/yahoo-finance.client.js';
import { StockRepository } from '../repositories/stock.repository.js';
import { PriceRepository } from '../repositories/price.repository.js';
import { CliArgsService, CliArgs } from './cli-args.service.js';
import { LoggerService } from './logger.service.js';
import { Stock } from 'stock-analyze-domain';
import { Price } from 'stock-analyze-domain';

export class FetchStockPricesService {
    constructor(
        private yahooFinanceClient: YahooFinanceClient,
        private stockRepository: StockRepository,
        private priceRepository: PriceRepository,
        private cliArgsService: CliArgsService,
        private logger: LoggerService
    ) { }

    public async execute(argv: string[]): Promise<void> {
        const args = this.cliArgsService.parse(argv);
        const stocksToProcess = await this.getStocksToProcess(args);

        for (let i = 0; i < stocksToProcess.length; i++) {
            const stock = stocksToProcess[i];
            const ticker = `${stock.code}.T`;

            this.logger.info(`[${i + 1}/${stocksToProcess.length}] Processing ${ticker} (${stock.name})...`);

            try {
                if (args.startDate) {
                    await this.processManualMode(ticker, stock.code, args);
                } else {
                    await this.processAutoMode(ticker, stock.code);
                }
            } catch (err: any) {
                this.logger.warn(`  -> Could not process data for ${ticker}. Skipping. Error: ${err.message}`);
            }
        }

        this.logger.info('\nStock price fetching complete.');
    }

    private async getStocksToProcess(args: CliArgs): Promise<Stock[]> {
        const stockList = await this.stockRepository.loadStockList();
        if (args.codes) {
            this.logger.info(`Processing specified stocks: ${args.codes.join(', ')}`);
            return stockList.filter(stock => args.codes!.includes(stock.code));
        } else {
            this.logger.info(`Processing all ${stockList.length} stocks.`);
            return stockList;
        }
    }

    private async processManualMode(ticker: string, code: string, args: CliArgs): Promise<void> {
        this.logger.info(`  -> Manual mode: Fetching data from ${args.startDate!.toISOString().split('T')[0]} to ${args.endDate ? args.endDate.toISOString().split('T')[0] : 'today'}.`);

        const period1 = args.startDate!;
        const period2 = args.endDate || new Date();

        const historicalData = await this.yahooFinanceClient.getHistoricalData(ticker, { period1, period2, interval: '1d' });

        if (historicalData.length === 0) {
            this.logger.info('  -> No data found for the specified period.');
            return;
        }

        await this.saveHistoricalData(historicalData, code);
    }

    private async processAutoMode(ticker: string, code: string): Promise<void> {
        const dirExists = await this.priceRepository.checkStockPriceDirectoryExists(code);

        if (dirExists) {
            await this.processDifferentialUpdate(ticker, code);
        } else {
            await this.processInitialFetch(ticker, code);
        }
    }

    private async processDifferentialUpdate(ticker: string, code: string): Promise<void> {
        this.logger.info(`  -> Auto mode: Directory exists. Updating current month data...`);
        const now = new Date();
        const period1 = new Date(now.getFullYear(), now.getMonth(), 1);

        const monthlyData = await this.yahooFinanceClient.getHistoricalData(ticker, { period1, period2: now, interval: '1d' });

        if (monthlyData.length > 0) {
            await this.saveHistoricalData(monthlyData, code);
        } else {
            this.logger.info(`  -> No new data for the current month.`);
        }
    }

    private async processInitialFetch(ticker: string, code: string): Promise<void> {
        this.logger.info(`  -> Auto mode: First time fetching. Getting all historical data...`);
        const quote = await this.yahooFinanceClient.getQuote(ticker);
        const startDate = quote?.firstTradeDateMilliseconds ? new Date(quote.firstTradeDateMilliseconds) : new Date('1980-01-01');

        const allData = await this.yahooFinanceClient.getHistoricalData(ticker, { period1: startDate, period2: new Date(), interval: '1d' });

        await this.saveHistoricalData(allData, code);
    }

    private async saveHistoricalData(data: any[], code: string): Promise<void> {
        const groupedByMonth: { [key: string]: Price[] } = {};
        for (const row of data) {
            const year = row.date.getFullYear();
            const month = row.date.getMonth() + 1;
            const key = `${year}-${String(month).padStart(2, '0')}`;
            if (!groupedByMonth[key]) groupedByMonth[key] = [];
            groupedByMonth[key].push({ ...row, code });
        }

        for (const monthKey in groupedByMonth) {
            const [yearStr, monthStr] = monthKey.split('-');
            await this.priceRepository.writeMonthParquetFile(code, parseInt(yearStr), parseInt(monthStr), groupedByMonth[monthKey]);
        }
    }
}
