/**
 * 2010年から昨年までの過去の財務情報を取得し、保存するバッチスクリプト
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
  logger.info('--- Start Batch: Fetch Historical Fundamentals ---');

  const useMock = process.env.USE_MOCK === 'true';

  let irbankClient: IIrbankClient;
  let sleepDuration: number;

  if (useMock) {
    logger.info('Using MockIrbankClient');
    irbankClient = new MockIrbankClient(logger);
    sleepDuration = 0; // 0 seconds for mock
  } else {
    logger.info('Using IrbankClient');
    irbankClient = new IrbankClient(logger);
    sleepDuration = 300000; // 5 minutes (300 seconds) for real API
  }

  const stockRepository = new StockRepository(logger);
  const fundamentalRepository = new FundamentalRepository(logger);
  const rawJsonRepository = new RawJsonRepository(logger);

  // 2010年から現在の年-1までの年コードを生成
  const currentYear = new Date().getFullYear() - 1;
  const years = Array.from({ length: currentYear - 2010 + 1 }, (_, i) => 2010 + i);
  const pastYearCodes = years.map((year) => year.toString().slice(-2).padStart(4, '0'));

  const service = new FetchFundamentalsService(
    irbankClient,
    stockRepository,
    fundamentalRepository,
    rawJsonRepository,
    logger,
    sleepDuration,
    pastYearCodes.reverse(), // 最新から取得するために逆順にする
  );

  logger.info('Starting to fetch historical fundamentals data...');
  await service.execute();
  logger.info('Finished fetching historical fundamentals data.');

  logger.info('--- End Batch: Successfully finished ---');
}

main().catch((error) => {
  logger.error(`Batch failed: ${error?.message || error}`);
  if (error?.stack) {
    logger.error(`Stack trace: ${error.stack}`);
  }
  process.exit(1);
});
