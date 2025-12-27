
import * as fs from 'fs';
import * as path from 'path';
import { EdinetXbrlDownloader, EdinetDocumentType, EdinetInfoSeeder, EdinetRepository } from 'edinet-ts';
import { LoggerService } from './logger.service.js';
import * as unzipper from 'unzipper';

export class LargeShareholdingFetchService {
    private downloader: EdinetXbrlDownloader | null = null;
    private readonly DEFAULT_FETCH_MONTHS = 3;

    constructor(
        private readonly logger: LoggerService,
        private readonly apiKey: string | undefined,
        private readonly dataDir: string,
        private readonly edinetDbPath: string
    ) { }

    /**
     * Initialize services
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
     * Process data for the specified number of months (default: 3)
     */
    async processDateRange(months: number = this.DEFAULT_FETCH_MONTHS): Promise<void> {
        if (!this.downloader) {
            throw new Error('Service not initialized. Call init() first.');
        }

        // 1. Update Metadata (Seed) for the required range
        // Note: Seeder typically syncs recent data by default logic or we can ensure coverage
        await this.updateMetadata(months);

        // 2. Calculate Date Range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);

        this.logger.info(`Processing Large Shareholding Reports from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}...`);

        // 3. Iterate through each day
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            await this.processDay(dateStr);
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }

    private async updateMetadata(months: number = this.DEFAULT_FETCH_MONTHS): Promise<void> {
        this.logger.info('Updating EDINET metadata (Seeding)...');

        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);

        const seeder = new EdinetInfoSeeder({
            apiKey: this.apiKey!,
            dbPath: this.edinetDbPath,
            skipExisting: true, // Optimistic skip
            start: startDate,
            onProgress: (processed, total) => {
                if (processed % 100 === 0 || processed === total) {
                    this.logger.info(`Seed Progress: ${processed}/${total}`);
                }
            },
            onError: (error, dateStr) => {
                this.logger.warn(`Seed Error on ${dateStr}: ${String(error)}`);
            }
        });

        await seeder.run();
    }

    private async processDay(dateStr: string): Promise<void> {
        const repo = new EdinetRepository(this.edinetDbPath);

        try {
            // Find target documents: LargeShareholding(340), Change(350), Correction(360)
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
                // this.logger.debug(`No target docs for ${dateStr}`);
                return;
            }

            this.logger.info(`Found ${targetDocs.length} docs on ${dateStr}. Processing...`);

            // Ensure daily directory exists
            const dayDir = path.join(this.dataDir, dateStr);
            if (!fs.existsSync(dayDir)) {
                fs.mkdirSync(dayDir, { recursive: true });
            }

            for (const doc of targetDocs) {
                try {
                    await this.processDocument(doc, dayDir);
                } catch (e: any) {
                    this.logger.error(`Failed to process ${doc.docID}: ${e.message}`);
                }
            }

        } finally {
            repo.close();
        }
    }

    private async processDocument(doc: any, dayDir: string): Promise<void> {
        // Check Cache first
        const cacheDir = path.resolve(this.dataDir, '../../xbrl-cache');
        const xbrlPath = path.join(cacheDir, `${doc.docID}.xbrl`);
        let xbrlText: string | null = null;

        if (fs.existsSync(xbrlPath)) {
            xbrlText = fs.readFileSync(xbrlPath, 'utf-8');
            // this.logger.debug(`Using cached XBRL for ${doc.docID}`);
        } else {
            // Fetch XBRL Text
            xbrlText = await this.downloader!.fetchXbrl(doc.docID);
            if (!xbrlText) {
                this.logger.warn(`Could not fetch XBRL for ${doc.docID}`);
                return;
            }
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }
            fs.writeFileSync(xbrlPath, xbrlText, 'utf-8');
            this.logger.info(`Cached XBRL to ${xbrlPath}`);
        }

        // Extract Ticker
        const ticker = this.extractIssuerTicker(xbrlText);
        if (!ticker) {
            this.logger.warn(`Could not extract issuer ticker for ${doc.docID}. Using 'UNKNOWN'.`);
        }
        const safeTicker = ticker || 'UNKNOWN';

        // Extract Extra Info (Purpose, Share Counts, etc.)
        const extraInfo = this.extractExtraInfo(xbrlText);

        // Filenames
        const baseName = `${safeTicker}-${doc.docID}`;



        // Create Metadata JSON
        const metadata = {
            doc_id: doc.docID,
            submit_date: doc.submitDate || doc.date,
            filer_name: doc.filerName,
            ticker: safeTicker,
            doc_description: doc.docDescription,
            doc_type_code: doc.docTypeCode,
            // Extra Info
            holding_purpose: extraInfo.holdingPurpose,
            holding_ratio: extraInfo.holdingRatio,
            prev_holding_ratio: extraInfo.prevHoldingRatio,
            total_shares_held: extraInfo.totalSharesHeld
        };

        const jsonPath = path.join(dayDir, `${baseName}.json`);
        // Always overwrite JSON to ensure it has latest fields
        fs.writeFileSync(jsonPath, JSON.stringify(metadata), 'utf-8');

        this.logger.info(`Saved metadata to ${baseName}.json`);
    }

    private extractIssuerTicker(xml: string): string | null {
        // Try jplvh_cor:SecurityCodeOfIssuer first (Large Shareholding specific)
        const matchSpecific = xml.match(/<jplvh_cor:SecurityCodeOfIssuer[^>]*>(\d{4})\d?<\/jplvh_cor:SecurityCodeOfIssuer>/);
        if (matchSpecific) {
            return matchSpecific[1];
        }

        // Attempt 2: Standard SecurityCode tag (jpcrp_cor etc)
        const match = xml.match(/<([a-zA-Z0-9_]+):SecurityCode[^>]*>(\d{4})0?<\/\1:SecurityCode>/);
        if (match) {
            return match[2]; // Return 4 digit
        }

        // Loose match
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
        const extractText = (tag: string) => {
            const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
            const match = xml.match(regex);
            return match ? match[1].trim() : undefined;
        };
        const extractNumber = (tag: string) => {
            const val = extractText(tag);
            if (!val) return undefined;
            const num = parseFloat(val);
            return isNaN(num) ? undefined : num;
        };

        return {
            holdingPurpose: extractText('jplvh_cor:PurposeOfHolding'),
            holdingRatio: extractNumber('jplvh_cor:HoldingRatioOfShareCertificatesEtc'),
            prevHoldingRatio: extractNumber('jplvh_cor:HoldingRatioOfShareCertificatesEtcPerLastReport'),
            totalSharesHeld: extractNumber('jplvh_cor:TotalNumberOfStocksEtcHeld')
        };
    }
}
