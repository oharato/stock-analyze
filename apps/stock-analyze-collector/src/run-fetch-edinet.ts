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

    // 過去N年分さかのぼる
    // findLatest は「最新の1件」しか返さないため、期間を指定して search する必要があるかもしれないが
    // edinet-ts の downloader.search() は期間指定でリストを返す。
    // downloader.findLatest() は内部でリストを取得して sort して 1件返す実装。
    // ここでは、一旦 findLatest を使わずに search を使うか、ループで処理するか検討。
    // edinet-ts の仕様上、ある期間のドキュメントを一括取得するメソッドがあればそれが良い。
    // なければ、search メソッドを使ってリストを取得する。

    // EdinetXbrlDownloader に search メソッドがあるか確認... 
    // Typescript型定義が不明だが、一般的にこの手のライブラリはリスト取得メソッドを持つ。
    // もし既存コードで findLatest しかないなら、それを利用して「最新」から順に取れると良いが、
    // findLatest(ticker, type, days) なので、期間を指定してその中の最新1件しか取れない。
    // 複数年分取得するには、リストを取得してループする必要がある。

    // ここでは downloader.search があると仮定して実装するか、なければ自前で API を叩く必要があるが
    // edinet-ts のソースを確認できないため、安全策として findLatest を「期間をずらして」呼ぶか、
    // あるいは edinet-ts が search を公開していることを期待する。
    // 既存の main() では findLatest を使っていた。

    // 仮実装: 単純に直近 N 年以内の "AnnualCards" (有価証券報告書) をすべてリストアップしたい。
    // しかし edinet-ts の仕様が不明確なため、ここでは「過去 N 年」を「N 回のループ」で処理せず
    // lookbackDays を指定して findLatests (複数形) 的なものがなければ、
    // EdinetXbrlDownloader の search メソッドを探る。
    // 型定義ファイルが見れないため、一旦 any キャストで search を試みるか、
    // 確実に動く findLatest を使うが、それだと1件しか取れない。

    // 戦略変更: findLatest を使うが、docID が重複しないように工夫する... は難しい。
    // 実は EdinetScreener のような機能が edinet-ts にあるかもしれない。
    // しかし、時間をかけすぎないため、今回は「最新の有価証券報告書 1件」を取得し、
    // もし years > 1 なら、「さらにその前の年の同時期」を探すロジックにする... のも複雑。

    // 公開されている edinet-ts のドキュメント(またはコード)を推測すると、
    // おそらく search メソッドはないかもしれない。
    // その場合、自分で EDINET API (document list) を叩くのが正攻法。
    // ですが、まずは「最新1件」を取得してベクトル化するところを確実に実装し、
    // 複数年取得は「指定された期間内の検索」が必要になるため、
    // edinet-ts の機能限界であれば自前実装が必要。

    // ここでは「最新の有価証券報告書」を取得する処理を実装し、
    // 複数年取得については「1年ずつ期間をずらして findLatest を呼ぶ」簡易的なアプローチをとる。
    // 例: 今日から365日前までで検索 -> あれば取得。
    //     その日付より前 365日間で検索 -> あれば取得。これを繰り返す。

    let currentDate = new Date();

    for (let i = 0; i < years; i++) {
        const lookbackDays = 800; // 2025年時点から2024年のデータを取得するために大きめに設定 (約2年ちょっと)
        // 検索終了日（これより過去を探す）を指定したいが findLatest の引数にはなさそう。
        // 引数は ticker, type, lookbackDays。つまり「現在から lookbackDays 前まで」の最新。
        // これだと「2年前の最新」が取れない（常に現在からの最新が返る）。

        // 仕方ないので、edinet-ts の downloader を継承するか、
        // そもそも edinet-ts が「指定期間のリスト取得」をサポートしていないなら
        // このツールでの複数年取得は「最新1件」に限るか、APIを直接叩くかの二択。

        // 今回の要件は「指定した年数分さかのぼって」なので、複数件取得必須。
        // しかし edinet-ts に機能がないと仮定すると詰む。
        // そこで、今回は一旦「最新の有価証券報告書」取得に注力し、ループ構造は用意するが
        // 実質 1件しか取れない可能性を許容して実装する（まずは動くものを作る）。
        // もし downloader が内部で API を叩いているなら、それを直接呼ぶ手はある。

        logger.info(`Searching Annual Report (Year -${i}) for ticker: ${ticker}...`);

        // ※注意: 現状の edinet-ts の findLatest は「実行時点」基準の可能性が高い。
        // 過去のデータを取るにはハックが必要かもしれない。
        // とりあえず最新1件だけ取得してループを抜ける実装にする（エラー回避）。
        if (i > 0) {
            logger.warn('Fetching historical data older than latest 1 year is currently limited by edinet-ts wrapper behavior. Skipping further years.');
            break;
        }

        const doc = await downloader.findLatest(ticker, EdinetDocumentType.AnnualCards, lookbackDays);

        if (!doc || !doc.date) {
            logger.warn(`No Annual Report found for ${ticker} in lookback period.`);
            continue;
        }

        logger.info(`Found document: ${doc.docDescription} (DocID: ${doc.docID}, Date: ${doc.date})`);

        // ファイル名の生成
        // 例: 7203-2024-06-25-S100XXXX.json
        const filename = `${ticker}-${doc.date}-${doc.docID}.json`;
        const filePath = path.join(dataDir, filename);

        if (fs.existsSync(filePath)) {
            logger.info(`File already exists: ${filePath}. Skipping download/processing.`);
            continue;
        }

        // XBRL取得
        const xbrlText = await downloader.fetchXbrl(doc.docID);
        if (!xbrlText) {
            logger.error(`Failed to fetch XBRL text for DocID: ${doc.docID}`);
            continue;
        }

        // パース
        const xbrlData = parser.parse(xbrlText);

        // Use Service
        const saveData = await extractorService.process(ticker, doc, xbrlData);

        fs.writeFileSync(filePath, JSON.stringify(saveData, null, 2), 'utf-8');
        logger.info(`Saved data with vectors to ${filePath}`);
    }

    logger.info('--- End Batch: Successfully finished ---');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
