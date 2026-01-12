import fs from 'fs';
import path from 'path';
import 'dotenv/config';

async function main() {
    const host = process.env.DATABRICKS_HOST?.replace(/\/+$/, ''); // Remove trailing slash
    const token = process.env.DATABRICKS_TOKEN;
    const destinationPathRaw = process.env.DATABRICKS_DESTINATION_STOCK_LIST || '/Volumes/main/default/master/stock_list.parquet';

    if (!host || !token) {
        console.error('Error: DATABRICKS_HOST and DATABRICKS_TOKEN environment variables must be set.');
        process.exit(1);
    }

    // Ensure destination path starts with /
    const destinationPath = destinationPathRaw.startsWith('/') ? destinationPathRaw : `/${destinationPathRaw}`;

    // Target file
    const sourceFile = path.resolve('../../data/master/stock_list.parquet');

    if (!fs.existsSync(sourceFile)) {
        console.error(`Error: Source file not found at ${sourceFile}`);
        process.exit(1);
    }

    console.log(`Uploading ${sourceFile} to ${host}${destinationPath}...`);

    // Parse path to extract catalog, schema, volume for auto-creation
    // Example: /Volumes/main/default/master/stock_list.parquet
    const pathParts = destinationPath.split('/');
    // pathParts[0] is empty (leading slash)
    // pathParts[1] is 'Volumes'
    if (pathParts[1] === 'Volumes' && pathParts.length >= 5) {
        const catalog = pathParts[2];
        const schema = pathParts[3];
        const volume = pathParts[4];
        console.log(`Target Volume: ${catalog}.${schema}.${volume}`);

        try {
            await ensureVolumeExists(host, token, catalog, schema, volume);
        } catch (e) {
            console.warn(`Warning: Failed to ensure volume exists. Proceeding with upload anyway. Error: ${e}`);
        }
    }

    try {
        const fileStats = fs.statSync(sourceFile);

        // Using Databricks Files API for Volumes
        // PUT /api/2.0/fs/files/Volumes/catalog/schema/volume/path/to/file
        const apiUrl = `${host}/api/2.0/fs/files${destinationPath}?overwrite=true`;

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

        console.log('Upload successful!');
    } catch (error) {
        console.error('Upload failed:', error);
        process.exit(1);
    }
}

async function ensureVolumeExists(host: string, token: string, catalog: string, schema: string, volume: string) {
    const apiUrl = `${host}/api/2.1/unity-catalog/volumes`;
    const payload = {
        catalog_name: catalog,
        schema_name: schema,
        name: volume,
        volume_type: 'MANAGED'
    };

    console.log(`Attempting to create volume '${volume}' in ${catalog}.${schema}...`);

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (response.ok) {
        console.log(`Volume '${volume}' created successfully.`);
        return;
    }

    const responseData = await response.json();
    // Check if volume already exists
    if (response.status === 409 || (responseData.error_code === 'RESOURCE_ALREADY_EXISTS')) {
        console.log(`Volume '${volume}' already exists.`);
        return;
    }

    // Other error
    throw new Error(`Failed to create volume: ${JSON.stringify(responseData)}`);
}

main().catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
