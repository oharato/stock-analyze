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
        await this.conn.run("PRAGMA memory_limit='10GB';");
    }

    /**
     * 全てのデータを統合します
     */
    async execute(): Promise<void> {
        if (!this.conn) {
            await this.init();
        }

        try {
            // await this.consolidateStockList();
            // await this.consolidatePrices();
            await this.consolidateFundamentals();
            await this.consolidateEdinet();
        } finally {
            // 接続のクローズ処理があればここで行う
        }
    }

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
        const processedCodes = new Set<string>();

        // @duckdb/node-api の streamReader を使って結果を取得する。
        // check table existence first for safety in case of first run empty
        try {
            const reader = await this.conn!.runAndRead(`SELECT key FROM consolidation_state WHERE category = 'prices'`);
            const rows = await reader.getRows();
            for (const row of rows) {
                processedCodes.add(String(row[0]));
            }
        } catch (e) { /* ignore if table empty or issue */ }

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

        const BATCH_SIZE = 50;
        let processedCount = 0;
        const totalCount = dirs.length;

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
                this.logger.info(`Processed ${processedCount}/${pendingCodes.length}`);

            } catch (error: any) {
                this.logger.error('Error processing batch', { error: error.message });
                // Don't throw, try next batch? or throw critical?
                // Throwing to stop is probably safer for now
                throw error;
            }
        }

        this.logger.info('Prices table consolidation completed.');
    }

    /**
     * 財務データを統合します
     */
    private async consolidateFundamentals(): Promise<void> {
        this.logger.info('Consolidating fundamentals table...');
        const processedDir = path.join(this.dataDir, 'processed');
        const fundamentalsPathQuery = path.join(processedDir, 'fundamentals/**/*.parquet');

        const query = `
      CREATE OR REPLACE TABLE fundamentals AS 
      SELECT 
        *, 
        regexp_extract(filename, 'code=([0-9]+)', 1) AS code 
      FROM read_parquet('${fundamentalsPathQuery}', filename=true)
      ORDER BY code;
    `;

        try {
            await this.conn!.run(query);
            this.logger.info('Fundamentals table created and sorted by code.');
        } catch (e: any) {
            this.logger.warn(`Failed to create fundamentals table: ${e.message}`);
        }
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

        try {
            await this.conn!.run(query);
            this.logger.info('Companies table created.');
        } catch (e: any) {
            this.logger.warn(`Failed to create companies table: ${e.message}`);
        }
    }

    /**
     * EDINETデータを統合します
     */
    private async consolidateEdinet(): Promise<void> {
        this.logger.info('Consolidating edinet table...');
        const edinetDir = path.join(this.dataDir, 'raw/edinet');

        let subdirs: string[] = [];
        try {
            // Get subdirectories (1, 2, ..., 9, etc.)
            const entries = await fs.readdir(edinetDir, { withFileTypes: true });
            subdirs = entries
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
        } catch (error) {
            this.logger.warn(`Edinet directory not found or empty: ${edinetDir}`);
            return;
        }

        if (subdirs.length === 0) {
            this.logger.warn('No edinet subdirectories found.');
            return;
        }

        this.logger.info(`Found ${subdirs.length} subdirectories to process.`);

        // Drop existing table to start fresh (or could use incremental logic if needed later)
        await this.conn!.run('DROP TABLE IF EXISTS edinet');

        let createdTable = false;

        for (const subdir of subdirs) {
            const subdirPath = path.join(edinetDir, subdir);
            const pattern = path.join(subdirPath, '*.json');

            this.logger.info(`Processing subdirectory: ${subdir}`);

            // Explicitly define columns to handle missing keys in JSON (e.g. net_sales for banks)
            // and ensure correct types.
            const columnsDef = {
                ticker: 'VARCHAR',
                year: 'BIGINT',
                date: 'VARCHAR',
                docId: 'VARCHAR',

                business_risks: 'VARCHAR',
                business_risks_vector: 'DOUBLE[]',
                mda: 'VARCHAR',
                mda_vector: 'DOUBLE[]',
                corporate_governance: 'VARCHAR',
                corporate_governance_vector: 'DOUBLE[]',
                research_and_development: 'VARCHAR',
                research_and_development_vector: 'DOUBLE[]',

                net_sales: 'DOUBLE',
                operating_income: 'DOUBLE',
                ordinary_income: 'DOUBLE',
                net_income: 'DOUBLE',
                net_assets: 'DOUBLE',
                total_assets: 'DOUBLE',
                earnings_per_share: 'DOUBLE',
                book_value_per_share: 'DOUBLE',
                equity_to_total_assets_ratio: 'DOUBLE',
                rate_of_return_on_equity: 'DOUBLE'
            };

            // Format columns definition for SQL: {'col': 'TYPE', ...}
            const columnsStr = '{' + Object.entries(columnsDef)
                .map(([k, v]) => `'${k}': '${v}'`)
                .join(', ') + '}';

            const selectQuery = `
                SELECT 
                    ticker as code,
                    year,
                    date,
                    docId,
                    
                    business_risks,
                    business_risks_vector,
                    mda,
                    mda_vector,
                    corporate_governance,
                    corporate_governance_vector,
                    research_and_development,
                    research_and_development_vector,

                    net_sales,
                    operating_income,
                    ordinary_income,
                    net_income,
                    net_assets,
                    total_assets,
                    earnings_per_share,
                    book_value_per_share,
                    equity_to_total_assets_ratio,
                    rate_of_return_on_equity,

                    filename
                FROM read_json_auto('${pattern}', filename=true, columns=${columnsStr})
            `;

            try {
                if (!createdTable) {
                    await this.conn!.run(`CREATE TABLE edinet AS ${selectQuery}`);
                    createdTable = true;
                } else {
                    await this.conn!.run(`INSERT INTO edinet ${selectQuery}`);
                }
            } catch (e: any) {
                // If it fails, log and continue
                this.logger.warn(`Failed to process subdir ${subdir}: ${e.message}`);
            }
        }

        this.logger.info('Edinet table consolidation completed.');
    }
}
