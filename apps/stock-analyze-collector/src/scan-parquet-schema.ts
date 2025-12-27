import parquet from 'parquetjs';
import path from 'path';
import fs from 'fs';

async function main() {
    const baseDir = path.join(process.cwd(), '../../data/processed/fundamentals');
    // Get all code= directories
    const dirs = fs.readdirSync(baseDir).filter(d => d.startsWith('code=')).slice(0, 50); // Scan first 50

    console.log(`Scanning ${dirs.length} directories...`);

    for (const dir of dirs) {
        const filePath = path.join(baseDir, dir, 'fundamentals.parquet');
        if (!fs.existsSync(filePath)) continue;

        try {
            const reader = await parquet.ParquetReader.openFile(filePath);
            const schema = reader.getSchema();
            const assetsField = schema.fields['総資産'];
            const assetsType = assetsField ? assetsField.primitiveType : 'MISSING';

            if (assetsType !== 'DOUBLE') {
                console.log(`[MISMATCH] ${dir}: 総資産 type is ${assetsType}`);
            }

            await reader.close();
        } catch (e) {
            // ignore
        }
    }
    console.log('Scan complete.');
}

main();
