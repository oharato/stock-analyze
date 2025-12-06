import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Stock } from 'stock-analyze-domain';
import { LoggerService } from '../services/logger.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// プロジェクトルートからの相対パスでdataディレクトリを指定
const DATA_MASTER_DIR = path.join(__dirname, '..', '..', '..', '..', 'data', 'master');
const OUTPUT_PATH = path.join(DATA_MASTER_DIR, 'stock_list.json');

export class StockRepository {
  constructor(private readonly logger: LoggerService) {}

  public async saveStockList(stockList: Stock[]): Promise<void> {
    await fs.mkdir(DATA_MASTER_DIR, { recursive: true }); // ディレクトリを再帰的に作成
    await fs.writeFile(OUTPUT_PATH, JSON.stringify(stockList, null, 2));
    this.logger.info(`Successfully saved ${stockList.length} stocks to ${OUTPUT_PATH}`);
  }

  public async loadStockList(): Promise<Stock[]> {
    try {
      const listBuffer = await fs.readFile(OUTPUT_PATH);
      return JSON.parse(listBuffer.toString());
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        this.logger.warn(`Could not load stock list from ${OUTPUT_PATH}. File not found.`);
        return [];
      } else {
        this.logger.error(`Error loading stock list from ${OUTPUT_PATH}`, { error: error.message });
        throw error; // ENOENT以外のエラーは再スロー
      }
    }
  }
}