import { PriceRepository } from './src/repositories/price.repository.js';
import { YahooFinanceClient } from './src/clients/yahoo-finance.client.js';
import { LoggerService } from './src/services/logger.service.js';

async function main() {
  const logger = new LoggerService();
  const client = new YahooFinanceClient({ minIntervalMs: 100 }, logger);
  const repo = new PriceRepository(logger);
  
  try {
      const data = await client.getHistoricalData('2031.T', { period1: new Date('1950-01-01'), interval: '1d' });
      
      const dataWithCode = data.map(row => ({ ...row, code: '2031' }));
      await repo.writeParquetFile('2031', dataWithCode);
      console.log('Success!');
  } catch (err: any) {
      console.error('Caught error:', err);
      console.error('Error message:', err.message);
  }
}
main();
