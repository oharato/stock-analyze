import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { LoggerService } from '../services/logger.service.js';
// Dynamic import or default import workaround handled inside methods or at top level if purely supported
// Using the pattern established in other files:
import parquetjs from 'parquetjs';
const { ParquetWriter, ParquetReader } = parquetjs;
import { RAW_DATA_SCHEMA } from '../utils/schema-definitions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..', '..', '..', '..');
const BASE_DIR = path.join(PROJECT_ROOT, 'data', 'raw', 'fundamentals');

export class RawJsonRepository {
  constructor(private readonly logger: LoggerService) { }

  public fileExists(yearCode: string, fileName: string): boolean {
    const filePath = path.join(BASE_DIR, yearCode, fileName);
    return fs.existsSync(filePath);
  }

  public async load(yearCode: string, fileName: string): Promise<any | null> {
    const filePath = path.join(BASE_DIR, yearCode, fileName);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    try {
      // Check extension to decide reading method (backward compatibility if needed, but user said delete old json)
      // Assuming new files are .parquet
      if (fileName.endsWith('.parquet')) {
        const reader = await ParquetReader.openFile(filePath);
        const cursor = reader.getCursor();
        const record = await cursor.next();
        await reader.close();

        if (record && record.content) {
          return JSON.parse(record.content as string);
        }
        return null;
      } else {
        // Fallback for json if any
        const content = await fs.promises.readFile(filePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      this.logger.error(`Failed to load ${filePath}: ${error}`);
      return null;
    }
  }

  public async save(yearCode: string, fileName: string, data: any): Promise<void> {
    const dir = path.join(BASE_DIR, yearCode);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, fileName);

    // Convert to Parquet
    if (fileName.endsWith('.parquet')) {
      const writer = await ParquetWriter.openFile(RAW_DATA_SCHEMA, filePath);
      try {
        await writer.appendRow({ content: JSON.stringify(data) });
      } finally {
        await writer.close();
      }
      this.logger.info(`Saved raw Parquet to ${filePath}`);
    } else {
      // Fallback for json extension
      await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
      this.logger.info(`Saved raw JSON to ${filePath}`);
    }
  }
}