import { EdinetFinancial } from 'stock-analyze-domain';
import * as fs from 'fs';
import * as path from 'path';
import { EdinetDocumentType, EdinetRepository } from 'edinet-ts';
import { LoggerService } from './logger.service.js';
import { EdinetCommonService } from './edinet-common.service.js';
import { VectorizationService } from './vectorization.service.js';
import { EdinetProcessorService } from './edinet-processor.service.js';
import pLimit from 'p-limit';

export class EdinetFetchService {
    private commonService: EdinetCommonService;
    private vectorizationService: VectorizationService;
    private processorService: EdinetProcessorService;

    constructor(
        private readonly logger: LoggerService,
        apiKey: string | undefined,
        private readonly dataDir: string,
        private readonly edinetDbPath: string
    ) {
        this.commonService = new EdinetCommonService(logger, apiKey, dataDir, edinetDbPath);
        this.vectorizationService = new VectorizationService(logger);
        this.processorService = new EdinetProcessorService(logger, this.commonService, this.vectorizationService);
    }

    /**
     * サービスの初期化
     */
    async init(): Promise<void> {
        await this.commonService.init();
        await this.vectorizationService.init();
    }

    /**
     * 指定された銘柄のメイン処理
     */
    async processTicker(ticker: string, months: number): Promise<void> {
        const targetSecCode = ticker + '0'; // EDINETでは通常 Ticker + '0' が使用される
        let foundDocsCount = 0;

        // 指定月数分ループするのではなく、範囲指定で処理するように変更したほうが効率的だが、
        // 既存の processYear ロジックを活かすなら、月ごとに処理するか、
        // あるいは processRange(start, end) のようなメソッドを作るのが良い。
        // ここでは簡単に processAll と同様のロジックに修正する (一括取得)。

        const count = await this.processTickerRange(ticker, targetSecCode, months);
        foundDocsCount += count;

        if (foundDocsCount === 0) {
            this.logger.warn('指定された範囲でドキュメントが見つかりませんでした。銘柄コードや期間を確認してください。');
        }
    }

    /**
     * 指定された年数分の全銘柄処理
     */
    async processAll(months: number): Promise<void> {
        // 1. シード更新 (メタデータ)
        await this.commonService.updateMetadata(months);

        // 2. ローカルDBから過去数ヶ月分のドキュメントを検索
        this.logger.info(`過去 ${months} ヶ月分のドキュメントをローカルDBから検索中...`);
        const repo = new EdinetRepository(this.edinetDbPath);

        try {
            // 日付範囲の計算
            const endDateObj = new Date();
            const startDateObj = new Date();
            startDateObj.setMonth(startDateObj.getMonth() - months);

            const formatDate = (d: Date) => d.toISOString().split('T')[0];
            const startStr = formatDate(startDateObj);
            const endStr = formatDate(endDateObj);

            // 対象ドキュメントタイプ (有報、半報、四半期報)
            const targetTypes = [
                EdinetDocumentType.AnnualCards,
                EdinetDocumentType.SemiAnnualReport,
                EdinetDocumentType.QuarterlyReport
            ].map(String);

            const docs = await repo.findDocuments({});

            const targetDocs = docs.filter((d: any) => {
                const date = d.submitDate || d.date;
                if (!date) return false;
                if (date < startStr || date > endStr) return false;
                if (!d.secCode) return false;
                // @ts-ignore
                return targetTypes.includes(String(d.docTypeCode));
            });

            this.logger.info(`${targetDocs.length} 件の対象ドキュメントを発見。処理を開始します...`);

            await this.processDocsByMonth(targetDocs);

        } finally {
            repo.close();
        }
    }

    /**
     * 特定の年範囲のデータを処理
     */
    /**
     * 特定の期間(過去Nヶ月)のデータを処理
     */
    private async processTickerRange(ticker: string, targetSecCode: string, months: number): Promise<number> {
        const endDateObj = new Date();
        const startDateObj = new Date();
        startDateObj.setMonth(startDateObj.getMonth() - months);

        const formatDate = (d: Date) => d.toISOString().split('T')[0];
        const startStr = formatDate(startDateObj);
        const endStr = formatDate(endDateObj);

        this.logger.info(`有価証券報告書を検索中 (${startStr} ~ ${endStr}) 銘柄: ${ticker} (${targetSecCode})...`);

        let processedCount = 0;

        try {
            const repo = new EdinetRepository(this.edinetDbPath);
            const allDocs = await repo.findDocuments({});

            const targetTypes = [
                EdinetDocumentType.AnnualCards,
                EdinetDocumentType.SemiAnnualReport,
                EdinetDocumentType.QuarterlyReport
            ].map(String);

            const targetDocs = allDocs.filter((d: any) => {
                if (d.secCode !== targetSecCode) return false;
                const date = d.submitDate || d.date;
                if (!date) return false;
                if (date < startStr || date > endStr) return false;
                return targetTypes.includes(String(d.docTypeCode));
            });

            if (targetDocs.length === 0) {
                this.logger.info(`この期間にドキュメントは見つかりませんでした。`);
                return 0;
            }

            this.logger.info(`${targetDocs.length} 件のドキュメントを発見。処理を開始します...`);

            await this.processDocsByMonth(targetDocs);
            processedCount = targetDocs.length;

        } catch (e: any) {
            this.logger.error(`期間 ${startStr}~${endStr} の検索中にエラーが発生しました: ${e.message}`);
        }

        return processedCount;
    }

    /**
     * 年オフセットから開始日・終了日を計算
     */


    /**
     * ドキュメントを月ごとにグループ化してバッチ処理
     */
    private async processDocsByMonth(docs: any[]): Promise<void> {
        if (docs.length === 0) return;

        this.logger.info(`${docs.length} 件のドキュメントを発見。日付順にソートし、月ごとにグループ化します...`);

        // 日付順にソート (古い順)
        docs.sort((a: any, b: any) => {
            const da = a.submitDate || a.date;
            const db = b.submitDate || b.date;
            return da.localeCompare(db);
        });

        // 月ごとにグループ化 (YYYY-MM)
        const docsByMonth: { [key: string]: any[] } = {};
        for (const doc of docs) {
            const date = doc.submitDate || doc.date;
            if (!date) continue;
            const monthKey = date.slice(0, 7); // YYYY-MM
            if (!docsByMonth[monthKey]) docsByMonth[monthKey] = [];
            docsByMonth[monthKey].push(doc);
        }

        const monthKeys = Object.keys(docsByMonth).sort();
        this.logger.info(`${monthKeys.length} 個の月次バッチを処理します: ${monthKeys.join(', ')}`);

        const currentMonthKey = new Date().toISOString().slice(0, 7);

        for (const monthKey of monthKeys) {
            const docsInMonth = docsByMonth[monthKey];
            const isCurrentMonth = monthKey === currentMonthKey;
            const outputDir = path.resolve(this.dataDir, '../../processed/edinet'); // data/processed/edinet
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            const outputPath = path.join(outputDir, `${monthKey}.parquet`);

            // スキップロジック:
            if (!isCurrentMonth && fs.existsSync(outputPath)) {
                this.logger.info(`[batch] ${monthKey} をスキップします (過去月、ファイル済み: ${docsInMonth.length} ドキュメント)`);
                continue;
            }

            this.logger.info(`[batch] ${monthKey} を処理中 (ドキュメント数: ${docsInMonth.length}, 当月: ${isCurrentMonth})`);

            // ファイルが存在する場合、既存の docID をロード
            const existingDocIds = new Set<string>();
            let existingRows: any[] = [];

            if (fs.existsSync(outputPath)) {
                this.logger.info(`  -> マージ用に既存のParquetファイルを読み込んでいます...`);
                try {
                    const parquetjs = await import('parquetjs');
                    const reader = await parquetjs.default.ParquetReader.openFile(outputPath);
                    const cursor = reader.getCursor();
                    let record: any = null;
                    while (record = await cursor.next()) {
                        if (record.doc_id) {
                            existingDocIds.add(record.doc_id);
                            existingRows.push(record);
                        }
                    }
                    await reader.close();
                    this.logger.info(`  -> ${existingRows.length} 件の既存レコードを読み込みました。`);
                } catch (e: any) {
                    this.logger.warn(`  -> 既存Parquetの読み込みに失敗しました (上書きします): ${e.message}`);
                    existingRows = [];
                }
            }

            // 処理が必要なドキュメントをフィルタリング
            const docsToProcess = docsInMonth.filter(d => !existingDocIds.has(d.docID));

            if (docsToProcess.length === 0) {
                this.logger.info(`  -> ${monthKey} に新規ドキュメントはありません。`);
                continue;
            }

            this.logger.info(`  -> ${docsToProcess.length} 件の新規ドキュメントを処理中...`);

            this.logger.info(`  -> ${docsToProcess.length} 件の新規ドキュメントを処理中...`);

            const limit = pLimit(10); // Concurrency limit
            const promises = docsToProcess.map((doc, index) => limit(async () => {
                // @ts-ignore
                const docDate = doc.submitDate || doc.date;
                const ticker = doc.secCode ? doc.secCode.slice(0, 4) : 'UNKNOWN';
                let rowData = null;

                try {
                    rowData = await this.processorService.process(doc, docDate, ticker);
                } catch (e: any) {
                    this.logger.warn(`${doc.docID} の処理に失敗しました: ${e.message}`);
                }

                if ((index + 1) % 10 === 0) {
                    process.stdout.write(index.toString());
                }

                return rowData;
            }));

            const results = await Promise.all(promises);
            const newRows = results.filter((row): row is EdinetFinancial => row !== null);
            process.stdout.write('\n');

            if (newRows.length > 0) {
                // マージして書き込み
                const finalRows = [...existingRows, ...newRows];
                finalRows.sort((a, b) => (a.submit_date || '').localeCompare(b.submit_date || ''));

                this.logger.info(`  -> ${finalRows.length} 件のレコードを ${outputPath} に書き込んでいます...`);
                await this.writeParquetFile(outputPath, finalRows);
            }
        }
    }

    private async writeParquetFile(filePath: string, rows: any[]): Promise<void> {
        if (rows.length === 0) return;

        try {
            const parquetjs = await import('parquetjs');
            const { ParquetWriter } = parquetjs.default;
            const { EDINET_SCHEMA } = await import('../utils/schema-definitions.js');

            const writer = await ParquetWriter.openFile(EDINET_SCHEMA, filePath);
            for (const row of rows) {
                await writer.appendRow(row);
            }
            await writer.close();
        } catch (e: any) {
            throw new Error(`Parquet書き込みに失敗しました: ${e.message}`);
        }
    }
}
