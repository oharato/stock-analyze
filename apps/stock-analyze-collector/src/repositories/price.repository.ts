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
  dateString: { type: 'UTF8', optional: true },
  code: { type: 'UTF8' },
  open: { type: 'DOUBLE' },
  high: { type: 'DOUBLE' },
  low: { type: 'DOUBLE' },
  close: { type: 'DOUBLE' },
  adjClose: { type: 'DOUBLE', optional: true },
  volume: { type: 'INT64' },
});

export class PriceRepository {
  constructor(private readonly logger: LoggerService) { }

  public async writeParquetFile(code: string, data: Price[]): Promise<void> {
    const outputPath = path.join(OUTPUT_BASE_DIR, `${code}.parquet`);
    // Ensure OUTPUT_BASE_DIR exists
    await fs.mkdir(OUTPUT_BASE_DIR, { recursive: true });

    const writer = await ParquetWriter.openFile(schema, outputPath);
    for (const row of data) {
      if (row.volume === null || row.volume === undefined) continue;

      const rowData: any = {
        date: row.date.getTime(),
        dateString: row.dateString,
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


}
