/**
 * 生成されたDuckDBファイルと処理済みデータを、Rcloneを使用してCloudflare R2にアップロードするバッチスクリプト
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import { LoggerService } from './services/logger.service.js';
import { RcloneService } from './services/rclone.service.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .envファイルをロード
dotenv.config();

const logger = new LoggerService();
const rcloneService = new RcloneService(logger);

async function main() {
  logger.info('--- Start Batch: Upload Data to R2 using Rclone ---');

  // Rcloneの存在確認
  await rcloneService.checkRclone();

  // 環境変数から設定を読み込み
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const duckdbFilePath = path.resolve(__dirname, '../../../data/stock.duckdb');
  const processedDir = path.resolve(__dirname, '../../../data/processed');
  const r2DuckdbKey = 'stock.duckdb';
  const r2ProcessedDir = 'processed';

  // 必須の環境変数が設定されているか確認
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error(
      'Missing required environment variables: CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME'
    );
  }

  // Rclone用の環境変数を設定
  const rcloneEnv = {
    ...process.env,
    RCLONE_CONFIG_R2_TYPE: 's3',
    RCLONE_CONFIG_R2_PROVIDER: 'Cloudflare',
    RCLONE_CONFIG_R2_ACCESS_KEY_ID: accessKeyId,
    RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: secretAccessKey,
    RCLONE_CONFIG_R2_ENDPOINT: process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`,
    RCLONE_CONFIG_R2_REGION: 'auto',
  };

  try {
    // DuckDBファイルをアップロード
    try {
      await rcloneService.uploadFile(duckdbFilePath, r2DuckdbKey, bucketName, rcloneEnv);
    } catch (e) {
      if (duckdbFilePath.endsWith('stock.duckdb')) {
        logger.error('Please run the data consolidation batch first.');
      }
    }

    // data/processedディレクトリをアップロード
    try {
      await rcloneService.uploadDirectory(processedDir, r2ProcessedDir, bucketName, rcloneEnv);
    } catch (e) {
      // Directory upload error is already logged by service
    }

  } catch (error: any) {
    logger.error(`Failed to upload files to R2 with Rclone:`);
    // エラーの詳細は各関数でログに出力されているので、ここではスタックトレースのみ出力
    console.error(error);
    process.exit(1);
  }

  logger.info('--- End Batch: Successfully finished ---');
}

main().catch((error) => {
  // main関数内で捕捉されなかった予期せぬエラー
  logger.error('Batch failed unexpectedly. See error details below:');
  console.error(error);
  process.exit(1);
});
