import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { DuckDBInstance } from '@duckdb/node-api';
import * as fs from 'fs';
import * as path from 'path';

const app = new Hono();
const DB_PATH = path.resolve(process.cwd(), '../../data/stock.duckdb');

// Patch BigInt serialization
(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

let db: DuckDBInstance | null = null;
let conn: any = null; // Type as any for now to avoid complexity or connection interface type

async function getConn() {
    if (!db) {
        db = await DuckDBInstance.create(DB_PATH);
    }
    if (!conn) {
        conn = await db.connect();
    }
    return conn;
}

// Helper to run query
const runQuery = async (query: string): Promise<any[]> => {
    const connection = await getConn();
    const result = await connection.run(query);
    return await result.getRowObjectsJS();
};

app.get('/api/tables', async (c) => {
    try {
        const res = await runQuery("SHOW TABLES");
        const tables = res.map((r: any) => r.name);
        return c.json(tables);
    } catch (e: any) {
        console.error("Error fetching tables:", e);
        return c.json({ error: e.message }, 500);
    }
});

app.get('/api/table/:name', async (c) => {
    const tableName = c.req.param('name');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = (page - 1) * limit;

    try {
        if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
            return c.json({ error: "Invalid table name" }, 400);
        }

        const countRes = await runQuery(`SELECT COUNT(*) as count FROM ${tableName}`);
        // count might be returned as bigint, convert to number safely
        const total = Number(countRes[0].count);

        const data = await runQuery(`SELECT * FROM ${tableName} LIMIT ${limit} OFFSET ${offset}`);

        const schemaRes = await runQuery(`DESCRIBE ${tableName}`);
        const columns = schemaRes.map((r: any) => r.column_name);

        return c.json({
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            columns
        });
    } catch (e: any) {
        console.error(`Error fetching table ${tableName}:`, e);
        return c.json({ error: e.message }, 500);
    }
});

app.get('/api/query', async (c) => {
    const sql = c.req.query('sql');
    if (!sql) return c.json({ error: "No SQL provided" }, 400);

    try {
        const data = await runQuery(sql);
        return c.json(data);
    } catch (e: any) {
        console.error("Error executing query:", e);
        return c.json({ error: e.message }, 500);
    }
});


// Serve static files
app.get('/*', async (c) => {
    const urlPath = new URL(c.req.url).pathname;
    let filePath = path.join(process.cwd(), 'public', urlPath);

    if (urlPath === '/' || urlPath === '') {
        filePath = path.join(process.cwd(), 'public', 'index.html');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const content = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        const contentType = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css'
        }[ext] || 'application/octet-stream';

        c.header('Content-Type', contentType);
        c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
        c.header('Pragma', 'no-cache');
        c.header('Expires', '0');
        return c.body(content);
    }
    return c.text('Not Found', 404);
});

const port = 3000;
console.log(`Server is running on port ${port}`);

serve({
    fetch: app.fetch,
    port
});
