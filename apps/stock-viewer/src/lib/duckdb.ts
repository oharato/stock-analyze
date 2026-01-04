import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import * as fs from 'fs';
import * as path from 'path';

export interface DuckDBConfig {
    localPath?: string;
    readonly?: boolean;
    r2?: {
        accountId: string;
        accessKeyId: string;
        secretAccessKey: string;
        bucketName: string;
    };
}

export class DuckDBManager {
    private instance: DuckDBInstance | null = null;
    private connection: DuckDBConnection | null = null;

    constructor(private config: DuckDBConfig = {}) { }

    async getConnection(): Promise<DuckDBConnection> {
        if (this.connection) return this.connection;

        const dbPath = this.getDatabasePath();
        const isLocal = dbPath !== ':memory:';

        console.log(`[DuckDB] Opening database at: ${dbPath} (readonly: ${!!this.config.readonly})`);
        const duckdbConfig: Record<string, string> = {};
        if (this.config.readonly && dbPath !== ':memory:') {
            duckdbConfig.access_mode = 'READ_ONLY';
        }
        this.instance = await DuckDBInstance.create(dbPath, duckdbConfig);
        this.connection = await this.instance.connect();

        if (!isLocal && this.config.r2) {
            const success = await this.setupR2();
            if (!success) {
                console.warn('[DuckDB] WARNING: R2 attachment failed. Queries may fail if no local DB exists.');
            }
        }

        return this.connection;
    }

    private getDatabasePath(): string {
        if (process.env.NODE_ENV === 'test') {
            return ':memory:';
        }
        const localPath = this.config.localPath || path.resolve(process.cwd(), '../../data/stock.duckdb');
        if (fs.existsSync(localPath)) {
            return localPath;
        }
        return ':memory:';
    }

    private async setupR2(): Promise<boolean> {
        if (!this.connection || !this.config.r2) return false;

        const { accountId, accessKeyId, secretAccessKey, bucketName } = this.config.r2;

        try {
            console.log('[DuckDB] Setting up R2 via httpfs...');
            await this.connection.run('INSTALL httpfs; LOAD httpfs;');

            const r2Endpoint = `${accountId}.r2.cloudflarestorage.com`;

            await this.connection.run(`
                CREATE SECRET r2_secret (
                    TYPE S3,
                    KEY_ID '${accessKeyId.replace(/'/g, "''")}',
                    SECRET '${secretAccessKey.replace(/'/g, "''")}',
                    REGION 'auto',
                    ENDPOINT '${r2Endpoint}',
                    URL_STYLE 'path',
                    USE_SSL true
                );
            `);

            await this.connection.run(`ATTACH 's3://${bucketName}/stock.duckdb' AS stock_db (READ_ONLY);`);
            await this.connection.run('USE stock_db;');
            console.log('[DuckDB] R2 attached successfully.');
            return true;
        } catch (e) {
            console.error('[DuckDB] R2 setup failed:', e);
            return false;
        }
    }

    async runQuery<T = any>(query: string): Promise<T[]> {
        const conn = await this.getConnection();
        const result = await conn.run(query);
        return (await result.getRowObjectsJS()) as T[];
    }

    async close() {
        if (this.connection) {
            // connection does not have a close method in some versions, but instance might be needed to be cleaned up
            this.connection = null;
        }
        if (this.instance) {
            this.instance = null;
        }
    }
}
