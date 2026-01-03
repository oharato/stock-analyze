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
    async updateMetadata(years?: number): Promise<void> {
        const periodStr = years ? `過去 ${years} 年分` : 'デフォルト期間';
        this.logger.info(`EDINETメタデータ更新 (Seeding) を開始: ${periodStr}...`);

        let startOption: Date | undefined;
        let targetStartDate: Date | undefined;

        if (years) {
            targetStartDate = new Date();
            targetStartDate.setFullYear(targetStartDate.getFullYear() - years);
        }

        // 最適化: 最終Seeding日時を確認
        const lastSeeded = this.getLastSeededDate();

        if (lastSeeded) {
            let effectiveStart = lastSeeded;
            if (targetStartDate && targetStartDate > effectiveStart) {
                effectiveStart = targetStartDate;
                this.logger.info(`ターゲット日付 (${targetStartDate.toISOString().split('T')[0]}) は最終Seeding日 (${lastSeeded.toISOString().split('T')[0]}) より新しいです。ターゲット日付から開始します。`);
            } else {
                this.logger.info(`既存のメタデータを ${lastSeeded.toISOString().split('T')[0]} まで確認しました。ここからSeedingを再開します。`);
            }

            // 連続性確保のため1-2日戻る
            const buffer = new Date(effectiveStart);
            buffer.setDate(buffer.getDate() - 2);
            startOption = buffer;

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
        try {
            if (!fs.existsSync(this.edinetDbPath)) return null;
            const db = new Database(this.edinetDbPath, { readonly: true });

            // テーブル存在確認
            const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='documents'").get();
            if (!tableCheck) {
                db.close();
                return null;
            }

            const result: any = db.prepare("SELECT MAX(submit_date) as maxDate FROM documents").get();
            db.close();

            if (result && result.maxDate) {
                return new Date(result.maxDate);
            }
            return null;
        } catch (e) {
            this.logger.warn(`最終Seeding日時の取得に失敗しました: ${String(e)}`);
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

        this.logger.info(`XBRLをAPIから取得中: ${docID}`);
        const fetchedXbrl = await this.downloader.fetchXbrl(docID);
        if (!fetchedXbrl) {
            this.logger.error(`XBRLテキストの取得に失敗しました DocID: ${docID}`);
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
