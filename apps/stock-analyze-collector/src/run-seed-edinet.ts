/**
 * EDINETのメタデータを取得し、ローカルDBを初期化するスクリプト。
 * 過去5年分（デフォルト）の書類リストを取得して保存します。
 */
import { LoggerService } from './services/logger.service.js';
import * as dotenv from 'dotenv';
import { EdinetInfoSeeder } from 'edinet-ts';
import * as path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const logger = new LoggerService();
    logger.info('--- Start Batch: Seed EDINET Metadata ---');

    // APIキーの確認
    const apiKey = process.env.EDINET_API_KEY;
    if (!apiKey) {
        logger.error('EDINET_API_KEY is not set. Please set it in .env file.');
        process.exit(1);
    }

    // 保存先パス設定
    const dbPath = path.resolve(__dirname, '../../../data/edinet.db');
    logger.info(`Database path: ${dbPath}`);

    // EdinetInfoSeederの初期化
    const seeder = new EdinetInfoSeeder({
        apiKey,
        dbPath,
        // デフォルトで過去5年分取得
        onProgress: (processed: number, total: number) => {
            if (processed % 10 === 0 || processed === total) {
                logger.info(`Progress: ${processed}/${total} days processed.`);
            }
        },
        onError: (error: unknown, dateStr: string) => {
            const msg = error instanceof Error ? error.message : String(error);
            logger.warn(`Error processing date ${dateStr}: ${msg}`);
        }
    });

    try {
        logger.info('Starting seeding process... (This may take a while)');
        await seeder.run();
        logger.info('--- End Batch: Seeding Completed ---');
    } catch (error: any) {
        logger.error('Batch failed', { error: error.message });
        if (error.stack) {
            logger.error('Stack trace', { stack: error.stack });
        }
        process.exit(1);
    }
}

main();
