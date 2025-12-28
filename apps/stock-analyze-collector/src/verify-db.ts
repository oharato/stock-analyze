import { DuckDBInstance } from '@duckdb/node-api';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, '../../../data/stock.duckdb');

async function main() {
    const db = await DuckDBInstance.create(DB_PATH);
    const conn = await db.connect();

    const tables = ['companies', 'prices', 'fundamentals', 'edinet', 'large_shareholdings'];

    console.log('Table Row Counts:');
    console.log('=================');

    for (const table of tables) {
        try {
            const result = await conn.run(`SELECT COUNT(*) as count FROM ${table}`);
            const rows = await result.getRows();
            console.log(`${table}: ${rows[0][0]}`);
        } catch (e: any) {
            console.log(`${table}: ERROR - ${e.message}`);
        }
    }
}

main();
