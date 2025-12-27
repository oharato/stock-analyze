import parquet from 'parquetjs';
import path from 'path';
import fs from 'fs';

async function main() {
    const code = process.argv[2] || '1301';
    const dirPath = path.join(process.cwd(), '../../data/processed/prices', `code=${code}`);

    // Find first parquet file
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.parquet'));
    if (files.length === 0) {
        console.log('No parquet files found');
        return;
    }
    const filePath = path.join(dirPath, files[files.length - 1]); // Take latest

    console.log(`Reading schema from ${filePath}`);

    try {
        const reader = await parquet.ParquetReader.openFile(filePath);
        const schema = reader.getSchema();
        const cleanSchema = Object.fromEntries(
            Object.entries(schema.fields).map(([k, v]) => [k, v.primitiveType])
        );
        console.log(JSON.stringify(cleanSchema, null, 2));
        await reader.close();
    } catch (e) {
        console.error(e);
    }
}

main();
