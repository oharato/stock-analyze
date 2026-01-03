
import { DuckDBInstance } from '@duckdb/node-api';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, '../../../data/stock.duckdb');
const DATA_DIR = path.resolve(__dirname, '../../../data');

// Parse CLI arguments
const args = process.argv.slice(2);
const tableArg = args.find(arg => arg.startsWith('--table='));
const targetTable = tableArg ? tableArg.split('=')[1] : null;

interface TableConfig {
    name: string;
    parquetPattern: string;
    duckDbOptions?: { [key: string]: string };
    orderBy?: string;
}

const TABLES: TableConfig[] = [
    {
        name: 'companies',
        parquetPattern: 'master/stock_list.parquet',
    },
    {
        name: 'prices',
        parquetPattern: 'processed/prices/*.parquet',
        orderBy: 'code ASC, date ASC',
    },
    {
        name: 'fundamentals',
        parquetPattern: 'processed/fundamentals/**/*.parquet',
    },
    {
        name: 'edinet',
        parquetPattern: 'processed/edinet/*.parquet',
        orderBy: 'ticker ASC, submit_date ASC',
    },
    {
        name: 'large_shareholdings',
        parquetPattern: 'processed/large-shareholdings/*.parquet',
        orderBy: 'ticker ASC, submit_date ASC',
    }
];

async function consolidateTable(conn: any, config: TableConfig) {
    if (targetTable && targetTable !== config.name) {
        return;
    }

    console.log(`Consolidating ${config.name}...`);
    console.time(`consolidate_${config.name}`);

    // Apply specific options if any
    if (config.duckDbOptions) {
        for (const [key, value] of Object.entries(config.duckDbOptions)) {
            await conn.run(`SET ${key}='${value}'`);
        }
    }

    // Construct full path pattern
    // Note: If pattern contains *, we shouldn't use fs.existsSync directly on it mostly,
    // but for the base dir check it is valid.
    // However, DuckDB handles globbing well.
    // Let's resolve the full path for DuckDB.
    const fullUnknownPath = path.join(DATA_DIR, config.parquetPattern);

    // Check if any files exist (naive check for the directory at least)
    // We can just try to run it and catch error if no files match
    try {
        let sql = `CREATE OR REPLACE TABLE ${config.name} AS SELECT * FROM read_parquet('${fullUnknownPath}', union_by_name=true)`;
        if (config.orderBy) {
            sql += ` ORDER BY ${config.orderBy}`;
        }
        await conn.run(sql);

        // Log count
        await logRecordCount(conn, config.name);

    } catch (e: any) {
        // DuckDB might throw if no files found or glob matches nothing
        console.warn(`Failed to consolidate ${config.name} (files likely missing):`, e.message);
    }

    console.timeEnd(`consolidate_${config.name}`);
}

async function logRecordCount(conn: any, tableName: string) {
    try {
        const result = await conn.run(`SELECT count(*) as count FROM ${tableName}`);
        const rows = await result.getRows();
        // rows[0][0] might be a BigInt or number
        const count = rows[0][0];
        console.log(`[Table: ${tableName}] Record count: ${count.toString()}`);
    } catch (e: any) {
        console.warn(`Failed to get record count for ${tableName}:`, e.message);
    }
}

async function main() {
    console.log('--- Starting Data Consolidation (TypeScript) ---');
    console.log(`Database: ${DB_PATH}`);
    console.log(`Data Dir: ${DATA_DIR}`);
    if (targetTable) {
        console.log(`Target Table: ${targetTable}`);
    } else {
        console.log('Target: All tables');
    }

    const db = await DuckDBInstance.create(DB_PATH);
    const conn = await db.connect();

    try {
        for (const config of TABLES) {
            await consolidateTable(conn, config);
        }
        console.log('--- Consolidation Complete ---');
    } catch (e: any) {
        console.error('Consolidation failed:', e);
        process.exit(1);
    }
}

main();
