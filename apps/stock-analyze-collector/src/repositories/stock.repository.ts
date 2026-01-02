import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Stock } from 'stock-analyze-domain';
import { LoggerService } from '../services/logger.service.js';
import parquetjs from 'parquetjs';
const { ParquetWriter, ParquetReader } = parquetjs;
import { STOCK_LIST_SCHEMA } from '../utils/schema-definitions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// プロジェクトルートからの相対パスでdataディレクトリを指定
const DATA_MASTER_DIR = path.join(__dirname, '..', '..', '..', '..', 'data', 'master');
const OUTPUT_PATH = path.join(DATA_MASTER_DIR, 'stock_list.parquet');

export class StockRepository {
  constructor(private readonly logger: LoggerService) { }

  public async saveStockList(stockList: Stock[]): Promise<void> {
    await fs.mkdir(DATA_MASTER_DIR, { recursive: true });

    // Delete existing file if any to avoid appending to old parquet if it existed (though openFile overwrites usually, let's be safe)
    if (fsSync.existsSync(OUTPUT_PATH)) {
      await fs.unlink(OUTPUT_PATH);
    }

    const writer = await ParquetWriter.openFile(STOCK_LIST_SCHEMA, OUTPUT_PATH);

    try {
      for (const stock of stockList) {
        await writer.appendRow(stock as any);
      }
    } finally {
      await writer.close();
    }

    this.logger.info(`Successfully saved ${stockList.length} stocks to ${OUTPUT_PATH}`);
  }

  public async loadStockList(): Promise<Stock[]> {
    if (!fsSync.existsSync(OUTPUT_PATH)) {
      this.logger.warn(`Could not load stock list from ${OUTPUT_PATH}. File not found.`);
      return [];
    }

    try {
      const reader = await ParquetReader.openFile(OUTPUT_PATH);
      const cursor = reader.getCursor();
      const stocks: Stock[] = [];

      let record: any = null;
      while (record = await cursor.next()) {
        stocks.push(record as Stock);
      }

      await reader.close();
      return stocks;
    } catch (error: any) {
      this.logger.error(`Error loading stock list from ${OUTPUT_PATH}`, { error: error.message });
      throw error;
    }
  }
}