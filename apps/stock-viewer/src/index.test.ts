import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app, duckdb } from './index';

describe('API Endpoints', () => {
    beforeAll(async () => {
        // Ensure DB is initialized for tests
        await duckdb.runQuery('CREATE TABLE IF NOT EXISTS test_table (id INTEGER, name VARCHAR)');
        await duckdb.runQuery("INSERT INTO test_table VALUES (1, 'Test Item')");
    });

    it('GET /api/tables should return list of tables', async () => {
        const res = await app.request('/api/tables');
        expect(res.status).toBe(200);
        const data = await res.json() as any[];
        expect(Array.isArray(data)).toBe(true);
        expect(data).toContain('test_table');
    });

    it('GET /api/table/:name should return table data', async () => {
        const res = await app.request('/api/table/test_table');
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.data).toHaveLength(1);
        expect(data.data[0].name).toBe('Test Item');
        expect(data.columns).toContain('name');
        expect(data.total).toBe(1);
    });

    it('GET /api/query should execute SQL', async () => {
        const res = await app.request('/api/query?sql=SELECT+100+as+num');
        expect(res.status).toBe(200);
        const data = await res.json() as any[];
        expect(data).toEqual([{ num: 100 }]);
    });
});
