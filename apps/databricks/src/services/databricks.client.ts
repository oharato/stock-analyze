import fs from 'fs';

export class DatabricksClient {
    private readonly host: string;
    private readonly token: string;

    constructor(host?: string, token?: string) {
        this.host = (host ?? process.env.DATABRICKS_HOST)?.replace(/\/+$/, '') || '';
        this.token = (token ?? process.env.DATABRICKS_TOKEN) || '';

        if (!this.host || !this.token) {
            throw new Error('DATABRICKS_HOST and DATABRICKS_TOKEN environment variables must be set.');
        }
    }

    public async uploadFile(sourceFile: string, destinationPath: string): Promise<void> {
        const fileStats = fs.statSync(sourceFile);
        // PUT /api/2.0/fs/files/Volumes/catalog/schema/volume/path/to/file
        const apiUrl = `${this.host}/api/2.0/fs/files${destinationPath}?overwrite=true`;

        const fileBuffer = fs.readFileSync(sourceFile);

        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.token}`,
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

    public async ensureVolumeExists(catalog: string, schema: string, volume: string): Promise<void> {
        const apiUrl = `${this.host}/api/2.1/unity-catalog/volumes`;
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
                'Authorization': `Bearer ${this.token}`,
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

    public async ensureVolumeFromPath(destinationPath: string): Promise<void> {
        // Parse path to extract catalog, schema, volume for auto-creation
        // Example: /Volumes/main/default/master/stock_list.parquet
        const pathParts = destinationPath.split('/');
        // pathParts[0] is empty (leading slash)
        // pathParts[1] is 'Volumes'
        if (pathParts[1] === 'Volumes' && pathParts.length >= 5) {
            const catalog = pathParts[2];
            const schema = pathParts[3];
            const volume = pathParts[4];

            try {
                await this.ensureVolumeExists(catalog, schema, volume);
            } catch (e) {
                console.warn(`Warning: Failed to ensure volume exists. Proceeding with upload anyway. Error: ${e}`);
            }
        }
    }
}
