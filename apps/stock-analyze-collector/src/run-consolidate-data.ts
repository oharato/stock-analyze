/**
 * 収集したデータをDuckDBファイルに統合するバッチスクリプト
 */
import * as path from 'path';
import { fileURLToPath } from 'url';
import { LoggerService } from './services/logger.service.js';
import { DataConsolidationService } from './services/data-consolidation.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const logger = new LoggerService();
    logger.info('--- Start Batch: Consolidate Data to DuckDB ---');

    const dbPath = path.resolve(__dirname, '../../../data/stock.duckdb');
    const dataDir = path.resolve(__dirname, '../../../data');

    logger.info(`Database path: ${dbPath}`);
    logger.info(`Data directory: ${dataDir}`);

    const service = new DataConsolidationService(logger, dbPath, dataDir);

    try {
        await service.execute();
        logger.info('--- End Batch: Successfully finished ---');
    } catch (error: any) {
        logger.error('Batch failed', { error: error.message });
        if (error.stack) {
            logger.error('Stack trace:', { stack: error.stack });
        }
        process.exit(1);
    }
}

main();
