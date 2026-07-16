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

function hasParquetMagic(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size < 8) {
      return false;
    }

    const fd = fs.openSync(filePath, 'r');
    try {
      const header = Buffer.alloc(4);
      const footer = Buffer.alloc(4);
      fs.readSync(fd, header, 0, 4, 0);
      fs.readSync(fd, footer, 0, 4, stat.size - 4);
      return header.toString('ascii') === 'PAR1' && footer.toString('ascii') === 'PAR1';
    } finally {
      fs.closeSync(fd);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to validate parquet file ${path.basename(filePath)}: ${message}`);
    return false;
  }
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
  const table = validateIdentifier(process.env.MOTHERDUCK_TABLE ?? 'prices', 'table name');
  const truncateBeforeLoad = (process.env.MOTHERDUCK_TRUNCATE_BEFORE_LOAD ?? 'true').toLowerCase() === 'true';

  const sourceDir = path.resolve('../../data/processed/prices');
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  const files = fs
    .readdirSync(sourceDir)
    .filter((file: string) => file.endsWith('.parquet'))
    .sort();

  if (files.length === 0) {
    console.log(`No parquet files found in ${sourceDir}`);
    return;
  }

  const validFiles = files.filter((file) => {
    const parquetFile = path.join(sourceDir, file);
    if (hasParquetMagic(parquetFile)) {
      return true;
    }
    console.warn(`Skipping invalid parquet file: ${file}`);
    return false;
  });

  if (validFiles.length === 0) {
    console.log(`No valid parquet files found in ${sourceDir}`);
    return;
  }

  console.log(`Found ${validFiles.length} valid parquet files in ${sourceDir}`);

  const db = await DuckDBInstance.create(':memory:');
  const conn = await db.connect();
  const fullTableName = `md.${schema}.${table}`;

  try {
    await conn.run('INSTALL motherduck;');
    await conn.run('LOAD motherduck;');
    await conn.run(`SET motherduck_token='${escapeSqlLiteral(token)}';`);
    await attachMotherDuckDatabase(conn, database);
    await conn.run(`CREATE SCHEMA IF NOT EXISTS md.${schema};`);

    const firstFile = toDuckPath(path.join(sourceDir, validFiles[0]));
    await conn.run(
      `CREATE TABLE IF NOT EXISTS ${fullTableName} AS SELECT * FROM read_parquet('${escapeSqlLiteral(firstFile)}') WHERE 1 = 0;`
    );

    if (truncateBeforeLoad) {
      await conn.run(`DELETE FROM ${fullTableName};`);
      console.log(`Cleared existing rows from ${fullTableName}`);
    }

    let totalLoaded = 0;
    for (const [index, file] of validFiles.entries()) {
      const parquetFile = toDuckPath(path.join(sourceDir, file));
      console.log(`[${index + 1}/${validFiles.length}] Loading ${file}...`);

      const insertSql =
        `INSERT INTO ${fullTableName} ` +
        `SELECT * FROM read_parquet('${escapeSqlLiteral(parquetFile)}', union_by_name=true);`;
      await conn.run(insertSql);

      const countResult = await conn.run(
        `SELECT count(*) AS cnt FROM read_parquet('${escapeSqlLiteral(parquetFile)}');`
      );
      const countRows = await countResult.getRows();
      const loaded = Number(countRows[0]?.[0] ?? 0);
      totalLoaded += loaded;
      console.log(`  -> ${loaded} rows loaded`);
    }

    const totalResult = await conn.run(`SELECT count(*) FROM ${fullTableName};`);
    const totalRows = await totalResult.getRows();
    const tableCount = Number(totalRows[0]?.[0] ?? 0);

    console.log(`Upload complete. Loaded rows this run: ${totalLoaded}`);
    console.log(`Current table row count (${fullTableName}): ${tableCount}`);
  } finally {
    conn.closeSync();
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});