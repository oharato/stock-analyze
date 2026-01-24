/**
 * EDINETからデータを取得し、保存するバッチスクリプト
 */
import { LoggerService } from './services/logger.service.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { EdinetFetchService } from './services/edinet-fetch.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from package root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
    const logger = new LoggerService();
    logger.info('--- Start Batch: Fetch EDINET Data with Vectorization ---');

    // 引数解析
    const argv = await yargs(hideBin(process.argv))
        .option('ticker', {
            alias: 't',
            type: 'string',
            description: 'Ticker symbol (e.g. 7203). If omitted, fetches all tickers.',
            demandOption: false
        })
        .option('months', {
            alias: 'm',
            type: 'number',
            description: 'Number of months to look back',
            default: 60
        })
        .help()
        .argv;

    const ticker = argv.ticker;
    const months = argv.months;

    // データ保存先ディレクトリ
    const dataDir = path.resolve(__dirname, '../../../data/raw/edinet');
    const edinetDbPath = path.resolve(__dirname, '../../../data/edinet.db');
    logger.info(`Data directory: ${dataDir}`);
    logger.info(`DB path: ${edinetDbPath}`);

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // APIキーの確認
    const apiKey = process.env.EDINET_API_KEY;
    if (!apiKey) {
        logger.warn('EDINET_API_KEY is not set. Rate limits will be stricter.');
    }

    // Serviceの初期化と実行
    try {
        const service = new EdinetFetchService(logger, apiKey, dataDir, edinetDbPath);
        await service.init();

        if (ticker) {
            await service.processTicker(ticker, months);
        } else {
            if (!apiKey) {
                logger.error('EDINET_API_KEY is required for processing all tickers (due to Seeding). Please set it in .env.');
                process.exit(1);
            }
            await service.processAll(months);
        }

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
