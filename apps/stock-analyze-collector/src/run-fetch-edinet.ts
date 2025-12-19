/**
 * EDINETからデータを取得し、保存するバッチスクリプト
 */
import { LoggerService } from './services/logger.service.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import { EdinetXbrlDownloader, EdinetXbrlParser, EdinetDocumentType } from 'edinet-ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const logger = new LoggerService();
    logger.info('--- Start Batch: Fetch EDINET Data ---');

    // データ保存先ディレクトリ
    const dataDir = path.resolve(__dirname, '../../../data/raw/edinet');
    logger.info(`Data directory: ${dataDir}`);

    // 保存先ディレクトリがなければ作成
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // APIキーの確認
    const apiKey = process.env.EDINET_API_KEY;
    if (!apiKey) {
        logger.warn('EDINET_API_KEY is not set. Rate limits will be stricter.');
    } else {
        logger.info(`API Key loaded. Length: ${apiKey.length}, First 4 chars: ${apiKey.substring(0, 4)}`);
    }

    // ライブラリの初期化
    const downloader = new EdinetXbrlDownloader({
        apiKey,
        rootDir: dataDir,
        enableRateLimit: true,
        requestsPerSecond: 1 // 1秒1リクエスト（必要に応じて調整）
    });

    // パーサーのバグ回避や設定が必要な場合はここで調整
    // EdinetXbrlParserのコンストラクタ引数は現状なさそう
    const parser = new EdinetXbrlParser();

    // 取得対象の銘柄コード（例: トヨタ自動車 7203）
    const ticker = '7203';
    const lookbackDays = 365 * 2; // 過去2年分検索

    try {
        logger.info(`Searching latest Annual Report (Yuho) for ticker: ${ticker}...`);

        // 最新の有価証券報告書を検索
        // AnnualCards = 有価証券報告書
        const doc = await downloader.findLatest(ticker, EdinetDocumentType.AnnualCards, lookbackDays);

        if (!doc) {
            logger.warn(`No Annual Report found for ${ticker} in the last ${lookbackDays} days.`);
            return;
        }

        logger.info(`Found document: ${doc.docDescription} (DocID: ${doc.docID}, Date: ${doc.date})`);

        // ファイル名の生成
        // 例: 7203-2024-06-25-S100XXXX.json
        const filename = `${ticker}-${doc.date}-${doc.docID}.json`;
        const filePath = path.join(dataDir, filename);

        if (fs.existsSync(filePath)) {
            logger.info(`File already exists: ${filePath}. Skipping download.`);
            return;
        }

        logger.info(`Downloading and parsing XBRL for DocID: ${doc.docID}...`);

        // XBRLテキストを取得
        const xbrlText = await downloader.fetchXbrl(doc.docID);

        if (!xbrlText) {
            throw new Error(`Failed to fetch XBRL text for DocID: ${doc.docID}`);
        }

        // XMLをパースしてJSONオブジェクトへ変換
        const xbrlData = parser.parse(xbrlText);

        // ファイルに保存
        fs.writeFileSync(filePath, JSON.stringify(xbrlData, null, 2), 'utf-8');
        logger.info(`Saved parsed JSON to ${filePath}`);

        logger.info('--- End Batch: Successfully finished ---');

    } catch (error: any) {
        logger.error('Batch failed', { error: error.message });
        if (error.stack) logger.error('Stack trace', { stack: error.stack });
        process.exit(1);
    }
}

main();
