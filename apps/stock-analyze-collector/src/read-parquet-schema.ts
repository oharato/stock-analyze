import parquet from 'parquetjs';
import path from 'path';

async function main() {
    const code = process.argv[2] || '1301';
    // Correct path relative to apps/stock-analyze-collector
    const filePath = path.join(process.cwd(), '../../data/processed/fundamentals', `code=${code}`, 'fundamentals.parquet');
    console.log(`Reading schema from ${filePath}`);

    try {
        const reader = await parquet.ParquetReader.openFile(filePath);
        const schema = reader.getSchema();
        // Simplified schema output
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
