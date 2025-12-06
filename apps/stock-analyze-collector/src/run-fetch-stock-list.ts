import { downloadStockList } from './clients/jpx.client.js';
import { parseStockList } from './parsers/stock-list.parser.js';
import { StockRepository } from './repositories/stock.repository.js';
import { LoggerService } from './services/logger.service.js';

async function main() {
  const logger = new LoggerService();
  const stockRepository = new StockRepository(logger);

  try {
    const excelBuffer = await downloadStockList(logger);
    const stockList = parseStockList(excelBuffer, logger);
    await stockRepository.saveStockList(stockList);

    logger.info('Stock list fetching and saving complete.');
    process.exit(0);
  } catch (error) {
    logger.error('Batch process failed', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

main();
