import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import * as path from 'path';
import * as fs from 'fs/promises';
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
            // await this.consolidateFundamentals();
            await this.consolidateEdinet();
        } finally {
            // 接続のクローズ処理があればここで行う（現状node-apiは明示的なcloseが必須ではない場合もあるが、実装依存）
        }
    }

    /**
     * 株価データを統合します
     * 日次更新を考慮し、全てのParquetファイルを読み込んでコード・日付順にソートしてテーブルを再作成します。
     * (差分更新よりも、クエリパフォーマンス("Sort by Code, Date")を優先し、常に最適な並び順を維持するため再作成を選択)
     */
    /**
     * 株価データを統合します (増分処理対応)
     */
    private async consolidatePrices(): Promise<void> {
        this.logger.info('Consolidating prices table...');
        const processedDir = path.join(this.dataDir, 'processed');
        const pricesDir = path.join(processedDir, 'prices');

        // 1. Create consolidation_state table if not exists
        await this.conn!.run(`
            CREATE TABLE IF NOT EXISTS consolidation_state (
                category VARCHAR,
                key VARCHAR,
                updated_at TIMESTAMP,
                PRIMARY KEY (category, key)
            );
        `);

        // 2. Load processed codes to resume

        const result = await this.conn!.run(`
            SELECT key FROM consolidation_state WHERE category = 'prices';
        `);
        const processedCodes = new Set<string>();

        // Get all stock codes from directory names


        // ディレクトリ一覧から全コードを取得
        let dirs: string[] = [];
        try {
            const entries = await fs.readdir(pricesDir, { withFileTypes: true });
            dirs = entries
                .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('code='))
                .map(dirent => dirent.name);
        } catch (error) {
            this.logger.warn('Prices directory not found or empty.');
            return;
        }

        this.logger.info(`Found ${dirs.length} stock directories.`);

        // バッチサイズ
        const BATCH_SIZE = 50;
        let processedCount = 0;
        const totalCount = dirs.length;

        // Get processed codes from DB


        // @duckdb/node-api の streamReader を使って結果を取得する。
        const reader = await this.conn!.runAndRead(`SELECT key FROM consolidation_state WHERE category = 'prices'`);
        const rows = await reader.getRows();
        for (const row of rows) {
            // row is [(string)], assuming key is the first column
            processedCodes.add(String(row[0]));
        }

        const pendingCodes = dirs.filter(dir => {
            const code = dir.replace('code=', '');
            return !processedCodes.has(code);
        });

        this.logger.info(`Pending codes: ${pendingCodes.length}/${totalCount}`);

        if (pendingCodes.length === 0) {
            this.logger.info('All prices already consolidated.');
            return;
        }

        // chunks に分割
        for (let i = 0; i < pendingCodes.length; i += BATCH_SIZE) {
            const chunk = pendingCodes.slice(i, i + BATCH_SIZE);
            const chunkCodes = chunk.map(dir => dir.replace('code=', ''));

            // Construct query

            const fileGlobs = chunk.map(dir => path.join(pricesDir, dir, '**/*.parquet'));
            const fileListStr = fileGlobs.map(g => `'${g}'`).join(', ');

            // Check if table exists to decide between CREATE and INSERT

            let tableExists = false;
            try {
                await this.conn!.run('SELECT 1 FROM prices LIMIT 1');
                tableExists = true;
            } catch (e) {
                tableExists = false;
            }

            // クエリ生成
            const selectClause = `
                SELECT 
                    *, 
                    cast(to_timestamp(date/1000) as date) as datef, 
                    regexp_extract(filename, 'code=([0-9]+)', 1) AS code 
                FROM read_parquet([${fileListStr}], filename=true)
            `;

            let query = '';
            if (!tableExists) {
                // Create table if not exists (sort by code, datef)
                query = `CREATE TABLE prices AS ${selectClause} ORDER BY code, datef`;
            } else {
                query = `INSERT INTO prices ${selectClause}`;
            }

            try {
                await this.conn!.run(query);

                // Update state and checkpoint
                const values = chunkCodes.map(c => `('prices', '${c}', current_timestamp)`).join(', ');
                await this.conn!.run(`INSERT OR IGNORE INTO consolidation_state VALUES ${values}`);
                await this.conn!.run('CHECKPOINT');

                processedCount += chunk.length;
                this.logger.info(`Processed ${processedCount}/${pendingCodes.length} (Total progress: ${processedCodes.size + processedCount}/${totalCount})`);

            } catch (error: any) {
                this.logger.error('Error processing batch', { error: error.message });
                throw error;
            }
        }

        this.logger.info('Prices table consolidation completed.');
    }

    /**
     * 財務データを統合します
     */
    /**
     * 財務データを統合します
     */
    private async consolidateFundamentals(): Promise<void> {
        this.logger.info('Consolidating fundamentals table...');
        const processedDir = path.join(this.dataDir, 'processed');
        // NOTE: fundamentalsも同様に増分処理が可能だが、データ量がpricesほどではないと想定し、今回は現状維持とする
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

    /**
     * EDINETデータを統合します
     */
    private async consolidateEdinet(): Promise<void> {
        this.logger.info('Consolidating edinet table...');
        const edinetDir = path.join(this.dataDir, 'raw/edinet');
        // EDINETデータは raw/edinet 配下に保存される想定
        // ファイル名やディレクトリ構造に依存するが、ここでは一旦すべてのJSONを読み込む
        // 必要に応じてファイル名のパターンなどを調整する
        const edinetPathQuery = path.join(edinetDir, '**/*.json');

        // ベクトル化済みJSONの構造に合わせたクエリ
        // { ticker, docId, date, year, business_risks, business_risks_vector, mda, mda_vector }
        // そのまま read_json_auto で読み込めば、vector は LIST(DOUBLE) として認識される。
        // ファイル名からではなく、JSON内のフィールドから code (ticker) や year を取得する。
        const query = `
            CREATE OR REPLACE TABLE edinet AS 
            SELECT 
                ticker as code,
                year,
                date,
                docId,
                
                -- Qualitative
                business_risks,
                business_risks_vector,
                mda,
                mda_vector,
                corporate_governance,
                corporate_governance_vector,
                research_and_development,
                research_and_development_vector,

                -- Quantitative (using camelCase from JSON)
                netSales as net_sales,
                operatingIncome as operating_income,
                ordinaryIncome as ordinary_income,
                netIncome as net_income,
                netAssets as net_assets,
                totalAssets as total_assets,
                earningsPerShare as earnings_per_share,
                bookValuePerShare as book_value_per_share,
                equityToTotalAssetsRatio as equity_to_total_assets_ratio,
                rateOfReturnOnEquity as rate_of_return_on_equity,

                filename
            FROM read_json_auto('${edinetPathQuery}', filename=true);
        `;

        try {
            await this.conn!.run(query);
            this.logger.info('Edinet table created with vectors.');
        } catch (e: any) {
            // ファイルがない場合などはエラーになるので警告に留める
            this.logger.warn(`Failed to create edinet table (maybe no files found): ${e.message}`);
        }
    }
}
