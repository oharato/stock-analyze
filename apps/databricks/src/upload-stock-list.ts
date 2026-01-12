import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { DatabricksClient } from './services/databricks.client.js';

async function main() {
    const destinationPathRaw = process.env.DATABRICKS_DESTINATION_STOCK_LIST || '/Volumes/main/default/master/stock_list.parquet';

    // Ensure destination path starts with /
    const destinationPath = destinationPathRaw.startsWith('/') ? destinationPathRaw : `/${destinationPathRaw}`;

    // Target file
    const sourceFile = path.resolve('../../data/master/stock_list.parquet');

    if (!fs.existsSync(sourceFile)) {
        console.error(`Error: Source file not found at ${sourceFile}`);
        process.exit(1);
    }

    const client = new DatabricksClient();

    console.log(`Uploading ${sourceFile} to ${destinationPath}...`);

    await client.ensureVolumeFromPath(destinationPath);

    try {
        await client.uploadFile(sourceFile, destinationPath);
        console.log('Upload successful!');
    } catch (error) {
        console.error('Upload failed:', error);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
