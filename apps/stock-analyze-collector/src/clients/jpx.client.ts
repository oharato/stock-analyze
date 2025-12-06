import { LoggerService } from '../services/logger.service.js';

const DATA_URL = 'https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xls';

export async function downloadStockList(logger: LoggerService): Promise<Buffer> {
  logger.info(`Downloading stock list from ${DATA_URL}...`);
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
