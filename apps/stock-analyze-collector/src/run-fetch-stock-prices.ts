import { YahooFinanceClient } from './clients/yahoo-finance.client.js';
import { StockRepository } from './repositories/stock.repository.js';
import { PriceRepository } from './repositories/price.repository.js';
import { CliArgsService } from './services/cli-args.service.js';
import { FetchStockPricesUsecase } from './usecases/fetch-stock-prices.usecase.js';
import { LoggerService } from './services/logger.service.js';

async function main() {
  const logger = new LoggerService();
  const yahooFinanceClient = new YahooFinanceClient();
  const stockRepository = new StockRepository(logger);
  const priceRepository = new PriceRepository(logger);
  const cliArgsService = new CliArgsService();

  const usecase = new FetchStockPricesUsecase(
    yahooFinanceClient,
    stockRepository,
    priceRepository,
    cliArgsService,
    logger
  );

  try {
    await usecase.execute(process.argv);
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
