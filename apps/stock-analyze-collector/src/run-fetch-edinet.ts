/**
 * EDINETからデータを取得し、保存するバッチスクリプト
 */
import { LoggerService } from './services/logger.service.js';
import { EdinetExtractor, EdinetDataWithVectors } from './services/edinet-extractor.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import { EdinetXbrlDownloader, EdinetXbrlParser, EdinetDocumentType } from 'edinet-ts';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// @xenova/transformers は動的インポート または require が必要になる場合があるが
// 型定義のために import type を使い、実行時は dynamic import を使用する
// またはそのまま import しても環境によっては動作する。
// ここではシンプルに import を試み、エラーが出たら dynamic import に切り替える戦略をとるが
// Node.js環境での実行を前提としているため、require または import でいけるはず。
// しかし、ESMプロジェクトのようなので dynamic import が無難。
// let pipeline: any; // Lazy load

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FetchOptions {
    ticker: string;
    years: number;
}

async function main() {
    const logger = new LoggerService();
    logger.info('--- Start Batch: Fetch EDINET Data with Vectorization ---');

    // 引数解析
    const argv = await yargs(hideBin(process.argv))
        .option('ticker', {
            alias: 't',
            type: 'string',
            description: 'Ticker symbol (e.g. 7203)',
            demandOption: true
        })
        .option('years', {
            alias: 'y',
            type: 'number',
            description: 'Number of years to look back',
            default: 1
        })
        .help()
        .argv;

    const ticker = argv.ticker;
    const years = argv.years;

    // データ保存先ディレクトリ
    const dataDir = path.resolve(__dirname, '../../../data/raw/edinet');
    logger.info(`Data directory: ${dataDir}`);

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // APIキーの確認
    const apiKey = process.env.EDINET_API_KEY;
    if (!apiKey) {
        logger.warn('EDINET_API_KEY is not set. Rate limits will be stricter.');
    }

    // Embeddings モデルの初期化
    logger.info('Initializing vectorization model (Xenova/paraphrase-multilingual-MiniLM-L12-v2)...');
    // Dynamic import to avoid issues if module resolution varies
    const { pipeline } = await import('@xenova/transformers');
    const extractor = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');

    // Initialize Service
    const extractorService = new EdinetExtractor(logger, extractor);

    // ダウンローダー初期化
    const downloader = new EdinetXbrlDownloader({
        apiKey,
        rootDir: dataDir,
        enableRateLimit: true,
        requestsPerSecond: 3
    });

    const parser = new EdinetXbrlParser();


    let currentDate = new Date();

    const targetSecCode = ticker + '0'; // EDINET usually uses Ticker + '0'
    let foundDocsCount = 0;

    for (let i = 0; i < years; i++) {
        // Calculate period for this year chunk (going backwards)
        // i=0: [today - 1yr, today]
        // i=1: [today - 2yr, today - 1yr]
        // Actually, simple year-by-year boundaries are easier

        const endDateObj = new Date();
        endDateObj.setFullYear(endDateObj.getFullYear() - i);
        const startDateObj = new Date();
        startDateObj.setFullYear(startDateObj.getFullYear() - i - 1);
        startDateObj.setDate(startDateObj.getDate() + 1); // Avoid overlap? 

        // Format YYYY-MM-DD
        const formatDate = (d: Date) => d.toISOString().split('T')[0];
        const startStr = formatDate(startDateObj);
        const endStr = formatDate(endDateObj);

        logger.info(`Searching Annual Report in period: ${startStr} ~ ${endStr} for ticker: ${ticker} (${targetSecCode})...`);

        try {
            // Use searchPeriod to find all annual reports in this range
            const allDocs = await downloader.searchPeriod(startStr, endStr, EdinetDocumentType.AnnualCards);

            // Filter by ticker
            const targetDocs = allDocs.filter(d => d.secCode === targetSecCode);

            if (targetDocs.length === 0) {
                logger.info(`No documents found in this period.`);
                continue;
            }

            logger.info(`Found ${targetDocs.length} document(s). Processing...`);

            for (const doc of targetDocs) {
                const docDate = doc.date || (doc.submitDateTime ? doc.submitDateTime.split(' ')[0] : undefined);

                if (!docDate) {
                    logger.warn(`Skipping document (DocID: ${doc.docID}) due to missing date.`);
                    continue;
                }

                logger.info(`Processing document: ${doc.docDescription} (DocID: ${doc.docID}, Date: ${docDate})`);

                const filename = `${ticker}-${docDate}-${doc.docID}.json`;
                const filePath = path.join(dataDir, filename);

                if (fs.existsSync(filePath)) {
                    logger.info(`File already exists: ${filePath}. Skipping.`);
                    foundDocsCount++;
                    continue;
                }

                const xbrlText = await downloader.fetchXbrl(doc.docID);
                if (!xbrlText) {
                    logger.error(`Failed to fetch XBRL text for DocID: ${doc.docID}`);
                    continue;
                }

                const xbrlData = parser.parse(xbrlText);
                const saveData = await extractorService.process(ticker, doc, xbrlData, xbrlText);

                fs.writeFileSync(filePath, JSON.stringify(saveData, null, 2), 'utf-8');
                logger.info(`Saved data with vectors to ${filePath}`);
                foundDocsCount++;
            }

        } catch (e: any) {
            logger.error(`Error searching period ${startStr}~${endStr}: ${e.message}`);
        }
    }

    if (foundDocsCount === 0) {
        logger.warn('No documents found in the specified range. Check ticker or range.');
    }

    logger.info('--- End Batch: Successfully finished ---');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
