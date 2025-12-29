import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { DuckDBManager } from './lib/duckdb.js';
import * as fs from 'fs';
import * as path from 'path';

// --- Types ---

interface TableResponse {
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    columns: string[];
}

interface VectorSearchQuery {
    q?: string;
    target?: string;
    page?: string;
    limit?: string;
}

// --- App Setup ---

const app = new Hono();

// Patch BigInt serialization
(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

const duckdb = new DuckDBManager({
    r2: {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        bucketName: process.env.R2_BUCKET_NAME || '',
    }
});

let extractor: any = null;

async function getExtractor() {
    if (!extractor) {
        const { pipeline } = await import('@xenova/transformers');
        // @ts-ignore - pipeline type from Xenova might be tricky to match exactly without full types
        extractor = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
    }
    return extractor;
}

// --- API Routes ---

app.get('/api/tables', async (c) => {
    try {
        const res = await duckdb.runQuery<{ name: string }>("SHOW TABLES");
        const tables = res.map(r => r.name);
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

        const countRes = await duckdb.runQuery<{ count: bigint | number }>(`SELECT COUNT(*) as count FROM ${tableName}`);
        const total = Number(countRes[0].count);

        const data = await duckdb.runQuery(`SELECT * FROM ${tableName} LIMIT ${limit} OFFSET ${offset}`);

        const schemaRes = await duckdb.runQuery<{ column_name: string }>(`DESCRIBE ${tableName}`);
        const columns = schemaRes.map(r => r.column_name);

        c.header('Cache-Control', 'public, max-age=3600');
        const response: TableResponse = {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            columns
        };
        return c.json(response);
    } catch (e: any) {
        console.error(`Error fetching table ${tableName}:`, e);
        return c.json({ error: e.message }, 500);
    }
});

app.get('/api/search/edinet', async (c) => {
    const { q: query = '', target = 'business_risks', page: p = '1', limit: l = '50' } = c.req.query() as VectorSearchQuery;
    const page = parseInt(p);
    const limit = parseInt(l);
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

        const countRes = await duckdb.runQuery<{ count: bigint | number }>(
            `SELECT COUNT(*) as count FROM edinet WHERE ${vectorColumn} IS NOT NULL AND len(${vectorColumn}) = 384`
        );
        const total = Number(countRes[0].count);
        const data = await duckdb.runQuery(sql);

        const schemaRes = await duckdb.runQuery<{ column_name: string }>(`DESCRIBE edinet`);
        const columns = schemaRes.map(r => r.column_name);

        c.header('Cache-Control', 'public, max-age=3600');
        const response: TableResponse = {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            columns
        };
        return c.json(response);
    } catch (e: any) {
        console.error("Vector search failed:", e);
        return c.json({ error: e.message }, 500);
    }
});

app.get('/api/query', async (c) => {
    const sql = c.req.query('sql');
    if (!sql) return c.json({ error: "No SQL provided" }, 400);

    try {
        const data = await duckdb.runQuery(sql);
        c.header('Cache-Control', 'public, max-age=3600');
        return c.json(data);
    } catch (e: any) {
        console.error("Error executing query:", e);
        return c.json({ error: e.message }, 500);
    }
});

// --- Static Files ---

app.get('/*', async (c) => {
    const urlPath = new URL(c.req.url).pathname;
    const staticDir = path.join(process.cwd(), 'dist', 'client');
    let filePath = path.join(staticDir, urlPath);

    if (urlPath === '/' || urlPath === '') {
        filePath = path.join(staticDir, 'index.html');
    } else if (!path.extname(urlPath)) {
        const htmlPath = filePath + '.html';
        if (fs.existsSync(htmlPath)) {
            filePath = htmlPath;
        }
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const content = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        const contentTypeMap: Record<string, string> = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon'
        };
        const contentType = contentTypeMap[ext] || 'application/octet-stream';

        c.header('Content-Type', contentType);
        c.header('Cache-Control', 'public, max-age=300');
        return c.body(content);
    }

    console.log('File not found:', filePath);
    return c.text('Not Found', 404);
});

export { app, duckdb };

const port = 3000;

if (process.env.NODE_ENV !== 'test') {
    console.log(`Server is running on port ${port}`);
    serve({
        fetch: app.fetch,
        port
    });
}
