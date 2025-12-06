import { spawn } from 'child_process';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { LoggerService } from './services/logger.service.js';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .envファイルをロード
dotenv.config();

const logger = new LoggerService();

/**
 * Rcloneコマンドが実行可能かチェックする
 */
async function checkRclone(): Promise<void> {
  return new Promise((resolve, reject) => {
    // 'rclone version' を実行してrcloneの存在を確認
    const rclone = spawn('rclone', ['version']);

    rclone.on('error', (err) => {
      logger.error('Rclone command not found. Please install Rclone and make sure it is in your PATH.');
      reject(err);
    });

    rclone.on('close', (code) => {
      if (code === 0) {
        logger.info('Rclone command is available.');
        resolve();
      } else {
        logger.error(`Rclone command failed with exit code ${code}.`);
        reject(new Error(`Rclone command failed with exit code ${code}.`));
      }
    });
  });
}

/**
 * Rcloneを使ってファイルをアップロードする
 * @param localPath ローカルファイルのパス
 * @param r2Path R2のパス (e.g. 'stock.duckdb')
 * @param bucketName R2バケット名
 * @param rcloneEnv Rclone実行用の環境変数
 */
async function uploadFileWithRclone(
  localPath: string,
  r2Path: string,
  bucketName: string,
  rcloneEnv: NodeJS.ProcessEnv
): Promise<void> {
  const remote = `R2:${bucketName}`;
  const destination = `${remote}/${r2Path}`;
  logger.info(`Uploading ${localPath} to ${destination} with Rclone...`);

  // ファイルの存在チェック
  try {
    await fs.access(localPath);
  } catch (error) {
    logger.error(`Error: Local file not found at ${localPath}`);
    if (localPath.endsWith('stock.duckdb')) {
      logger.error('Please run the data consolidation batch first.');
    }
    // このファイルのアップロードはスキップして処理を続ける
    return;
  }

  return new Promise((resolve, reject) => {
    const rclone = spawn('rclone', ['copyto', localPath, destination, '--progress'], {
      env: rcloneEnv,
      stdio: 'pipe',
    });

    rclone.stdout.on('data', (data) => {
      // rcloneのプログレスバーはstderrに出力されることが多いので、ここでは主に最終結果などをログに出す
      logger.info(data.toString().trim());
    });

    rclone.stderr.on('data', (data) => {
      // rcloneのプログレス表示はこちらに出力される
      process.stderr.write(data);
    });

    rclone.on('close', (code) => {
      if (code === 0) {
        logger.info(`Successfully uploaded ${localPath} to ${destination}.`);
        resolve();
      } else {
        const errorMsg = `Rclone upload failed for ${localPath} with exit code ${code}.`;
        logger.error(errorMsg);
        reject(new Error(errorMsg));
      }
    });
  });
}

/**
 * Rcloneを使ってディレクトリをアップロードする
 * @param localDir ローカルディレクトリのパス
 * @param r2Dir R2のディレクトリパス
 * @param bucketName R2バケット名
 * @param rcloneEnv Rclone実行用の環境変数
 */
async function uploadDirectoryWithRclone(
  localDir: string,
  r2Dir: string,
  bucketName: string,
  rcloneEnv: NodeJS.ProcessEnv
): Promise<void> {
  const remote = `R2:${bucketName}`;
  const destination = `${remote}/${r2Dir}`;
  logger.info(`Uploading directory ${localDir} to ${destination} with Rclone...`);

  // ディレクトリの存在チェック
  try {
    const stats = await fs.stat(localDir);
    if (!stats.isDirectory()) {
      logger.error(`Error: Local path is not a directory: ${localDir}`);
      return;
    }
  } catch (error) {
    logger.error(`Error: Local directory not found at ${localDir}`);
    return;
  }

  return new Promise((resolve, reject) => {
    // 'rclone copy' を使用してディレクトリを同期
    const rclone = spawn('rclone', ['copy', localDir, destination, '--progress'], {
      env: rcloneEnv,
      stdio: 'pipe',
    });

    rclone.stdout.on('data', (data) => {
      logger.info(data.toString().trim());
    });

    rclone.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    rclone.on('close', (code) => {
      if (code === 0) {
        logger.info(`Successfully uploaded directory ${localDir} to ${destination}.`);
        resolve();
      } else {
        const errorMsg = `Rclone upload failed for directory ${localDir} with exit code ${code}.`;
        logger.error(errorMsg);
        reject(new Error(errorMsg));
      }
    });
  });
}

async function main() {
  logger.info('--- Start Batch: Upload Data to R2 using Rclone ---');

  // Rcloneの存在確認
  await checkRclone();

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
    RCLONE_CONFIG_R2_ENDPOINT: `https://${accountId}.r2.cloudflarestorage.com`,
    RCLONE_CONFIG_R2_REGION: 'auto',
  };

  try {
    // DuckDBファイルをアップロード
    await uploadFileWithRclone(duckdbFilePath, r2DuckdbKey, bucketName, rcloneEnv);

    // data/processedディレクトリをアップロード
    await uploadDirectoryWithRclone(processedDir, r2ProcessedDir, bucketName, rcloneEnv);
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
