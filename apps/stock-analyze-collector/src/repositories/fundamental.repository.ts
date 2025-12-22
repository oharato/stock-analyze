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
    const schemaFields = schema.schema;

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

  private inferSchema(mergedData: Map<string, any[]>): InstanceType<typeof ParquetSchema> {
    const fieldTypes: { [key: string]: 'DOUBLE' | 'UTF8' } = {};
    const params: { [key: string]: { type: 'DOUBLE' | 'UTF8'; optional: boolean } } = {};

    // 全データをスキャンしてフィールドと型を特定
    for (const yearlyData of mergedData.values()) {
      for (const row of yearlyData) {
        for (const [key, value] of Object.entries(row)) {
          // すでにDOUBLEと決定している場合はスキップ
          if (fieldTypes[key] === 'DOUBLE') continue;

          if (typeof value === 'number') {
            fieldTypes[key] = 'DOUBLE';
          } else if (typeof value === 'string') {
            // '-' は型決定においては無視（数値カラムに入っている可能性があるため）
            if (value === '-') continue;

            // それ以外の文字列ならUTF8
            if (!fieldTypes[key]) {
              fieldTypes[key] = 'UTF8';
            }
          }
        }
      }
    }

    // スキーマ定義を作成
    for (const [key, type] of Object.entries(fieldTypes)) {
      params[key] = { type, optional: true };
    }

    // まだ型が決まっていない（全てnullまた'-'など）フィールドがあればUTF8にする
    // 実際にデータにある全キーを網羅するため、もう一度スキャンが必要か、
    // あるいは上のループで全てのキーを少なくとも undefined で登録しておくべきか。
    // ここではシンプルに、上のループで見つかったキーのみを対象としている。
    // もし全ての行でそのキーが '-' だった場合、fieldTypes[key] は undefined になる。

    // 全キーを収集
    const allKeys = new Set<string>();
    for (const yearlyData of mergedData.values()) {
      for (const row of yearlyData) {
        Object.keys(row).forEach(k => allKeys.add(k));
      }
    }

    for (const key of allKeys) {
      if (!params[key]) {
        // デフォルトはUTF8（DOUBLEにすると '-' ばかりの場合に混乱するかもだが、
        // 書き込み時に '-' を null にするのであれば DOUBLE でも UTF8 でも実は問題ない。
        // 安全のため UTF8 にしておく）
        params[key] = { type: 'UTF8', optional: true };
      }
    }

    return new ParquetSchema(params);
  }
}