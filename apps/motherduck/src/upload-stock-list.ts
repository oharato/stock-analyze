import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { DuckDBInstance } from '@duckdb/node-api';

const VALID_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function validateIdentifier(name: string, label: string): string {
  if (!VALID_IDENTIFIER.test(name)) {
    throw new Error(`Invalid ${label}: ${name}`);
  }
  return name;
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function toDuckPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

async function attachMotherDuckDatabase(conn: Awaited<ReturnType<DuckDBInstance['connect']>>, database: string): Promise<void> {
  try {
    await conn.run(`ATTACH 'md:${database}' AS md;`);
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('no database/share named')) {
      throw error;
    }
  }

  console.log(`Database ${database} not found. Creating it on MotherDuck...`);
  try {
    await conn.run(`CREATE DATABASE IF NOT EXISTS ${database};`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to create MotherDuck database '${database}'. ` +
      `Set MOTHERDUCK_DATABASE to an existing database, or create it manually. Details: ${message}`
    );
  }

  await conn.run(`ATTACH 'md:${database}' AS md;`);
}

async function main(): Promise<void> {
  const token = process.env.MOTHERDUCK_TOKEN;
  if (!token) {
    throw new Error('MOTHERDUCK_TOKEN is required');
  }

  const database = validateIdentifier(process.env.MOTHERDUCK_DATABASE ?? 'stock_analyze', 'database name');
  const schema = validateIdentifier(process.env.MOTHERDUCK_SCHEMA ?? 'main', 'schema name');
  const table = validateIdentifier(process.env.MOTHERDUCK_TABLE ?? 'stock_list', 'table name');

  const sourceFile = path.resolve('../../data/master/stock_list.parquet');
  if (!fs.existsSync(sourceFile)) {
    throw new Error(`Source file not found: ${sourceFile}`);
  }

  console.log(`Source: ${sourceFile}`);

  const db = await DuckDBInstance.create(':memory:');
  const conn = await db.connect();
  const fullTableName = `md.${schema}.${table}`;

  try {
    await conn.run('INSTALL motherduck;');
    await conn.run('LOAD motherduck;');
    await conn.run(`SET motherduck_token='${escapeSqlLiteral(token)}';`);
    await attachMotherDuckDatabase(conn, database);
    await conn.run(`CREATE SCHEMA IF NOT EXISTS md.${schema};`);

    const parquetFile = toDuckPath(sourceFile);

    await conn.run(
      `CREATE TABLE IF NOT EXISTS ${fullTableName} AS SELECT * FROM read_parquet('${escapeSqlLiteral(parquetFile)}') WHERE 1 = 0;`
    );

    await conn.run(`DELETE FROM ${fullTableName};`);
    console.log(`Cleared existing rows from ${fullTableName}`);

    await conn.run(
      `INSERT INTO ${fullTableName} SELECT * FROM read_parquet('${escapeSqlLiteral(parquetFile)}');`
    );

    const totalResult = await conn.run(`SELECT count(*) FROM ${fullTableName};`);
    const totalRows = await totalResult.getRows();
    const tableCount = Number(totalRows[0]?.[0] ?? 0);

    console.log(`Upload complete. Current row count (${fullTableName}): ${tableCount}`);
  } finally {
    conn.closeSync();
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
