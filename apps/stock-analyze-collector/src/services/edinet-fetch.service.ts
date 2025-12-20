import * as fs from 'fs';
import * as path from 'path';
import { EdinetXbrlDownloader, EdinetXbrlParser, EdinetDocumentType, EdinetInfoSeeder, EdinetRepository } from 'edinet-ts';
import { LoggerService } from './logger.service.js';
import { EdinetDataWithVectors } from '../types/edinet.js';

export class EdinetFetchService {
    private downloader: EdinetXbrlDownloader | null = null;
    private parser: EdinetXbrlParser;
    private extractor: any = null;

    constructor(
        private readonly logger: LoggerService,
        private readonly apiKey: string | undefined,
        private readonly dataDir: string,
        private readonly edinetDbPath: string
    ) {
        this.parser = new EdinetXbrlParser();
    }

    /**
     * Initialize services (Downloader, Vectorization Model)
     */
    async init(): Promise<void> {
        // Initialize Downloader
        this.downloader = new EdinetXbrlDownloader({
            apiKey: this.apiKey,
            rootDir: this.dataDir,
            enableRateLimit: true,
            requestsPerSecond: 3
        });

        // Initialize Vectorization Model
        this.logger.info('Initializing vectorization model (Xenova/paraphrase-multilingual-MiniLM-L12-v2)...');
        const { pipeline } = await import('@xenova/transformers'); // Dynamic import
        this.extractor = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
    }

    /**
     * Main execution method for a ticker
     */
    async processTicker(ticker: string, years: number): Promise<void> {
        if (!this.downloader || !this.extractor) {
            throw new Error('Service not initialized. Call init() first.');
        }

        const targetSecCode = ticker + '0'; // EDINET usually uses Ticker + '0'
        let foundDocsCount = 0;

        for (let i = 0; i < years; i++) {
            const count = await this.processYear(ticker, targetSecCode, i);
            foundDocsCount += count;
        }

        if (foundDocsCount === 0) {
            this.logger.warn('No documents found in the specified range. Check ticker or range.');
        }
    }

    /**
     * Process all tickers for the specified years
     */
    async processAll(years: number): Promise<void> {
        if (!this.downloader || !this.extractor) {
            throw new Error('Service not initialized. Call init() first.');
        }

        // 1. Update Seed (Metadata)
        await this.updateMetadata();

        // 2. Query Documents from DB
        this.logger.info(`Querying documents for past ${years} years from local DB...`);
        const repo = new EdinetRepository(this.edinetDbPath);

        try {
            // Calculate date range
            const endDateObj = new Date();
            const startDateObj = new Date();
            startDateObj.setFullYear(startDateObj.getFullYear() - years);

            const formatDate = (d: Date) => d.toISOString().split('T')[0];
            const startStr = formatDate(startDateObj);
            const endStr = formatDate(endDateObj);

            // Fetch specific document types (Annual, Semi-Annual, Quarterly)
            // Note: EdinetDocumentType values are single codes (120, 140, 160)
            const targetTypes = [
                EdinetDocumentType.AnnualCards,
                EdinetDocumentType.SemiAnnualReport,
                EdinetDocumentType.QuarterlyReport
            ].map(String); // Ensure strings for comparison

            const docs = await repo.findDocuments({}); // Fetch all for now as safe default

            // Filter in Memory
            const targetDocs = docs.filter((d: any) => {
                const date = d.submitDate || d.date; // normalize
                if (!date) return false;
                if (date < startStr || date > endStr) return false;

                // Skip if no secCode (e.g. Investment Trusts, Funds without ticker)
                if (!d.secCode) return false;

                // Check if it matches any of the target types
                // @ts-ignore
                return targetTypes.includes(String(d.docTypeCode));
            });

            this.logger.info(`Found ${targetDocs.length} potential documents. Processing...`);

            let processedCount = 0;
            const total = targetDocs.length;

            for (let i = 0; i < total; i++) {
                const doc = targetDocs[i];
                // Normalizing date property access
                // @ts-ignore
                const docDate = doc.submitDate || doc.date;
                const ticker = doc.secCode ? doc.secCode.slice(0, 4) : 'UNKNOWN'; // secCode is usually 5 digit

                try {
                    const success = await this.processDocument(doc, docDate, ticker);
                    if (success) processedCount++;
                } catch (e: any) {
                    this.logger.warn(`Failed to process ${doc.docID}: ${e.message}`);
                }

                if ((i + 1) % 10 === 0) {
                    this.logger.info(`Progress: ${i + 1}/${total} (Processed: ${processedCount})`);
                }
            }

        } finally {
            repo.close();
        }
    }

    /**
     * Update local EDINET metadata DB
     */
    private async updateMetadata(): Promise<void> {
        this.logger.info('Updating EDINET metadata (Seeding)...');
        const seeder = new EdinetInfoSeeder({
            apiKey: this.apiKey!,
            dbPath: this.edinetDbPath,
            skipExisting: true,
            onProgress: (processed, total) => {
                if (processed % 10 === 0 || processed === total) {
                    this.logger.info(`Seed Progress: ${processed}/${total} days processed.`);
                }
            },
            onError: (error, dateStr) => {
                this.logger.warn(`Seed Error on ${dateStr}: ${String(error)}`);
            }
        });

        await seeder.run();
        this.logger.info('Metadata update completed.');
    }

    /**
     * Process data for a specific year interval
     */
    private async processYear(ticker: string, targetSecCode: string, yearOffset: number): Promise<number> {
        const { startStr, endStr } = this.calculateDateRange(yearOffset);

        this.logger.info(`Searching Annual Report in period: ${startStr} ~ ${endStr} for ticker: ${ticker} (${targetSecCode})...`);

        let processedCount = 0;

        try {
            const allDocs = await this.downloader!.searchPeriod(startStr, endStr, EdinetDocumentType.AnnualCards);
            const targetDocs = allDocs.filter(d => d.secCode === targetSecCode);

            if (targetDocs.length === 0) {
                this.logger.info(`No documents found in this period.`);
                return 0;
            }

            this.logger.info(`Found ${targetDocs.length} document(s). Processing...`);

            for (const doc of targetDocs) {
                const docDate = doc.date || (doc.submitDateTime ? doc.submitDateTime.split(' ')[0] : undefined);
                if (!docDate) {
                    this.logger.warn(`Skipping document (DocID: ${doc.docID}) due to missing date.`);
                    continue;
                }

                const success = await this.processDocument(doc, docDate, ticker);
                if (success) {
                    processedCount++;
                }
            }
        } catch (e: any) {
            this.logger.error(`Error searching period ${startStr}~${endStr}: ${e.message}`);
        }

        return processedCount;
    }

    /**
     * Calculate start and end strings for the year offset
     */
    private calculateDateRange(yearOffset: number): { startStr: string, endStr: string } {
        const endDateObj = new Date();
        endDateObj.setFullYear(endDateObj.getFullYear() - yearOffset);

        const startDateObj = new Date();
        startDateObj.setFullYear(startDateObj.getFullYear() - yearOffset - 1);
        startDateObj.setDate(startDateObj.getDate() + 1);

        const formatDate = (d: Date) => d.toISOString().split('T')[0];
        return {
            startStr: formatDate(startDateObj),
            endStr: formatDate(endDateObj)
        };
    }

    /**
     * Download, Parse, Vectorize and Save a single document
     */
    private async processDocument(doc: any, docDate: string, ticker: string): Promise<boolean> {
        this.logger.info(`Processing document: ${doc.docDescription} (DocID: ${doc.docID}, Date: ${docDate})`);

        const filename = `${ticker}-${docDate}-${doc.docID}.json`;
        const filePath = path.join(this.dataDir, filename);

        if (fs.existsSync(filePath)) {
            this.logger.info(`File already exists: ${filePath}. Skipping.`);
            return true; // Count as found/processed existing
        }

        // Check for cached XBRL
        const xbrlCachePath = path.join(this.dataDir, '../xbrl-cache', `${doc.docID}.xml`);
        let xbrlText: string;

        if (fs.existsSync(xbrlCachePath)) {
            this.logger.info(`Using cached XBRL: ${xbrlCachePath}`);
            xbrlText = fs.readFileSync(xbrlCachePath, 'utf-8');
        } else {
            this.logger.info(`Fetching XBRL from API: ${doc.docID}`);
            const fetchedXbrl = await this.downloader!.fetchXbrl(doc.docID);
            if (!fetchedXbrl) {
                this.logger.error(`Failed to fetch XBRL text for DocID: ${doc.docID}`);
                return false;
            }
            xbrlText = fetchedXbrl;

            // Save to cache
            const cacheDir = path.dirname(xbrlCachePath);
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }
            fs.writeFileSync(xbrlCachePath, xbrlText, 'utf-8');
            this.logger.info(`Cached XBRL to: ${xbrlCachePath}`);
        }

        let xbrlData = this.parser.parse(xbrlText) as any;

        // Fallback if extracting text failed (common for Quarterly/Semi-Annual)
        if (!xbrlData.businessRisks && !xbrlData.managementAnalysis && !xbrlData.operatingResults) {
            this.logger.info('Standard parsing returned incomplete text. Using fallback regex parsing...');
            const fallbackData = this.parseFallback(xbrlText);
            xbrlData = { ...xbrlData, ...fallbackData };
        }

        const saveData = await this.buildSaveData(ticker, doc.docID, docDate, xbrlData);

        fs.writeFileSync(filePath, JSON.stringify(saveData, null, 2), 'utf-8');
        this.logger.info(`Saved data with vectors to ${filePath}`);

        return true;
    }

    private parseFallback(xml: string): any {
        const extract = (tagName: string) => {
            // Match content between <tag ...> and </tag>
            const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\/${tagName}>`, 'i');
            const match = xml.match(regex);
            return match ? match[1] : undefined;
        };

        return {
            businessRisks: extract('jpcrp_cor:BusinessRisksTextBlock'),
            managementAnalysis: extract('jpcrp_cor:ManagementAnalysisOfFinancialPositionOperatingResultsAndCashFlowsTextBlock') ||
                extract('jpcrp_cor:ManagementAnalysisOfFinancialPositionEtcTextBlock'),
            corporateGovernance: extract('jpcrp_cor:CorporateGovernanceTextBlock'),
            researchAndDevelopment: extract('jpcrp_cor:ResearchAndDevelopmentActivitiesTextBlock')
        };
    }

    /**
     * Construct the data object with vectorization
     */
    private async buildSaveData(ticker: string, docId: string, docDate: string, xbrlData: any): Promise<EdinetDataWithVectors> {
        // Text fields
        const businessRisks = this.cleanText(xbrlData.businessRisks);
        const mda = this.cleanText(xbrlData.managementAnalysis || xbrlData.operatingResults);
        const corporateGovernance = this.cleanText(xbrlData.corporateGovernance);
        const researchAndDevelopment = this.cleanText(xbrlData.researchAndDevelopment);

        // Vectorize
        const [
            businessRisksVector,
            mdaVector,
            governanceVector,
            rdVector
        ] = await Promise.all([
            this.vectorize(businessRisks),
            this.vectorize(mda),
            this.vectorize(corporateGovernance),
            this.vectorize(researchAndDevelopment)
        ]);

        return {
            ticker,
            docId: docId,
            date: docDate,
            year: new Date(docDate).getFullYear(),

            // Qualitative
            business_risks: businessRisks,
            business_risks_vector: businessRisksVector,
            mda: mda,
            mda_vector: mdaVector,
            corporate_governance: corporateGovernance,
            corporate_governance_vector: governanceVector,
            research_and_development: researchAndDevelopment,
            research_and_development_vector: rdVector,

            // Quantitative
            net_sales: xbrlData.netSales,
            operating_income: xbrlData.operatingIncome,
            ordinary_income: xbrlData.ordinaryIncome,
            net_income: xbrlData.netIncome,
            net_assets: xbrlData.netAssets,
            total_assets: xbrlData.totalAssets,
            earnings_per_share: xbrlData.earningsPerShare,
            book_value_per_share: xbrlData.bookValuePerShare,
            equity_to_total_assets_ratio: xbrlData.equityToAssetRatio,
            rate_of_return_on_equity: xbrlData.rateOfReturnOnEquity
        };
    }

    private cleanText(text: any): string {
        if (!text || typeof text !== 'string') return '';
        return text.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
    }

    private async vectorize(text: string): Promise<number[]> {
        if (!text) return [];
        try {
            const output = await this.extractor(text, { pooling: 'mean', normalize: true });
            return Array.from(output.data) as number[];
        } catch (e) {
            this.logger.error(`Vectorization failed: ${e}`);
            return [];
        }
    }
}
