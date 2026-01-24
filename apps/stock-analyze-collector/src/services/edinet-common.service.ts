import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { EdinetXbrlDownloader, EdinetInfoSeeder } from 'edinet-ts';
import { LoggerService } from './logger.service.js';

export class EdinetCommonService {
    public downloader: EdinetXbrlDownloader | null = null;

    constructor(
        private readonly logger: LoggerService,
        private readonly apiKey: string | undefined,
        private readonly dataDir: string,
        private readonly edinetDbPath: string
    ) { }

    /**
     * ダウンローダーの共通初期化処理
     */
    async init(): Promise<void> {
        this.downloader = new EdinetXbrlDownloader({
            apiKey: this.apiKey,
            rootDir: this.dataDir,
            enableRateLimit: true,
            requestsPerSecond: 3
        });
    }

    /**
     * ローカルEDINETメタデータDBの更新 (Seeding) - 最適化済み
     */
    async updateMetadata(months?: number): Promise<void> {
        const periodStr = months ? `過去 ${months} ヶ月分` : 'デフォルト期間';
        this.logger.info(`EDINETメタデータ更新 (Seeding) を開始: ${periodStr}...`);

        let startOption: Date | undefined;
        let targetStartDate: Date | undefined;

        if (months) {
            targetStartDate = new Date();
            targetStartDate.setMonth(targetStartDate.getMonth() - months);
        }

        // 最適化: Seeding済み範囲を確認
        const lastSeeded = this.getLastSeededDate();
        const firstSeeded = this.getFirstSeededDate();

        if (lastSeeded && firstSeeded) {
            // ケース1: 指定期間が既存データより古い場合 (Backfill必要)
            if (targetStartDate && targetStartDate < firstSeeded) {
                startOption = targetStartDate;
                this.logger.info(`指定された開始日 (${targetStartDate.toISOString().split('T')[0]}) は既存データの最古日 (${firstSeeded.toISOString().split('T')[0]}) より古いです。過去データを取得します。`);
            }
            // ケース2: 既存データより新しい期間のみ必要な場合 (Catch-up)
            else {
                let effectiveStart = lastSeeded;
                if (targetStartDate && targetStartDate > effectiveStart) {
                    effectiveStart = targetStartDate;
                    this.logger.info(`ターゲット日付 (${targetStartDate.toISOString().split('T')[0]}) は最終Seeding日 (${lastSeeded.toISOString().split('T')[0]}) より新しいです。ターゲット日付から開始します。`);
                } else {
                    this.logger.info(`既存のメタデータを ${lastSeeded.toISOString().split('T')[0]} まで確認しました (最古: ${firstSeeded.toISOString().split('T')[0]})。ここからSeedingを再開します。`);
                }

                // 連続性確保のため1-2日戻る
                const buffer = new Date(effectiveStart);
                buffer.setDate(buffer.getDate() - 2);
                startOption = buffer;
            }

        } else if (targetStartDate) {
            startOption = targetStartDate;
        }

        if (startOption) {
            this.logger.info(`Seeding開始日を設定: ${startOption.toISOString().split('T')[0]}`);
        }

        const seeder = new EdinetInfoSeeder({
            apiKey: this.apiKey!,
            dbPath: this.edinetDbPath,
            skipExisting: true,
            start: startOption,
            onProgress: (processed, total) => {
                // ログ出力を抑制
                if (processed % 50 === 0 || processed === total) {
                    this.logger.info(`Seed進捗: ${processed}/${total} 日分完了`);
                }
            },
            onError: (error, dateStr) => {
                this.logger.warn(`Seedエラー (${dateStr}): ${String(error)}`);
            }
        });

        await seeder.run();
        this.logger.info('メタデータ更新が完了しました。');
    }

    private getLastSeededDate(): Date | null {
        return this.getSeededDate('MAX');
    }

    private getFirstSeededDate(): Date | null {
        return this.getSeededDate('MIN');
    }

    private getSeededDate(aggregator: 'MAX' | 'MIN'): Date | null {
        try {
            if (!fs.existsSync(this.edinetDbPath)) return null;
            const db = new Database(this.edinetDbPath, { readonly: true });

            // テーブル存在確認
            const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='documents'").get();
            if (!tableCheck) {
                db.close();
                return null;
            }

            const result: any = db.prepare(`SELECT ${aggregator}(submit_date) as date FROM documents`).get();
            db.close();

            if (result && result.date) {
                return new Date(result.date);
            }
            return null;
        } catch (e) {
            this.logger.warn(`${aggregator} Seeding日時の取得に失敗しました: ${String(e)}`);
            return null;
        }
    }

    /**
     * ファイルシステムキャッシュを利用してXBRLテキストを取得
     * (キャッシュディレクトリは通常、dataDirの親ディレクトリの xbrl-cache)
     */
    async fetchXbrl(docID: string): Promise<string | null> {
        // dataDir (ex: data/raw/edinet) から相対パスでキャッシュディレクトリを指定
        const cacheDir = path.resolve(this.dataDir, '../xbrl-cache');

        // 拡張子の揺らぎに対応 (.xml 優先)
        const cachePathXml = path.join(cacheDir, `${docID}.xml`);

        if (fs.existsSync(cachePathXml)) {
            this.logger.info(`キャッシュされたXBRLを使用: ${cachePathXml}`);
            return fs.readFileSync(cachePathXml, 'utf-8');
        }

        // LargeShareholding で使用される .xbrl も確認
        const cachePathXbrl = path.join(cacheDir, `${docID}.xbrl`);
        if (fs.existsSync(cachePathXbrl)) {
            this.logger.info(`キャッシュされたXBRLを使用 (.xbrl): ${cachePathXbrl}`);
            return fs.readFileSync(cachePathXbrl, 'utf-8');
        }

        if (!this.downloader) {
            throw new Error('Downloader not initialized');
        }

        let fetchedXbrl: string | undefined | null = null;
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this.logger.info(`XBRLをAPIから取得中: ${docID} (Attempt ${attempt}/${maxRetries})`);
                fetchedXbrl = await this.downloader.fetchXbrl(docID);
                if (fetchedXbrl) break;

                this.logger.warn(`XBRL取得失敗 (Attempt ${attempt}). Retrying in 3s...`);
            } catch (error: any) {
                this.logger.warn(`XBRL取得エラー (Attempt ${attempt}): ${error.message}. Retrying in 3s...`);
            }
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        if (!fetchedXbrl) {
            this.logger.error(`XBRLテキストの取得に失敗しました (After ${maxRetries} attempts) DocID: ${docID}`);
            return null;
        }

        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }

        // デフォルトで .xml として保存
        fs.writeFileSync(cachePathXml, fetchedXbrl, 'utf-8');
        this.logger.info(`XBRLをキャッシュしました: ${cachePathXml}`);

        return fetchedXbrl;
    }

    /**
     * 正規表現によるテキスト抽出ユーティリティ (XMLタグ除去)
     */
    extractText(xml: string, tag: string): string | undefined {
        // <tag ...> と </tag> の間のコンテンツを抽出
        const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
        const match = xml.match(regex);
        if (!match) return undefined;

        // HTMLエンティティのデコードとタグ除去
        let text = match[1];
        text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        text = text.replace(/&amp;/g, '&').replace(/&quot;/g, '"');
        text = text.replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');
        text = text.replace(/<[^>]*>/g, ''); // HTMLタグ除去
        text = text.replace(/\s+/g, ' ').trim();
        return text || undefined;
    }

    extractNumber(xml: string, tag: string): number | undefined {
        // タグから数値を抽出
        const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
        const match = xml.match(regex);
        if (!match) return undefined;

        const text = match[1].replace(/,/g, '').trim();
        const num = parseFloat(text);
        return isNaN(num) ? undefined : num;
    }
}
