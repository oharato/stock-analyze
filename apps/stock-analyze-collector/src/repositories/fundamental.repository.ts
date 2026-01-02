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
import { FUNDAMENTAL_SCHEMA } from '../utils/schema-definitions.js';

export class FundamentalRepository {
  constructor(private readonly logger: LoggerService) { }

  public doesDataExist(code: string): boolean {
    const filePath = path.join(BASE_DIR, `code=${code}`, 'fundamentals.parquet');
    return fs.existsSync(filePath);
  }

  public async save(mergedData: Map<string, any[]>): Promise<void> {
    if (mergedData.size === 0) {
      this.logger.info('No merged data to save.');
      return;
    }

    const schema = FUNDAMENTAL_SCHEMA;
    // const schemaFields = schema.schema; // Not needed if we trust the static schema

    for (const [code, yearlyData] of mergedData.entries()) {
      if (yearlyData.length === 0) continue;

      const dir = path.join(BASE_DIR, `code=${code}`);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const filePath = path.join(dir, 'fundamentals.parquet');
      const writer = await ParquetWriter.openFile(schema, filePath);

      for (const row of yearlyData) {
        const cleanRow: any = {};
        for (const [key, value] of Object.entries(row)) {
          // 一般的に '-' はデータなしとして扱う
          if (value === '-') {
            cleanRow[key] = undefined;
          } else {
            cleanRow[key] = value;
          }
        }
        await writer.appendRow(cleanRow);
      }

      await writer.close();
    }
    this.logger.info(`Saved fundamental data for ${mergedData.size} companies to ${BASE_DIR}`);
  }

}