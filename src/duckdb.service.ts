import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';

export interface Env {
    R2_BUCKET_NAME: string;
    CLOUDFLARE_ACCOUNT_ID: string;
    R2_ACCESS_KEY_ID: string;
    R2_SECRET_ACCESS_KEY: string;
    R2_ENDPOINT?: string;
    LOCAL_DUCKDB_PATH?: string;
}

// Optional: allow overriding the S3/R2 endpoint for local emulation (MinIO, LocalStack)
export interface EnvWithEndpoint extends Env {
    R2_ENDPOINT?: string;
}
// Helper to escape single quotes in SQL strings
function escapeSqlString(value: string): string {
    return value.replace(/'/g, "''");
}

// Validate that a string contains only safe characters for identifiers/paths
function isValidIdentifier(value: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(value);
}

export class DuckDBService {
    private instance: DuckDBInstance | null = null;
    private conn: DuckDBConnection | null = null;
    private isInitialized = false;
    private initializationPromise: Promise<void> | null = null;

    async initialize(env: Env): Promise<void> {
        if (this.isInitialized) return;
        if (this.initializationPromise) return this.initializationPromise;

        this.initializationPromise = (async () => {
            try {
                console.log('Initializing DuckDB with @duckdb/node-api...');

                // Create in-memory DuckDB instance
                this.instance = await DuckDBInstance.create(':memory:');
                this.conn = await this.instance.connect();

                // Check for local DuckDB path first
                if (env.LOCAL_DUCKDB_PATH) {
                    console.log(`Attaching local DuckDB file from ${env.LOCAL_DUCKDB_PATH}...`);
                    try {
                        await this.conn.run(`ATTACH '${env.LOCAL_DUCKDB_PATH}' AS stock_db (READ_ONLY);`);
                        console.log('Local DuckDB attached successfully.');
                    } catch (localErr) {
                        console.error('Failed to attach local DuckDB:', localErr);
                        console.log('Attempting R2 fallback...');
                        await this.initializeR2(env);
                    }
                } else {
                    // Initialize R2 connection
                    await this.initializeR2(env);
                }

                this.isInitialized = true;
                console.log('DuckDB initialized successfully');
            } catch (error) {
                console.error('Failed to initialize DuckDB:', error);
                this.initializationPromise = null; // Allow retrying
                throw error;
            }
        })();

        return this.initializationPromise;
    }


    private async initializeR2(env: Env | EnvWithEndpoint): Promise<void> {
        if (!this.conn) {
            throw new Error('Database connection not initialized');
        }

        const accountId = env.CLOUDFLARE_ACCOUNT_ID;
        const accessKeyId = env.R2_ACCESS_KEY_ID;
        const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
        const bucketName = env.R2_BUCKET_NAME;
        // allow optional endpoint override for local S3 emulators
        const endpointOverride = (env as EnvWithEndpoint).R2_ENDPOINT;
        console.log('[Debug] initializeR2 env keys:', Object.keys(env));
        console.log('[Debug] R2_ENDPOINT:', endpointOverride);

        if (!accountId || !accessKeyId || !secretAccessKey) {
            console.warn('Missing R2 environment variables. Skipping R2 initialization.');
            return;
        }

        // Validate account ID and bucket name format to prevent injection
        if (!isValidIdentifier(accountId)) {
            console.error('Invalid CLOUDFLARE_ACCOUNT_ID format. Skipping R2 initialization.');
            return;
        }
        if (!isValidIdentifier(bucketName)) {
            console.error('Invalid R2_BUCKET_NAME format. Skipping R2 initialization.');
            return;
        }

        try {
            // Install and load httpfs extension for S3/R2 support
            console.log('Installing httpfs extension...');
            await this.conn.run('INSTALL httpfs;');
            await this.conn.run('LOAD httpfs;');

            // Configure S3/R2 access (escape credentials to prevent SQL injection)
            console.log('Configuring R2 connection...');
            const escapedAccessKeyId = escapeSqlString(accessKeyId);
            const escapedSecretAccessKey = escapeSqlString(secretAccessKey);
            // Allow using an explicit endpoint (useful for MinIO/local S3)
            const endpoint = endpointOverride && endpointOverride.length > 0
                ? endpointOverride.replace(/^https?:\/\//, '')
                : `${accountId}.r2.cloudflarestorage.com`;

            const secretSql = `
        CREATE SECRET r2_secret (
          TYPE S3,
          KEY_ID '${escapedAccessKeyId}',
          SECRET '${escapedSecretAccessKey}',
          REGION 'auto',
          ENDPOINT '${escapeSqlString(endpoint)}',
          URL_STYLE 'path',
          USE_SSL true
        );
      `;
            console.log('Configuring R2 connection with SQL:', secretSql.replace(escapedAccessKeyId, '***').replace(escapedSecretAccessKey, '***'));
            await this.conn.run(secretSql);

            // Attach the database file from R2
            console.log('Attaching stock.duckdb from R2...');
            await this.conn.run(`ATTACH 's3://${bucketName}/stock.duckdb' AS stock_db (READ_ONLY);`);

            console.log('DuckDB R2 configuration initialized successfully.');
        } catch (error) {
            console.error('Failed to initialize R2 configuration:', error);
            // Don't throw here, allow running without R2 if only querying local/memory
        }
    }

    public async query(sql: string): Promise<Record<string, unknown>[]> {
        if (!this.conn) {
            throw new Error('Database connection not initialized');
        }

        console.log('--- [DuckDB Executing SQL] ---');
        console.log(sql);
        console.log('------------------------------');

        // Use runAndReadAll and getRowObjects for JSON-like results
        const reader = await this.conn.runAndReadAll(sql);

        // getRowObjectsJson returns JSON-serializable objects
        return reader.getRowObjectsJson() as Record<string, unknown>[];
    }

    public close(): void {
        if (this.conn) {
            this.conn.closeSync();
            this.conn = null;
        }
        this.instance = null;
        this.isInitialized = false;
    }

    public isReady(): boolean {
        return this.isInitialized;
    }
}
