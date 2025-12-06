import { LoggerService } from './services/logger.service.js';
import { StockRepository } from './repositories/stock.repository.js';
import { FundamentalRepository } from './repositories/fundamental_repository.js';
import { IrbankClient } from './clients/irbank_client.js';
import { MockIrbankClient } from './clients/mock_irbank_client.js';
import { IIrbankClient } from './clients/irbank_client.interface.js';
import { FetchHistoricalFundamentalsUsecase } from './usecases/fetch-historical-fundamentals.usecase.js';
import { RawJsonRepository } from './repositories/raw_json_repository.js';
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

  const usecase = new FetchHistoricalFundamentalsUsecase(
    irbankClient,
    stockRepository,
    fundamentalRepository,
    rawJsonRepository,
    logger,
    sleepDuration,
    ['0000'],
  );

  logger.info('Starting to fetch latest fundamentals data...');
  await usecase.execute();
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
