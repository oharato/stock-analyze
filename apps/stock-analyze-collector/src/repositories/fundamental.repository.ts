import pkg from 'parquetjs';
const { ParquetSchema, ParquetWriter } = pkg;
import * as fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LoggerService } from '../services/logger.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..', '..', '..', '..');
const BASE_DIR = path.join(PROJECT_ROOT, 'data', 'processed', 'fundamentals');

export class FundamentalRepository {
  constructor(private readonly logger: LoggerService) {}

  public doesDataExist(code: string): boolean {
    const filePath = path.join(BASE_DIR, `code=${code}`, 'fundamentals.parquet');
    return fs.existsSync(filePath);
  }

  public async save(mergedData: Map<string, any[]>): Promise<void> {
    if (mergedData.size === 0) {
      this.logger.info('No merged data to save.');
      return;
    }

    // 最初の企業の最初の年度データからスキーマを推測
    const firstCompanyData = mergedData.values().next().value;
    if (!firstCompanyData || firstCompanyData.length === 0) {
      this.logger.info('No data available to create schema. Skipping save.');
      return;
    }
    const schema = this.createSchema(firstCompanyData[0]);

    for (const [code, yearlyData] of mergedData.entries()) {
      if (yearlyData.length === 0) continue;

      const dir = path.join(BASE_DIR, `code=${code}`);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const filePath = path.join(dir, 'fundamentals.parquet');
      const writer = await ParquetWriter.openFile(schema, filePath);

      for (const row of yearlyData) {
        await writer.appendRow(row);
      }

      await writer.close();
    }
    this.logger.info(`Saved fundamental data for ${mergedData.size} companies to ${BASE_DIR}`);
  }

  private createSchema(data: any): InstanceType<typeof ParquetSchema> {
    const schemaDef: { [key: string]: { type: 'DOUBLE' | 'UTF8'; optional?: boolean } } = {};
    for (const key in data) {
      const value = data[key];
      if (typeof value === 'number') {
        schemaDef[key] = { type: 'DOUBLE', optional: true };
      } else {
        schemaDef[key] = { type: 'UTF8', optional: true };
      }
    }
    return new ParquetSchema(schemaDef);
  }
}