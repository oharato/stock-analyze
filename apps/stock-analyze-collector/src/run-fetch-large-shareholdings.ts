
/**
 * 大量保有報告書取得バッチスクリプト
 */
import { LoggerService } from './services/logger.service.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { LargeShareholdingFetchService } from './services/large-shareholding-fetch.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from package root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
    const logger = new LoggerService();
    logger.info('--- Start Batch: Fetch Large Shareholding Reports ---');

    // 引数解析
    const argv = await yargs(hideBin(process.argv))
        .option('months', {
            alias: 'm',
            type: 'number',
            description: 'Months to look back (default: 3)',
            default: 3
        })
        .help()
        .argv;

    const months = argv.months;

    // データ保存先ディレクトリ
    const dataDir = path.resolve(__dirname, '../../../data/raw/large-shareholdings');
    const edinetDbPath = path.resolve(__dirname, '../../../data/edinet.db');

    // ディレクトリ作成
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    logger.info(`Data directory: ${dataDir}`);
    logger.info(`DB path: ${edinetDbPath}`);

    const apiKey = process.env.EDINET_API_KEY;
    if (!apiKey) {
        logger.warn('EDINET_API_KEY is not set. Using without API Key (stricter rate limits).');
    }

    try {
        const service = new LargeShareholdingFetchService(logger, apiKey, dataDir, edinetDbPath);
        await service.init();
        await service.processDateRange(months);

    } catch (e: any) {
        logger.error(`Batch failed: ${e.message}`);
        process.exit(1);
    }

    logger.info('--- End Batch: Successfully finished ---');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
