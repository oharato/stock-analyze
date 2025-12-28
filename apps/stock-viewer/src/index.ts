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
let conn: any = null;
let extractor: any = null;

async function getExtractor() {
    if (!extractor) {
        const { pipeline } = await import('@xenova/transformers');
        extractor = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
    }
    return extractor;
}

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
        c.header('Cache-Control', 'public, max-age=3600');
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

        c.header('Cache-Control', 'public, max-age=3600');
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

app.get('/api/search/edinet', async (c) => {
    const query = c.req.query('q') || '';
    const target = c.req.query('target') || 'business_risks';
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = (page - 1) * limit;

    const allowedTargets = [
        'business_policy', 'business_risks', 'mda',
        'business_description', 'company_history',
        'research_and_development', 'corporate_governance'
    ];

    if (!allowedTargets.includes(target)) {
        return c.json({ error: "Invalid search target" }, 400);
    }

    const vectorColumn = `${target}_vector`;

    if (!query.trim()) {
        return c.redirect(`/api/table/edinet?page=${page}&limit=${limit}`);
    }

    try {
        const extractor = await getExtractor();
        const output = await extractor(query, { pooling: 'mean', normalize: true });
        const queryVector = Array.from(output.data);
        const vectorStr = `[${queryVector.join(',')}]`;

        const sql = `
            SELECT *, 
                   list_cosine_similarity(${vectorColumn}, CAST(${vectorStr} AS DOUBLE[])) as score
            FROM edinet
            WHERE ${vectorColumn} IS NOT NULL AND len(${vectorColumn}) = 384
            ORDER BY score DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        const countRes = await runQuery(`SELECT COUNT(*) as count FROM edinet WHERE ${vectorColumn} IS NOT NULL AND len(${vectorColumn}) = 384`);
        const total = Number(countRes[0].count);
        const data = await runQuery(sql);

        const schemaRes = await runQuery(`DESCRIBE edinet`);
        const columns = schemaRes.map((r: any) => r.column_name);

        c.header('Cache-Control', 'public, max-age=3600');
        return c.json({
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            columns
        });
    } catch (e: any) {
        console.error("Vector search failed:", e);
        return c.json({ error: e.message }, 500);
    }
});

app.get('/api/query', async (c) => {
    const sql = c.req.query('sql');
    if (!sql) return c.json({ error: "No SQL provided" }, 400);

    try {
        const data = await runQuery(sql);
        c.header('Cache-Control', 'public, max-age=3600');
        return c.json(data);
    } catch (e: any) {
        console.error("Error executing query:", e);
        return c.json({ error: e.message }, 500);
    }
});


// Serve static files
app.get('/*', async (c) => {
    const urlPath = new URL(c.req.url).pathname;
    const staticDir = path.join(process.cwd(), 'dist', 'client');
    let filePath = path.join(staticDir, urlPath);

    if (urlPath === '/' || urlPath === '') {
        filePath = path.join(staticDir, 'index.html');
    } else if (!path.extname(urlPath)) {
        // もし拡張子がない場合は.htmlを付与して試行（/companies -> /companies.html）
        const htmlPath = filePath + '.html';
        if (fs.existsSync(htmlPath)) {
            filePath = htmlPath;
        }
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const content = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        const contentType = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon'
        }[ext] || 'application/octet-stream';

        c.header('Content-Type', contentType);
        c.header('Cache-Control', 'public, max-age=300');
        return c.body(content);
    }
    console.log('File not found:', filePath);
    return c.text('Not Found', 404);
});

const port = 3000;
console.log(`Server is running on port ${port}`);

serve({
    fetch: app.fetch,
    port
});
