import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { DatabricksClient } from './services/databricks.client.js';

async function main() {
    const destinationDirRaw = process.env.DATABRICKS_DESTINATION_LARGE_SHAREHOLDINGS_PATH || '/Volumes/main/default/large_shareholdings';

    // Ensure destination path starts with / and removes trailing slash for consistency
    const destinationBaseDir = (destinationDirRaw.startsWith('/') ? destinationDirRaw : `/${destinationDirRaw}`).replace(/\/+$/, '');

    // Target directory
    const sourceDir = path.resolve('../../data/processed/large-shareholdings');
    if (!fs.existsSync(sourceDir)) {
        console.error(`Error: Source directory not found at ${sourceDir}`);
        process.exit(1);
    }

    const client = new DatabricksClient();

    const files = fs.readdirSync(sourceDir).filter(file => file.endsWith('.parquet'));
    console.log(`Found ${files.length} parquet files in ${sourceDir}`);
    console.log(`Destination Base Directory: ${destinationBaseDir}`);

    await client.ensureVolumeFromPath(`${destinationBaseDir}/placeholder`);

    for (const [index, file] of files.entries()) {
        const sourceFile = path.join(sourceDir, file);
        const destinationPath = `${destinationBaseDir}/${file}`;

        console.log(`[${index + 1}/${files.length}] Uploading ${file}...`);

        try {
            await client.uploadFile(sourceFile, destinationPath);
        } catch (error) {
            console.error(`Failed to upload ${file}:`, error);
        }
    }

    console.log('All uploads processed.');
}

main().catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
