import * as xlsx from 'xlsx';
import { Stock } from 'stock-analyze-domain';
import { LoggerService } from '../services/logger.service.js';

export function parseStockList(excelBuffer: Buffer, logger: LoggerService): Stock[] {
  logger.info('Parsing Excel file...');
  const workbook = xlsx.read(excelBuffer);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const json: any[] = xlsx.utils.sheet_to_json(worksheet);

  logger.info('Extracting stock information...');
  const stockList = json
    .map(row => ({
      code: String(row['コード']).trim(),
      name: row['銘柄名']?.trim(),
      market: row['市場・商品区分']?.trim(),
      sector33: row['33業種区分']?.trim(),
      sector17: row['17業種区分']?.trim(),
      scale: row['規模区分']?.trim(),
    }))
    .filter(stock =>
      stock.code &&
      /^\d{4}[A-Z]?$/.test(stock.code) &&
      stock.name
    );

  if (stockList.length === 0) {
    throw new Error('Could not extract any stocks. The Excel sheet format might have changed.');
  }

  return stockList;
}
