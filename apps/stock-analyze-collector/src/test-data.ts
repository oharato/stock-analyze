import { YahooFinanceClient } from './clients/yahoo-finance.client.js';
import { LoggerService } from './services/logger.service.js';

async function main() {
  const logger = new LoggerService();
  const client = new YahooFinanceClient({ minIntervalMs: 100 }, logger);
  
  try {
      const data = await client.getHistoricalData('2031.T', { period1: new Date('2022-01-01'), interval: '1d' });
      
      const y2023 = data.filter(r => r.dateString.startsWith('2023'));
      const y2024 = data.filter(r => r.dateString.startsWith('2024'));
      const y2025 = data.filter(r => r.dateString.startsWith('2025'));
      
      console.log(`Initial records for 2023: ${y2023.length}`);
      console.log(`Initial records for 2024: ${y2024.length}`);
      console.log(`Initial records for 2025: ${y2025.length}`);

      const valid2023 = y2023.filter(r => r.close !== null && r.close !== undefined);
      const valid2024 = y2024.filter(r => r.close !== null && r.close !== undefined);
      const valid2025 = y2025.filter(r => r.close !== null && r.close !== undefined);

      console.log(`Valid records (with close price) for 2023: ${valid2023.length}`);
      console.log(`Valid records (with close price) for 2024: ${valid2024.length}`);
      console.log(`Valid records (with close price) for 2025: ${valid2025.length}`);

  } catch (err: any) {
      console.error(err);
  }
}
main();
