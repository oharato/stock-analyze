import * as fs from 'fs';
import * as path from 'path';
import { EdinetDocumentType, EdinetRepository } from 'edinet-ts';
import { LoggerService } from './logger.service.js';
import { EdinetCommonService } from './edinet-common.service.js';

export class LargeShareholdingFetchService {
    private commonService: EdinetCommonService;
    private readonly DEFAULT_FETCH_MONTHS = 3;

    constructor(
        private readonly logger: LoggerService,
        apiKey: string | undefined,
        private readonly dataDir: string,
        private readonly edinetDbPath: string
    ) {
        this.commonService = new EdinetCommonService(logger, apiKey, dataDir, edinetDbPath);
    }

    /**
     * サービスの初期化
     */
    async init(): Promise<void> {
        await this.commonService.init();
    }

    /**
     * 指定された月数分のデータを処理 (デフォルト: 3)
     */
    async processDateRange(months: number = this.DEFAULT_FETCH_MONTHS): Promise<void> {
        // 1. メタデータ更新 (Seed)
        await this.commonService.updateMetadata(months);

        // 2. 日付範囲の計算
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);

        this.logger.info(`大量保有報告書の処理を開始: ${startDate.toISOString().split('T')[0]} から ${endDate.toISOString().split('T')[0]} まで...`);

        // 3. 各日をループ処理
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            await this.processDay(dateStr);
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }

    private async processDay(dateStr: string): Promise<void> {
        const repo = new EdinetRepository(this.edinetDbPath);

        try {
            // 対象ドキュメント検索: 大量保有(340), 変更(350), 訂正(360)
            const docs = await repo.findDocuments({});
            const targetDocs = docs.filter((d: any) => {
                const dDate = d.submitDate || d.date;
                if (dDate !== dateStr) return false;

                const typeCode = String(d.docTypeCode);
                return [
                    EdinetDocumentType.LargeShareholdingReport,
                    EdinetDocumentType.ChangeReport,
                    EdinetDocumentType.CorrectionReport
                ].map(String).includes(typeCode);
            });

            if (targetDocs.length === 0) {
                return;
            }

            // Parquetファイルが存在するか確認
            const outputDir = path.resolve(this.dataDir, '../../processed/large-shareholdings');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            const parquetPath = path.join(outputDir, `${dateStr}.parquet`);
            if (fs.existsSync(parquetPath)) {
                this.logger.info(`日付 ${dateStr} のParquetファイルは既に存在します。スキップします。`);
                return;
            }

            this.logger.info(`日付 ${dateStr} に ${targetDocs.length} 件のドキュメントを発見。処理を開始します...`);

            const records: any[] = [];

            for (const doc of targetDocs) {
                try {
                    const record = await this.processDocument(doc);
                    if (record) {
                        records.push(record);
                    }
                } catch (e: any) {
                    this.logger.error(`${doc.docID} の処理に失敗しました: ${e.message}`);
                }
            }

            if (records.length > 0) {
                await this.writeParquet(parquetPath, records);
                this.logger.info(`${records.length} 件のレコードを ${parquetPath} に保存しました。`);
            }

        } finally {
            repo.close();
        }
    }

    private async writeParquet(filePath: string, records: any[]): Promise<void> {
        const parquetjs = await import('parquetjs');
        const { ParquetWriter } = parquetjs.default;
        const { LARGE_SHAREHOLDING_SCHEMA } = await import('../utils/schema-definitions.js');

        const writer = await ParquetWriter.openFile(LARGE_SHAREHOLDING_SCHEMA, filePath);
        try {
            for (const record of records) {
                await writer.appendRow(record);
            }
        } finally {
            await writer.close();
        }
    }

    private async processDocument(doc: any): Promise<any | null> {
        // 共通サービスを使用してXBRLテキストを取得 (キャッシュ処理含む)
        const xbrlText = await this.commonService.fetchXbrl(doc.docID);
        if (!xbrlText) {
            this.logger.warn(`XBRLを取得できませんでした: ${doc.docID}`);
            return null;
        }

        // 銘柄コードの抽出
        const ticker = this.extractIssuerTicker(xbrlText);
        const safeTicker = ticker || 'UNKNOWN';

        // 追加情報 (保有目的、保有割合など) の抽出
        const extraInfo = this.extractExtraInfo(xbrlText);

        // データオブジェクトを返す
        return {
            doc_id: doc.docID,
            submit_date: doc.submitDate || doc.date,
            filer_name: doc.filerName,
            ticker: safeTicker,
            doc_description: doc.docDescription,
            doc_type_code: String(doc.docTypeCode), // Ensure string for Parquet
            // 追加情報
            holding_purpose: extraInfo.holdingPurpose,
            holding_ratio: extraInfo.holdingRatio,
            prev_holding_ratio: extraInfo.prevHoldingRatio,
            total_shares_held: extraInfo.totalSharesHeld
        };
    }

    private extractIssuerTicker(xml: string): string | null {
        // jplvh_cor:SecurityCodeOfIssuer を最初に試行 (大量保有報告書固有)
        const matchSpecific = xml.match(/<jplvh_cor:SecurityCodeOfIssuer[^>]*>(\d{4})\d?<\/jplvh_cor:SecurityCodeOfIssuer>/);
        if (matchSpecific) {
            return matchSpecific[1];
        }

        // 試行 2: 標準的な SecurityCode タグ (jpcrp_cor など)
        const match = xml.match(/<([a-zA-Z0-9_]+):SecurityCode[^>]*>(\d{4})0?<\/\1:SecurityCode>/);
        if (match) {
            return match[2]; // 4桁を返す
        }

        // 緩いマッチング
        const matchLoose = xml.match(/:SecurityCode[^>]*>\s*(\d{4})\d?\s*<\//);
        if (matchLoose) {
            return matchLoose[1];
        }

        return null;
    }

    private extractExtraInfo(xml: string): {
        holdingPurpose?: string,
        holdingRatio?: number,
        prevHoldingRatio?: number,
        totalSharesHeld?: number
    } {
        // 共通サービスのヘルパーを使用
        const extractText = (tag: string) => this.commonService.extractText(xml, tag);
        const extractNumber = (tag: string) => this.commonService.extractNumber(xml, tag);

        return {
            holdingPurpose: extractText('jplvh_cor:PurposeOfHolding'),
            holdingRatio: extractNumber('jplvh_cor:HoldingRatioOfShareCertificatesEtc'),
            prevHoldingRatio: extractNumber('jplvh_cor:HoldingRatioOfShareCertificatesEtcPerLastReport'),
            totalSharesHeld: extractNumber('jplvh_cor:TotalNumberOfStocksEtcHeld')
        };
    }
}
