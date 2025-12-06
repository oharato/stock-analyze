import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { LoggerService } from './logger.service.js';

export class RcloneService {
    constructor(private readonly logger: LoggerService) { }

    /**
     * Check if Rclone command is executable.
     */
    public async checkRclone(): Promise<void> {
        return new Promise((resolve, reject) => {
            const rclone = spawn('rclone', ['version']);

            rclone.on('error', (err) => {
                this.logger.error('Rclone command not found. Please install Rclone and make sure it is in your PATH.');
                reject(err);
            });

            rclone.on('close', (code) => {
                if (code === 0) {
                    this.logger.info('Rclone command is available.');
                    resolve();
                } else {
                    this.logger.error(`Rclone command failed with exit code ${code}.`);
                    reject(new Error(`Rclone command failed with exit code ${code}.`));
                }
            });
        });
    }

    /**
     * Upload a file using Rclone.
     * @param localPath Path to the local file
     * @param r2Path Remote path in R2 (e.g. 'stock.duckdb')
     * @param bucketName R2 bucket name
     * @param rcloneEnv Environment variables for Rclone execution
     */
    public async uploadFile(
        localPath: string,
        r2Path: string,
        bucketName: string,
        rcloneEnv: NodeJS.ProcessEnv
    ): Promise<void> {
        const remote = `R2:${bucketName}`;
        const destination = `${remote}/${r2Path}`;
        this.logger.info(`Uploading ${localPath} to ${destination} with Rclone...`);

        try {
            await fs.access(localPath);
        } catch (error) {
            this.logger.error(`Error: Local file not found at ${localPath}`);
            throw error;
        }

        return new Promise((resolve, reject) => {
            const rclone = spawn('rclone', ['copyto', localPath, destination, '--progress'], {
                env: rcloneEnv,
                stdio: 'pipe',
            });

            rclone.stdout.on('data', (data) => {
                this.logger.info(data.toString().trim());
            });

            rclone.stderr.on('data', (data) => {
                process.stderr.write(data);
            });

            rclone.on('close', (code) => {
                if (code === 0) {
                    this.logger.info(`Successfully uploaded ${localPath} to ${destination}.`);
                    resolve();
                } else {
                    const errorMsg = `Rclone upload failed for ${localPath} with exit code ${code}.`;
                    this.logger.error(errorMsg);
                    reject(new Error(errorMsg));
                }
            });
        });
    }

    /**
     * Upload a directory using Rclone.
     * @param localDir Path to the local directory
     * @param r2Dir Remote directory path in R2
     * @param bucketName R2 bucket name
     * @param rcloneEnv Environment variables for Rclone execution
     */
    public async uploadDirectory(
        localDir: string,
        r2Dir: string,
        bucketName: string,
        rcloneEnv: NodeJS.ProcessEnv
    ): Promise<void> {
        const remote = `R2:${bucketName}`;
        const destination = `${remote}/${r2Dir}`;
        this.logger.info(`Uploading directory ${localDir} to ${destination} with Rclone...`);

        try {
            const stats = await fs.stat(localDir);
            if (!stats.isDirectory()) {
                this.logger.error(`Error: Local path is not a directory: ${localDir}`);
                throw new Error(`Local path is not a directory: ${localDir}`);
            }
        } catch (error) {
            this.logger.error(`Error: Local directory not found at ${localDir}`);
            throw error;
        }

        return new Promise((resolve, reject) => {
            const rclone = spawn('rclone', ['copy', localDir, destination, '--progress'], {
                env: rcloneEnv,
                stdio: 'pipe',
            });

            rclone.stdout.on('data', (data) => {
                this.logger.info(data.toString().trim());
            });

            rclone.stderr.on('data', (data) => {
                process.stderr.write(data);
            });

            rclone.on('close', (code) => {
                if (code === 0) {
                    this.logger.info(`Successfully uploaded directory ${localDir} to ${destination}.`);
                    resolve();
                } else {
                    const errorMsg = `Rclone upload failed for directory ${localDir} with exit code ${code}.`;
                    this.logger.error(errorMsg);
                    reject(new Error(errorMsg));
                }
            });
        });
    }
}
