/**
 * IR BANKから最新の財務情報を取得し、保存するバッチスクリプト
 */
import { LoggerService } from './services/logger.service.js';
import { StockRepository } from './repositories/stock.repository.js';
import { FundamentalRepository } from './repositories/fundamental.repository.js';
import { IrbankClient } from './clients/irbank.client.js';
import { MockIrbankClient } from './clients/mock-irbank.client.js';
import { IIrbankClient } from './clients/irbank.client.interface.js';
import { FetchFundamentalsService } from './services/fetch-fundamentals.service.js';
import { RawJsonRepository } from './repositories/raw-json.repository.js';
import * as dotenv from 'dotenv';

dotenv.config();

const logger = new LoggerService();

async function main() {
  logger.info('--- Start Batch: Fetch Latest Fundamentals ---');

  const useMock = process.env.USE_MOCK === 'true';

  let irbankClient: IIrbankClient;
  let sleepDuration: number;

  if (useMock) {
    logger.info('Using MockIrbankClient');
    irbankClient = new MockIrbankClient(logger);
    sleepDuration = 0; // 1 second for mock
  } else {
    logger.info('Using IrbankClient');
    irbankClient = new IrbankClient(logger);
    sleepDuration = 30000; // 30 seconds for real API
  }

  const stockRepository = new StockRepository(logger);
  const fundamentalRepository = new FundamentalRepository(logger);
  const rawJsonRepository = new RawJsonRepository(logger);

  const service = new FetchFundamentalsService(
    irbankClient,
    stockRepository,
    fundamentalRepository,
    rawJsonRepository,
    logger,
    sleepDuration,
    ['0000'],
  );

  logger.info('Starting to fetch latest fundamentals data...');
  await service.execute();
  logger.info('Finished fetching latest fundamentals data.');

  logger.info('--- End Batch: Successfully finished ---');
}

main().catch((error) => {
  logger.error(`Batch failed: ${error?.message || error}`);
  if (error?.stack) {
    logger.error(`Stack trace: ${error.stack}`);
  }
  process.exit(1);
});
