
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

async function consolidateCompanies(conn: any) {
    console.log('Consolidating companies...');
    await conn.run(`CREATE OR REPLACE TABLE companies AS SELECT * FROM read_parquet('${DATA_DIR}/master/stock_list.parquet')`);
}

async function consolidatePrices(conn: any) {
    console.log('Consolidating prices...');
    await conn.run(`CREATE OR REPLACE TABLE prices AS SELECT * FROM read_parquet('${DATA_DIR}/processed/prices/**/*.parquet', union_by_name=true)`);
}

async function consolidateFundamentals(conn: any) {
    console.log('Consolidating fundamentals...');
    await conn.run(`CREATE OR REPLACE TABLE fundamentals AS SELECT * FROM read_parquet('${DATA_DIR}/processed/fundamentals/**/*.parquet', union_by_name=true)`);
}

async function consolidateEdinet(conn: any) {
    console.log('Consolidating edinet (from Parquet)...');

    // Increase memory limit and tune performance
    await conn.run("SET memory_limit='16GB'");
    await conn.run("SET threads=4");
    await conn.run("SET preserve_insertion_order=false");

    const edinetPattern = path.join(DATA_DIR, 'raw/edinet/**/*.parquet');
    console.log(`Reading Parquet files from ${edinetPattern}...`);

    try {
        await conn.run(`CREATE OR REPLACE TABLE edinet AS SELECT * FROM read_parquet('${edinetPattern}', union_by_name=true)`);
    } catch (e: any) {
        console.warn('Failed to consolidate edinet table (maybe no files found?):', e.message);
    }
    console.log('Edinet consolidation finished.');
}

async function consolidateLargeShareholdings(conn: any) {
    console.log('Consolidating large_shareholdings...');
    await conn.run(`CREATE OR REPLACE TABLE large_shareholdings AS SELECT * FROM read_parquet('${DATA_DIR}/raw/large-shareholdings/**/*.parquet', union_by_name=true)`);
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
        if (!targetTable || targetTable === 'companies') {
            await consolidateCompanies(conn);
        }
        if (!targetTable || targetTable === 'prices') {
            await consolidatePrices(conn);
        }
        if (!targetTable || targetTable === 'fundamentals') {
            await consolidateFundamentals(conn);
        }
        if (!targetTable || targetTable === 'edinet') {
            await consolidateEdinet(conn);
        }
        if (!targetTable || targetTable === 'large_shareholdings') {
            await consolidateLargeShareholdings(conn);
        }

        console.log('--- Consolidation Complete ---');

    } catch (e: any) {
        console.error('Consolidation failed:', e);
        process.exit(1);
    }
}

main();
