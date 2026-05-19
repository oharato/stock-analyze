/**
 * Yahoo Financeから株価データを取得し、Parquetファイルとして保存するバッチスクリプト
 */
import { YahooFinanceClient } from './clients/yahoo-finance.client.js';
import { StockRepository } from './repositories/stock.repository.js';
import { PriceRepository } from './repositories/price.repository.js';
import { CliArgsService } from './services/cli-args.service.js';
import { FetchStockPricesService } from './services/fetch-stock-prices.service.js';
import { LoggerService } from './services/logger.service.js';

async function main() {
  const logger = new LoggerService();
  // 2 seconds delay
  const yahooFinanceClient = new YahooFinanceClient({ minIntervalMs: 2000 }, logger);
  const stockRepository = new StockRepository(logger);
  const priceRepository = new PriceRepository(logger);
  const cliArgsService = new CliArgsService();

  const service = new FetchStockPricesService(
    yahooFinanceClient,
    stockRepository,
    priceRepository,
    cliArgsService,
    logger
  );

  try {
    await service.execute(process.argv);
    process.exit(0);
  } catch (error) {
    console.error('Batch process failed:');
    console.error(error);
    logger.error('Batch process failed', { error: error instanceof Error ? error.message : String(error) });
    if (error instanceof Error && error.stack) {
      logger.error('Stack trace:', { stack: error.stack });
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error in main:');
  console.error(error);
  process.exit(1);
});
