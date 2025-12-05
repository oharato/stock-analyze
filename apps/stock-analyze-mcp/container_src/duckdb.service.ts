import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';

export interface Env {
    R2_BUCKET_NAME: string;
    CLOUDFLARE_ACCOUNT_ID: string;
    R2_ACCESS_KEY_ID: string;
    R2_SECRET_ACCESS_KEY: string;
    R2_ENDPOINT?: string;
    LOCAL_DUCKDB_PATH?: string;
}

// SQL injection prevention helpers
const escapeSql = (value: string): string => value.replace(/'/g, "''");
const isValidId = (value: string): boolean => /^[a-zA-Z0-9_-]+$/.test(value);

export class DuckDBService {
    private instance: DuckDBInstance | null = null;
    private conn: DuckDBConnection | null = null;
    private isInitialized = false;
    private initPromise: Promise<void> | null = null;

    async initialize(env: Env): Promise<void> {
        if (this.isInitialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                console.log('[DuckDB] Initializing...');

                // Create in-memory instance
                this.instance = await DuckDBInstance.create(':memory:');
                this.conn = await this.instance.connect();

                // Try local file first, fallback to R2
                if (env.LOCAL_DUCKDB_PATH) {
                    try {
                        console.log(`[DuckDB] Attaching local: ${env.LOCAL_DUCKDB_PATH}`);
                        await this.conn.run(`ATTACH '${env.LOCAL_DUCKDB_PATH}' AS stock_db (READ_ONLY);`);
                        console.log('[DuckDB] Local attached');
                    } catch (err) {
                        console.error('[DuckDB] Local attach failed:', err);
                        await this.setupR2(env);
                    }
                } else {
                    await this.setupR2(env);
                }

                this.isInitialized = true;
                console.log('[DuckDB] Ready');
            } catch (error) {
                console.error('[DuckDB] Init failed:', error);
                this.initPromise = null;
                throw error;
            }
        })();

        return this.initPromise;
    }

    private async setupR2(env: Env): Promise<void> {
        if (!this.conn) throw new Error('Connection not initialized');

        const { CLOUDFLARE_ACCOUNT_ID: accountId, R2_ACCESS_KEY_ID: keyId,
            R2_SECRET_ACCESS_KEY: secret, R2_BUCKET_NAME: bucket, R2_ENDPOINT: endpoint } = env;

        // Validate required credentials
        if (!accountId || !keyId || !secret) {
            console.warn('[DuckDB] Missing R2 credentials, skipping');
            return;
        }

        // Validate identifiers
        if (!isValidId(accountId) || !isValidId(bucket)) {
            console.error('[DuckDB] Invalid account ID or bucket name');
            return;
        }

        try {
            // Install S3 extension
            console.log('[DuckDB] Setting up R2...');
            await this.conn.run('INSTALL httpfs; LOAD httpfs;');

            // Configure S3 secret
            const r2Endpoint = endpoint?.replace(/^https?:\/\//, '')
                || `${accountId}.r2.cloudflarestorage.com`;

            await this.conn.run(`
                CREATE SECRET r2_secret (
                    TYPE S3,
                    KEY_ID '${escapeSql(keyId)}',
                    SECRET '${escapeSql(secret)}',
                    REGION 'auto',
                    ENDPOINT '${escapeSql(r2Endpoint)}',
                    URL_STYLE 'path',
                    USE_SSL true
                );
            `);

            // Attach database from R2
            await this.conn.run(`ATTACH 's3://${bucket}/stock.duckdb' AS stock_db (READ_ONLY);`);
            console.log('[DuckDB] R2 attached');
        } catch (error) {
            console.error('[DuckDB] R2 setup failed:', error);
        }
    }

    async query(sql: string): Promise<Record<string, unknown>[]> {
        if (!this.conn) throw new Error('Connection not initialized');

        console.log('[SQL]', sql);
        const reader = await this.conn.runAndReadAll(sql);
        return reader.getRowObjectsJson() as Record<string, unknown>[];
    }

    close(): void {
        this.conn?.closeSync();
        this.conn = null;
        this.instance = null;
        this.isInitialized = false;
    }

    isReady(): boolean {
        return this.isInitialized;
    }
}
