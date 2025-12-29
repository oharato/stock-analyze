import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DuckDBManager } from './duckdb';
import * as fs from 'fs';
import * as path from 'path';

describe('DuckDBManager', () => {
    let dbManager: DuckDBManager;

    it('should create an in-memory database if local file does not exist', async () => {
        dbManager = new DuckDBManager({ localPath: './non-existent.duckdb' });
        const conn = await dbManager.getConnection();
        expect(conn).toBeDefined();

        const result = await dbManager.runQuery('SELECT 1 as val');
        expect(result).toEqual([{ val: 1 }]);
        await dbManager.close();
    });

    it('should run a query and return results', async () => {
        dbManager = new DuckDBManager({ localPath: ':memory:' });
        await dbManager.runQuery('CREATE TABLE test (id INTEGER, name VARCHAR)');
        await dbManager.runQuery("INSERT INTO test VALUES (1, 'Alice'), (2, 'Bob')");

        const result = await dbManager.runQuery('SELECT * FROM test ORDER BY id');
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ id: 1, name: 'Alice' });
        expect(result[1]).toEqual({ id: 2, name: 'Bob' });
        await dbManager.close();
    });
});
