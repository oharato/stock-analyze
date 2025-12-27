import * as fs from 'fs';
import * as path from 'path';
import { EdinetXbrlDownloader, EdinetXbrlParser, EdinetDocumentType, EdinetInfoSeeder, EdinetRepository, QualitativeInfo, KeyMetrics, CommonMetadata, ShareholderInfo } from 'edinet-ts';
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
            // Use local DB with indexes instead of API call for better performance
            const repo = new EdinetRepository(this.edinetDbPath);

            // Query local DB (uses idx_sec_doc_type_date index)
            const allDocs = await repo.findDocuments({});

            // Filter by secCode, date range, and document type
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
                this.logger.info(`No documents found in this period.`);
                return 0;
            }

            this.logger.info(`Found ${targetDocs.length} document(s). Processing...`);

            for (const doc of targetDocs) {
                // @ts-ignore - EdinetMetadata uses submitDate
                const docDate = doc.submitDate || doc.date;
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

        // Organize by ticker prefix (first character, handles both numeric and alphanumeric codes)
        // Examples: 1234 -> 1/, 130A -> 1/, 9999 -> 9/
        const tickerPrefix = ticker.charAt(0);
        const subDir = path.join(this.dataDir, tickerPrefix);

        // Ensure subdirectory exists
        if (!fs.existsSync(subDir)) {
            fs.mkdirSync(subDir, { recursive: true });
        }

        const filename = `${ticker}-${docDate}-${doc.docID}.json`;
        const filePath = path.join(subDir, filename);

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

        const parsed = this.parser.parse(xbrlText);
        const commonMetadata = parsed.getCommonMetadata();
        let qualInfo = parsed.getQualitativeInfo();
        let metrics = parsed.getKeyMetrics();
        const shareholders = parsed.getMajorShareholders();

        // Fallback if extracting text failed (common for Quarterly/Semi-Annual)
        if (!qualInfo.businessRisks && !qualInfo.financialAnalysis) {
            this.logger.info('Standard parsing returned incomplete text. Using fallback regex parsing...');
            const fallbackResult = this.parseFallback(xbrlText);
            qualInfo = fallbackResult.qualInfo;
            metrics = { ...metrics, ...fallbackResult.metrics };
        }

        const saveData = await this.buildSaveData(ticker, doc.docID, docDate, commonMetadata, qualInfo, metrics, shareholders);

        fs.writeFileSync(filePath, JSON.stringify(saveData), 'utf-8');
        this.logger.info(`Saved data with vectors to ${filePath}`);
        return true;
    }

    private parseFallback(xml: string): { qualInfo: QualitativeInfo; metrics: Partial<KeyMetrics> } {
        const extractText = (tagName: string) => {
            // Match content between <tag ...> and </tag>
            const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
            const match = xml.match(regex);
            if (!match) return undefined;

            // Decode HTML entities and remove tags
            let text = match[1];
            text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
            text = text.replace(/&amp;/g, '&').replace(/&quot;/g, '"');
            text = text.replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');
            text = text.replace(/<[^>]*>/g, ''); // Remove HTML tags
            text = text.replace(/\s+/g, ' ').trim();
            return text || undefined;
        };

        const extractNumber = (tagName: string): number | undefined => {
            // Extract numeric value from tag
            const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
            const match = xml.match(regex);
            if (!match) return undefined;

            const text = match[1].replace(/,/g, '').trim();
            const num = parseFloat(text);
            return isNaN(num) ? undefined : num;
        };

        return {
            qualInfo: {
                businessPolicy: extractText('jpcrp_cor:BusinessPolicyBusinessEnvironmentIssuesToAddressEtcTextBlock'),
                businessRisks: extractText('jpcrp_cor:BusinessRisksTextBlock'),
                financialAnalysis: extractText('jpcrp_cor:ManagementAnalysisOfFinancialPositionOperatingResultsAndCashFlowsTextBlock') ||
                    extractText('jpcrp_cor:ManagementAnalysisOfFinancialPositionEtcTextBlock'),
                businessDescription: extractText('jpcrp_cor:DescriptionOfBusinessTextBlock'),
                companyHistory: extractText('jpcrp_cor:CompanyHistoryTextBlock'),
                researchAndDevelopment: extractText('jpcrp_cor:ResearchAndDevelopmentActivitiesTextBlock')
            } as QualitativeInfo,
            metrics: {
                netSales: extractNumber('jpcrp_cor:NetSalesSummaryOfBusinessResults') ||
                    extractNumber('jppfs_cor:NetSales') ||
                    extractNumber('jpcrp_cor:NetSales'),
                operatingIncome: extractNumber('jpcrp_cor:OperatingIncomeLossSummaryOfBusinessResults') ||
                    extractNumber('jppfs_cor:OperatingIncome') ||
                    extractNumber('jpcrp_cor:OperatingIncome'),
                ordinaryIncome: extractNumber('jpcrp_cor:OrdinaryIncomeLossSummaryOfBusinessResults') ||
                    extractNumber('jppfs_cor:OrdinaryIncome') ||
                    extractNumber('jpcrp_cor:OrdinaryIncome'),
                netIncome: extractNumber('jpcrp_cor:ProfitLossAttributableToOwnersOfParentSummaryOfBusinessResults') ||
                    extractNumber('jppfs_cor:ProfitLoss') ||
                    extractNumber('jpcrp_cor:NetIncome'),
                netAssets: extractNumber('jpcrp_cor:NetAssetsSummaryOfBusinessResults') ||
                    extractNumber('jppfs_cor:NetAssets'),
                totalAssets: extractNumber('jpcrp_cor:TotalAssetsSummaryOfBusinessResults') ||
                    extractNumber('jppfs_cor:Assets'),
                earningsPerShare: extractNumber('jpcrp_cor:BasicEarningsLossPerShareSummaryOfBusinessResults') ||
                    extractNumber('jppfs_cor:BasicEarningsLossPerShare'),
                bookValuePerShare: extractNumber('jpcrp_cor:NetAssetsPerShareSummaryOfBusinessResults') ||
                    extractNumber('jppfs_cor:NetAssetsPerShare'),
                equityToTotalAssetsRatio: extractNumber('jpcrp_cor:EquityToAssetRatioSummaryOfBusinessResults') ||
                    extractNumber('jppfs_cor:EquityToAssetRatio'),
                rateOfReturnOnEquity: extractNumber('jpcrp_cor:RateOfReturnOnEquitySummaryOfBusinessResults') ||
                    extractNumber('jppfs_cor:RateOfReturnOnEquity')
            }
        };
    }

    /**
     * Construct the data object with vectorization
     */
    private async buildSaveData(
        ticker: string,
        docId: string,
        docDate: string,
        commonMetadata: CommonMetadata,
        qualInfo: QualitativeInfo,
        metrics: KeyMetrics,
        shareholders: ShareholderInfo[]
    ): Promise<EdinetDataWithVectors> {
        // Text fields (already cleaned by getQualitativeInfo())
        const businessPolicy = qualInfo.businessPolicy || '';
        const businessRisks = qualInfo.businessRisks || '';
        const mda = qualInfo.financialAnalysis || '';
        const businessDescription = qualInfo.businessDescription || '';
        const companyHistory = qualInfo.companyHistory || '';
        const researchAndDevelopment = qualInfo.researchAndDevelopment || '';

        // Vectorize
        const [
            businessPolicyVector,
            businessRisksVector,
            mdaVector,
            businessDescriptionVector,
            companyHistoryVector,
            rdVector
        ] = await Promise.all([
            this.vectorize(businessPolicy),
            this.vectorize(businessRisks),
            this.vectorize(mda),
            this.vectorize(businessDescription),
            this.vectorize(companyHistory),
            this.vectorize(researchAndDevelopment)
        ]);

        return {
            // Metadata
            doc_id: commonMetadata.docID,
            filer_name: commonMetadata.filerName,
            edinet_code: commonMetadata.edinetCode,
            doc_description: commonMetadata.docDescription,
            submit_date: commonMetadata.submitDate,

            ticker,
            year: new Date(docDate).getFullYear(),

            // Qualitative - All 6 fields
            business_policy: businessPolicy,
            business_policy_vector: businessPolicyVector,
            business_risks: businessRisks,
            business_risks_vector: businessRisksVector,
            mda: mda,
            mda_vector: mdaVector,
            business_description: businessDescription,
            business_description_vector: businessDescriptionVector,
            company_history: companyHistory,
            company_history_vector: companyHistoryVector,
            research_and_development: researchAndDevelopment,
            research_and_development_vector: rdVector,
            corporate_governance: '', // Not available in QualitativeInfo
            corporate_governance_vector: [],

            // Quantitative - All 19 fields
            net_sales: metrics.netSales,
            operating_income: metrics.operatingIncome,
            ordinary_income: metrics.ordinaryIncome,
            net_income: metrics.netIncome,
            net_assets: metrics.netAssets,
            total_assets: metrics.totalAssets,
            operating_cash_flow: metrics.operatingCashFlow,
            investing_cash_flow: metrics.investingCashFlow,
            financing_cash_flow: metrics.financingCashFlow,
            cash_and_equivalents: metrics.cashAndEquivalents,
            earnings_per_share: metrics.earningsPerShare,
            book_value_per_share: metrics.bookValuePerShare,
            equity_to_total_assets_ratio: metrics.equityToTotalAssetsRatio,
            rate_of_return_on_equity: metrics.rateOfReturnOnEquity,
            price_earnings_ratio: metrics.priceEarningsRatio,
            payout_ratio: metrics.payoutRatio,
            number_of_issued_shares: metrics.numberOfIssuedShares,
            dividend_paid_per_share: metrics.dividendPaidPerShare,

            // Shareholders
            major_shareholders: shareholders
        };
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
