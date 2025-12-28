
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
    await conn.run(`CREATE OR REPLACE TABLE companies AS SELECT * FROM read_json_auto('${DATA_DIR}/master/stock_list.ndjson')`);
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
    console.log('Consolidating edinet (batched)...');

    // Increase memory limit and tune performance
    await conn.run("SET memory_limit='16GB'");
    await conn.run("SET threads=4");
    await conn.run("SET preserve_insertion_order=false");

    const edinetDir = path.join(DATA_DIR, 'raw/edinet');
    const subdirs = fs.readdirSync(edinetDir).filter(f => fs.statSync(path.join(edinetDir, f)).isDirectory());

    console.log(`Found ${subdirs.length} subdirectories. Processing in batches...`);

    // Define explicit schema to avoid inference errors (especially for major_shareholders and vectors)
    const schema = `
        columns={
            'doc_id': 'VARCHAR',
            'filer_name': 'VARCHAR',
            'edinet_code': 'VARCHAR',
            'doc_description': 'VARCHAR',
            'submit_date': 'VARCHAR',
            'ticker': 'VARCHAR',
            'year': 'BIGINT',
            'business_policy': 'VARCHAR',
            'business_policy_vector': 'DOUBLE[]',
            'business_risks': 'VARCHAR',
            'business_risks_vector': 'DOUBLE[]',
            'mda': 'VARCHAR',
            'mda_vector': 'DOUBLE[]',
            'business_description': 'VARCHAR',
            'business_description_vector': 'DOUBLE[]',
            'company_history': 'VARCHAR',
            'company_history_vector': 'DOUBLE[]',
            'research_and_development': 'VARCHAR',
            'research_and_development_vector': 'DOUBLE[]',
            'corporate_governance': 'VARCHAR',
            'corporate_governance_vector': 'DOUBLE[]',
            'net_sales': 'DOUBLE',
            'operating_income': 'DOUBLE',
            'ordinary_income': 'DOUBLE',
            'net_income': 'DOUBLE',
            'net_assets': 'DOUBLE',
            'total_assets': 'DOUBLE',
            'operating_cash_flow': 'DOUBLE',
            'investing_cash_flow': 'DOUBLE',
            'financing_cash_flow': 'DOUBLE',
            'cash_and_equivalents': 'DOUBLE',
            'earnings_per_share': 'DOUBLE',
            'book_value_per_share': 'DOUBLE',
            'equity_to_total_assets_ratio': 'DOUBLE',
            'rate_of_return_on_equity': 'DOUBLE',
            'price_earnings_ratio': 'DOUBLE',
            'payout_ratio': 'DOUBLE',
            'number_of_issued_shares': 'DOUBLE',
            'dividend_paid_per_share': 'DOUBLE',
            'major_shareholders': 'JSON',
            'date': 'VARCHAR',
            'docId': 'VARCHAR'
        }
    `;

    let isFirst = true;
    for (const subdir of subdirs) {
        console.log(`  Processing batch: ${subdir}...`);
        const pattern = path.join(edinetDir, subdir, '*.json');

        if (isFirst) {
            await conn.run(`CREATE OR REPLACE TABLE edinet AS SELECT * FROM read_json_auto('${pattern}', ${schema}, union_by_name=true)`);
            isFirst = false;
        } else {
            await conn.run(`INSERT INTO edinet SELECT * FROM read_json_auto('${pattern}', ${schema}, union_by_name=true)`);
        }
    }
    console.log('Edinet consolidation finished.');
}

async function consolidateLargeShareholdings(conn: any) {
    console.log('Consolidating large_shareholdings...');
    await conn.run(`CREATE OR REPLACE TABLE large_shareholdings AS SELECT * FROM read_json_auto('${DATA_DIR}/raw/large-shareholdings/**/*.json', union_by_name=true)`);
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
