import { YahooFinanceClient } from '../clients/yahoo-finance.client.js';
import { StockRepository } from '../repositories/stock.repository.js';
import { PriceRepository } from '../repositories/price.repository.js';
import { CliArgsService, CliArgs } from '../services/cli-args.service.js';
import { LoggerService } from '../services/logger.service.js';
import { Stock } from 'stock-analyze-domain';
import { Price } from 'stock-analyze-domain';

export class FetchStockPricesUsecase {
  constructor(
    private yahooFinanceClient: YahooFinanceClient,
    private stockRepository: StockRepository,
    private priceRepository: PriceRepository,
    private cliArgsService: CliArgsService,
    private logger: LoggerService
  ) {}

  public async execute(argv: string[]): Promise<void> {
    const args = this.cliArgsService.parse(argv);
    const stockList = await this.stockRepository.loadStockList();

    let stocksToProcess: Stock[];

    if (args.codes) {
      stocksToProcess = stockList.filter(stock => args.codes!.includes(stock.code));
      this.logger.info(`Processing specified stocks: ${args.codes.join(', ')}`);
    } else {
      stocksToProcess = stockList; // 全銘柄を処理
      this.logger.info(`Processing all ${stockList.length} stocks.`);
    }

    for (let i = 0; i < stocksToProcess.length; i++) {
      const stock = stocksToProcess[i];
      const code = stock.code;
      const ticker = `${code}.T`;
      
      this.logger.info(`[${i + 1}/${stocksToProcess.length}] Processing ${ticker} (${stock.name})...`);

      try {
        // --- 手動期間指定モード ---
        if (args.startDate) {
          this.logger.info(`  -> Manual mode: Fetching data from ${args.startDate.toISOString().split('T')[0]} to ${args.endDate ? args.endDate.toISOString().split('T')[0] : 'today'}.`);
          
          const period1 = args.startDate;
          const period2 = args.endDate || new Date();

          const historicalData = await this.yahooFinanceClient.getHistoricalData(ticker, { period1, period2, interval: '1d' });

          if (historicalData.length === 0) {
            this.logger.info('  -> No data found for the specified period.');
            continue;
          }

          const groupedByMonth: { [key: string]: Price[] } = {};
          for (const row of historicalData) {
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
        // --- 自動差分更新モード ---
        else {
          const dirExists = await this.priceRepository.checkStockPriceDirectoryExists(code);

          if (dirExists) {
            // 差分更新
            this.logger.info(`  -> Auto mode: Directory exists. Updating current month data...`);
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            const period1 = new Date(year, now.getMonth(), 1);

            const monthlyData = await this.yahooFinanceClient.getHistoricalData(ticker, { period1, period2: now, interval: '1d' });
            
            if (monthlyData.length > 0) {
              const dataWithCode = monthlyData.map((d: any) => ({...d, code}));
              await this.priceRepository.writeMonthParquetFile(code, year, month, dataWithCode);
            } else {
              this.logger.info(`  -> No new data for the current month.`);
            }
          } else {
            // 初回取得
            this.logger.info(`  -> Auto mode: First time fetching. Getting all historical data...`);
            const quote = await this.yahooFinanceClient.getQuote(ticker);
            const startDate = quote?.firstTradeDateMilliseconds ? new Date(quote.firstTradeDateMilliseconds) : new Date('1980-01-01');
            
            const allData = await this.yahooFinanceClient.getHistoricalData(ticker, { period1: startDate, period2: new Date(), interval: '1d' });

            const groupedByMonth: { [key: string]: Price[] } = {};
            for (const row of allData) {
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
      } catch (err: any) {
        this.logger.warn(`  -> Could not process data for ${ticker}. Skipping. Error: ${err.message}`);
      } finally {
        await this.yahooFinanceClient.sleep(2000);
      }
    }

    this.logger.info(`
Stock price fetching complete.`);
  }
}
