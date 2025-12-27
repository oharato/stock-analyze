/**
 * 収集したデータをDuckDBファイルに統合するバッチスクリプト
 * Semantic Data Fabric (SDF) を使用してロジックを簡素化
 */
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { LoggerService } from './services/logger.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

async function main() {
    const logger = new LoggerService();
    // Parse arguments
    const argv = await yargs(hideBin(process.argv))
        .option('table', {
            alias: 't',
            type: 'string',
            description: 'Execute only for the specified table (e.g. edinet, prices)',
        })
        .help()
        .parse();



    const targetTable = argv.table;

    logger.info('--- バッチ開始: DuckDBへのデータ統合 (SDF) ---');
    if (targetTable) {
        logger.info(`対象テーブル: ${targetTable}`);
    }

    // パスの定義
    const projectRoot = path.resolve(__dirname, '..');
    const sdfBin = path.join(projectRoot, '.bin/sdf');
    const workspaceDir = path.join(projectRoot, 'sdf');

    logger.info(`SDFバイナリ: ${sdfBin}`);
    logger.info(`ワークスペース: ${workspaceDir}`);

    try {
        // Prepare stock_list.ndjson for SDF
        // Only run if we are running the whole thing OR if the user specifically requested stock_list related tables?
        // Actually, converting stock_list.json to NDJSON is fast and safe to do every time generally.
        // It acts as a source for 'stock_list' table.
        const stockListJsonPath = path.resolve(__dirname, '../../../data/master/stock_list.json');
        const stockListNdjsonPath = path.resolve(__dirname, '../../../data/master/stock_list.ndjson');

        logger.info('stock_list.json を NDJSON に変換中...');
        const fs = await import('fs');
        if (fs.existsSync(stockListJsonPath)) {
            const stockListData = JSON.parse(fs.readFileSync(stockListJsonPath, 'utf-8'));
            if (Array.isArray(stockListData)) {
                const ndjsonContent = stockListData.map((item: any) => JSON.stringify(item)).join('\n');
                fs.writeFileSync(stockListNdjsonPath, ndjsonContent);
                logger.info(`変換完了: ${stockListNdjsonPath}`);
            } else {
                logger.warn('stock_list.json が配列ではありません。変換をスキップします。');
            }
        } else {
            logger.warn(`stock_list.json が見つかりません: ${stockListJsonPath}`);
        }

        // SDFの実行
        logger.info('SDFを実行中...');

        let command = `${sdfBin} run`;
        if (targetTable) {
            command += ` ${targetTable}`;
        }

        // execSyncは標準出力を継承して実行
        logger.info(`コマンド実行: ${command}`);
        execSync(command, { stdio: 'inherit', cwd: workspaceDir });

        logger.info('--- バッチ終了: SDF実行完了 ---');

        // 注記: データは現在SDFの内部ストレージまたは設定された出力先にあります。
        // もし他のサービスで 'data/stock.duckdb' が必要な場合は、エクスポートが必要になる可能性があります。
        // 現時点では、SDFへの移行またはSDFが出力先に書き込むことを想定しています。
        // (現在の実装は .sdf/data でローカルに実行されます)

    } catch (error: any) {
        logger.error('バッチ処理に失敗しました', { error: error.message });
        // execSyncはステータスコード付きでエラーをスローする
        process.exit(1);
    }
}

main();
