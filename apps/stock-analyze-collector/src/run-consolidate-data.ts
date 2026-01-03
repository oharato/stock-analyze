
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
    await conn.run("SET memory_limit='16GB'");
    await conn.run("SET threads=4");

    const pricesDir = path.join(DATA_DIR, 'processed/prices');
    if (!fs.existsSync(pricesDir)) {
        console.log('Prices directory not found, skipping.');
        return;
    }

    const dirs = fs.readdirSync(pricesDir).filter(d => d.startsWith('code='));
    console.log(`Found ${dirs.length} price directories.`);

    let created = false;
    let count = 0;
    const total = dirs.length;
    for (const dir of dirs) {
        count++;
        // Use manual glob construction for each directory to restrict scope
        const pattern = path.join(pricesDir, dir, '*.parquet');

        if (!created) {
            // First batch creates the table
            await conn.run(`CREATE OR REPLACE TABLE prices AS SELECT * FROM read_parquet('${pattern}')`);
            created = true;
        } else {
            // Subsequent batches append
            await conn.run(`INSERT INTO prices SELECT * FROM read_parquet('${pattern}')`);
        }

        if (count % 100 === 0 || count === total) {
            console.log(`[Prices] Processed ${count}/${total} (${((count / total) * 100).toFixed(1)}%)`);
        }
    }
    console.log('\nPrices consolidation finished.');
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

    const edinetBaseDir = path.join(DATA_DIR, 'processed/edinet');
    if (!fs.existsSync(edinetBaseDir)) {
        console.log('Edinet directory not found, skipping.');
        return;
    }

    const files = fs.readdirSync(edinetBaseDir).filter(f => f.endsWith('.parquet')).sort();
    console.log(`Found ${files.length} edinet monthly files.`);

    let created = false;
    let count = 0;
    const total = files.length;
    for (const file of files) {
        count++;
        const filePath = path.join(edinetBaseDir, file);

        try {
            if (!created) {
                await conn.run(`CREATE OR REPLACE TABLE edinet AS SELECT * FROM read_parquet('${filePath}', union_by_name=true)`);
                created = true;
            } else {
                await conn.run(`INSERT INTO edinet SELECT * FROM read_parquet('${filePath}', union_by_name=true)`);
            }
        } catch (e: any) {
            console.warn(`Failed to process edinet batch ${file}:`, e.message);
        }

        if (total < 100 || count % 10 === 0 || count === total) {
            console.log(`[Edinet] Processed ${count}/${total} (${((count / total) * 100).toFixed(1)}%)`);
        }
    }
    console.log('Edinet consolidation finished.');
}

async function consolidateLargeShareholdings(conn: any) {
    console.log('Consolidating large_shareholdings...');
    await conn.run(`CREATE OR REPLACE TABLE large_shareholdings AS SELECT * FROM read_parquet('${DATA_DIR}/processed/large-shareholdings/**/*.parquet', union_by_name=true)`);
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
            console.time('consolidateCompanies');
            await consolidateCompanies(conn);
            console.timeEnd('consolidateCompanies');
        }
        if (!targetTable || targetTable === 'prices') {
            console.time('consolidatePrices');
            await consolidatePrices(conn);
            console.timeEnd('consolidatePrices');
        }
        if (!targetTable || targetTable === 'fundamentals') {
            console.time('consolidateFundamentals');
            await consolidateFundamentals(conn);
            console.timeEnd('consolidateFundamentals');
        }
        if (!targetTable || targetTable === 'edinet') {
            console.time('consolidateEdinet');
            await consolidateEdinet(conn);
            console.timeEnd('consolidateEdinet');
        }
        if (!targetTable || targetTable === 'large_shareholdings') {
            console.time('consolidateLargeShareholdings');
            await consolidateLargeShareholdings(conn);
            console.timeEnd('consolidateLargeShareholdings');
        }

        console.log('--- Consolidation Complete ---');

    } catch (e: any) {
        console.error('Consolidation failed:', e);
        process.exit(1);
    }
}

main();
