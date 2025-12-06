import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'parquetjs';
const { ParquetSchema, ParquetWriter } = pkg;
import { Price } from 'stock-analyze-domain';
import { LoggerService } from '../services/logger.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_BASE_DIR = path.join(__dirname, '..', '..', '..', '..', 'data', 'processed', 'prices');

const schema = new ParquetSchema({
  date: { type: 'INT64', convertedType: 'TIMESTAMP_MILLIS' } as any,
  code: { type: 'UTF8' },
  open: { type: 'DOUBLE' },
  high: { type: 'DOUBLE' },
  low: { type: 'DOUBLE' },
  close: { type: 'DOUBLE' },
  adjClose: { type: 'DOUBLE', optional: true },
  volume: { type: 'INT64' },
});

export class PriceRepository {
  constructor(private readonly logger: LoggerService) {}

  public async writeMonthParquetFile(code: string, year: number, month: number, data: Price[]): Promise<void> {
    const outputDir = path.join(OUTPUT_BASE_DIR, `code=${code}`);
    const outputPath = path.join(outputDir, `${year}-${String(month).padStart(2, '0')}.parquet`);

    await fs.mkdir(outputDir, { recursive: true });

    const writer = await ParquetWriter.openFile(schema, outputPath);
    for (const row of data) {
      if (row.volume === null || row.volume === undefined) continue;

      const rowData: any = {
        date: row.date.getTime(),
        code: row.code,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: BigInt(row.volume) as any,
      };

      if (row.adjClose !== null && row.adjClose !== undefined) {
        rowData.adjClose = row.adjClose;
      }

      await writer.appendRow(rowData);
    }
    await writer.close();
    this.logger.info(`Successfully wrote/overwrote ${outputPath}`);
  }

  public async checkStockPriceDirectoryExists(code: string): Promise<boolean> {
    const outputDir = path.join(OUTPUT_BASE_DIR, `code=${code}`);
    try {
      await fs.access(outputDir);
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }
}
