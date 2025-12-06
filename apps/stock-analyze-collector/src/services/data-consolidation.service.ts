import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import * as path from 'path';
import { LoggerService } from './logger.service.js';

export class DataConsolidationService {
    private conn: DuckDBConnection | null = null;
    private instance: DuckDBInstance | null = null;

    constructor(
        private readonly logger: LoggerService,
        private readonly dbPath: string,
        private readonly dataDir: string
    ) { }

    /**
     * データベース接続を初期化します
     */
    async init(): Promise<void> {
        this.instance = await DuckDBInstance.create(this.dbPath);
        this.conn = await this.instance.connect();

        this.logger.info('Setting memory limit...');
        await this.conn.run("PRAGMA memory_limit='4GB';");
    }

    /**
     * 全てのデータを統合します
     */
    async execute(): Promise<void> {
        if (!this.conn) {
            await this.init();
        }

        try {
            await this.consolidateStockList();
            await this.consolidatePrices();
            await this.consolidateFundamentals();
        } finally {
            // 接続のクローズ処理があればここで行う（現状node-apiは明示的なcloseが必須ではない場合もあるが、実装依存）
        }
    }

    /**
     * 株価データを統合します
     * 日次更新を考慮し、全てのParquetファイルを読み込んでコード・日付順にソートしてテーブルを再作成します。
     * (差分更新よりも、クエリパフォーマンス("Sort by Code, Date")を優先し、常に最適な並び順を維持するため再作成を選択)
     */
    private async consolidatePrices(): Promise<void> {
        this.logger.info('Consolidating prices table...');
        const processedDir = path.join(this.dataDir, 'processed');
        const pricesPathQuery = path.join(processedDir, 'prices/**/*.parquet');

        // datef: date(timestamp) -> DATE型
        // code: filenameから抽出
        // ORDER BY code, datef: クエリパフォーマンス向上のためソート
        const query = `
      CREATE OR REPLACE TABLE prices AS
      SELECT 
        *, 
        cast(to_timestamp(date/1000) as date) as datef, 
        regexp_extract(filename, 'code=([0-9]+)', 1) AS code 
      FROM read_parquet('${pricesPathQuery}', filename=true)
      ORDER BY code, datef;
    `;

        await this.conn!.run(query);
        this.logger.info('Prices table created and sorted by code and date.');
    }

    /**
     * 財務データを統合します
     */
    private async consolidateFundamentals(): Promise<void> {
        this.logger.info('Consolidating fundamentals table...');
        const processedDir = path.join(this.dataDir, 'processed');
        const fundamentalsPathQuery = path.join(processedDir, 'fundamentals/**/*.parquet');

        // try-catchでファイルが存在しない場合をハンドリングすることも可能だが、
        // read_parquetはファイルがないとエラーになるため、バッチとしてはエラーで落とすのが安全
        const query = `
      CREATE OR REPLACE TABLE fundamentals AS 
      SELECT 
        *, 
        regexp_extract(filename, 'code=([0-9]+)', 1) AS code 
      FROM read_parquet('${fundamentalsPathQuery}', filename=true)
      ORDER BY code;
    `;

        await this.conn!.run(query);
        this.logger.info('Fundamentals table created and sorted by code.');
    }

    /**
     * 企業マスタデータを統合します
     */
    private async consolidateStockList(): Promise<void> {
        this.logger.info('Consolidating companies table...');
        const stockListPath = path.join(this.dataDir, 'master/stock_list.json');

        const query = `
      CREATE OR REPLACE TABLE companies AS 
      SELECT * 
      FROM read_json_auto('${stockListPath}');
    `;

        await this.conn!.run(query);
        this.logger.info('Companies table created.');
    }
}
