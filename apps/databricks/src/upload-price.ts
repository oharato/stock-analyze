import fs from 'fs';
import path from 'path';
import 'dotenv/config';

async function main() {
    const host = process.env.DATABRICKS_HOST?.replace(/\/+$/, ''); // Remove trailing slash
    const token = process.env.DATABRICKS_TOKEN;
    // This should now be a directory path
    const destinationDirRaw = process.env.DATABRICKS_DESTINATION_PATH || '/Volumes/main/default/prices';

    if (!host || !token) {
        console.error('Error: DATABRICKS_HOST and DATABRICKS_TOKEN environment variables must be set.');
        process.exit(1);
    }

    // Ensure destination path starts with / and removes trailing slash for consistency
    const destinationBaseDir = (destinationDirRaw.startsWith('/') ? destinationDirRaw : `/${destinationDirRaw}`).replace(/\/+$/, '');

    // Target directory
    const sourceDir = path.resolve('../../data/processed/prices');
    if (!fs.existsSync(sourceDir)) {
        console.error(`Error: Source directory not found at ${sourceDir}`);
        process.exit(1);
    }

    const files = fs.readdirSync(sourceDir).filter(file => file.endsWith('.parquet'));
    console.log(`Found ${files.length} parquet files in ${sourceDir}`);
    console.log(`Destination Base Directory: ${host}${destinationBaseDir}`);

    for (const [index, file] of files.entries()) {
        const sourceFile = path.join(sourceDir, file);
        const destinationPath = `${destinationBaseDir}/${file}`;

        console.log(`[${index + 1}/${files.length}] Uploading ${file}...`);

        try {
            await uploadFile(host, token, sourceFile, destinationPath);
        } catch (error) {
            console.error(`Failed to upload ${file}:`, error);
            // Continue to verify other files or stop? Let's log and continue for now.
        }
    }

    console.log('All uploads processed.');
}

async function uploadFile(host: string, token: string, sourceFile: string, destinationPath: string) {
    const fileStats = fs.statSync(sourceFile);
    // PUT /api/2.0/fs/files/Volumes/catalog/schema/volume/path/to/file
    const apiUrl = `${host}/api/2.0/fs/files${destinationPath}?overwrite=true`;

    // For large files (e.g. >100MB), stream/chunking might be needed, but parquet files here are likely small.
    // Reading into buffer for simplicity.
    const fileBuffer = fs.readFileSync(sourceFile);

    const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/octet-stream',
            'Content-Length': fileStats.size.toString()
        },
        body: fileBuffer
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
    }
}

main().catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
