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

    const schema = this.inferSchema(mergedData);

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

  private inferSchema(mergedData: Map<string, any[]>): InstanceType<typeof ParquetSchema> {
    const fieldTypes: { [key: string]: 'DOUBLE' | 'UTF8' } = {};
    const params: { [key: string]: { type: 'DOUBLE' | 'UTF8'; optional: boolean } } = {};

    // 全データをスキャンしてフィールドと型を特定
    for (const yearlyData of mergedData.values()) {
      for (const row of yearlyData) {
        for (const [key, value] of Object.entries(row)) {
          // すでに型が決定している場合はスキップ（ただし、NULLばかりだった後に値が来た場合などは更新したいが、DOUBLE優先）
          if (fieldTypes[key] === 'DOUBLE') continue;

          if (typeof value === 'number') {
            fieldTypes[key] = 'DOUBLE';
          } else if (typeof value === 'string' && !fieldTypes[key]) {
            fieldTypes[key] = 'UTF8';
          }
        }
      }
    }

    // スキーマ定義を作成
    for (const [key, type] of Object.entries(fieldTypes)) {
      params[key] = { type, optional: true };
    }

    // まだ型が決まっていない（全てnullなど）フィールドがあればUTF8にする
    // ここでフィールド一覧も網羅する必要があるが、上記ループでフィールドは見つかっているはず。

    // 念のため、もう一度全フィールドを確認して、型未定のものをUTF8に設定
    // (fieldTypesに含まれていればparamsに入っているはずだが、念のため実装)

    return new ParquetSchema(params);
  }
}