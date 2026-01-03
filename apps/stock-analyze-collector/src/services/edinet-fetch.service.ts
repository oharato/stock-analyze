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
        if (process.env.USE_GPU === 'true') {
            this.logger.info('Initializing vectorization model (GPU enabled)...');
            const { pipeline } = await import('@xenova/transformers');
            // @ts-ignore - device option is present in runtime but missing in types
            this.extractor = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', { device: 'gpu' });
        } else {
            this.logger.info('Initializing vectorization model (CPU)...');
            const { pipeline } = await import('@xenova/transformers');
            this.extractor = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
        }
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
        await this.updateMetadata(years);

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

            this.logger.info(`Found ${targetDocs.length} potential documents. Processing...`);

            await this.processDocsByMonth(targetDocs);

        } finally {
            repo.close();
        }
    }

    /**
     * Update local EDINET metadata DB
     */
    private async updateMetadata(years?: number): Promise<void> {
        const periodStr = years ? `past ${years} years` : 'default period';
        this.logger.info(`Updating EDINET metadata (Seeding) for ${periodStr}...`);

        let startOption: Date | undefined;
        if (years) {
            startOption = new Date();
            startOption.setFullYear(startOption.getFullYear() - years);
        }

        const seeder = new EdinetInfoSeeder({
            apiKey: this.apiKey!,
            dbPath: this.edinetDbPath,
            skipExisting: true,
            start: startOption,
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
                this.logger.info(`No documents found in this period.`);
                return 0;
            }

            this.logger.info(`Found ${targetDocs.length} document(s). Processing...`);

            await this.processDocsByMonth(targetDocs);
            processedCount = targetDocs.length;

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
     * Group docs by month and process in batches
     */
    private async processDocsByMonth(docs: any[]): Promise<void> {
        if (docs.length === 0) return;

        this.logger.info(`Found ${docs.length} documents. Sorting and grouping by month...`);

        // Sort by date (oldest first)
        docs.sort((a: any, b: any) => {
            const da = a.submitDate || a.date;
            const db = b.submitDate || b.date;
            return da.localeCompare(db);
        });

        // Group by Month (YYYY-MM)
        const docsByMonth: { [key: string]: any[] } = {};
        for (const doc of docs) {
            const date = doc.submitDate || doc.date;
            if (!date) continue;
            const monthKey = date.slice(0, 7); // YYYY-MM
            if (!docsByMonth[monthKey]) docsByMonth[monthKey] = [];
            docsByMonth[monthKey].push(doc);
        }

        const monthKeys = Object.keys(docsByMonth).sort();
        this.logger.info(`Processing ${monthKeys.length} monthly batches: ${monthKeys.join(', ')}`);

        const currentMonthKey = new Date().toISOString().slice(0, 7);

        for (const monthKey of monthKeys) {
            const docsInMonth = docsByMonth[monthKey];
            const isCurrentMonth = monthKey === currentMonthKey;
            const outputDir = path.join(this.dataDir, 'monthly'); // data/raw/edinet/monthly
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            const outputPath = path.join(outputDir, `${monthKey}.parquet`);

            // SKIP Logic:
            // If past month AND file exists -> SKIP completely
            // If current month OR file missing -> PROCESS (Merge with existing if current month)
            if (!isCurrentMonth && fs.existsSync(outputPath)) {
                this.logger.info(`[batch] Skipping ${monthKey} (Past month, file exists: ${docsInMonth.length} docs in DB)`);
                continue;
            }

            this.logger.info(`[batch] Processing ${monthKey} (Docs: ${docsInMonth.length}, IsCurrent: ${isCurrentMonth})`);

            // Load existing docIDs if file exists
            const existingDocIds = new Set<string>();
            let existingRows: any[] = [];

            if (fs.existsSync(outputPath)) {
                this.logger.info(`  -> Loading existing parquet file to merge...`);
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
                    this.logger.info(`  -> Loaded ${existingRows.length} existing records.`);
                } catch (e: any) {
                    this.logger.warn(`  -> Failed to read existing parquet (will overwrite): ${e.message}`);
                    existingRows = []; // corrupted? overwrite
                }
            }

            // Filter docs that need processing
            const docsToProcess = docsInMonth.filter(d => !existingDocIds.has(d.docID));

            if (docsToProcess.length === 0) {
                this.logger.info(`  -> No new documents to process for ${monthKey}.`);
                continue;
            }

            this.logger.info(`  -> Processing ${docsToProcess.length} new documents...`);

            const newRows: any[] = [];
            let batchProcessed = 0;

            for (let i = 0; i < docsToProcess.length; i++) {
                const doc = docsToProcess[i];
                // @ts-ignore
                const docDate = doc.submitDate || doc.date;
                const ticker = doc.secCode ? doc.secCode.slice(0, 4) : 'UNKNOWN';

                try {
                    const rowData = await this.processDocumentData(doc, docDate, ticker);
                    if (rowData) {
                        newRows.push(rowData);
                        batchProcessed++;
                    }
                } catch (e: any) {
                    this.logger.warn(`Failed to process ${doc.docID}: ${e.message}`);
                }

                if ((i + 1) % 10 === 0) {
                    process.stdout.write('.');
                }
            }
            process.stdout.write('\n');

            if (newRows.length > 0) {
                // Merge and Write
                const finalRows = [...existingRows, ...newRows];
                finalRows.sort((a, b) => (a.submit_date || '').localeCompare(b.submit_date || ''));

                this.logger.info(`  -> Writing ${finalRows.length} records to ${outputPath}...`);
                await this.writeParquetFile(outputPath, finalRows);
            }
        }
    }

    /**
     * Download, Parse, Vectorize and return data object (NO File Write)
     */
    private async processDocumentData(doc: any, docDate: string, ticker: string): Promise<any | null> {
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
                return null;
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

        const saveData = await this.buildSaveData(ticker, doc.docID, docDate, commonMetadata, qualInfo, metrics, shareholders, parsed);

        // Convert to Parquet friendly format (JSON fields to string)
        const parquetRecord = {
            ...saveData,
            major_shareholders: JSON.stringify(saveData.major_shareholders)
        };

        return parquetRecord;
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
            throw new Error(`Parquet write failed: ${e.message}`);
        }
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
        shareholders: ShareholderInfo[],
        parsed: any
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

        // Extended fields from JPPFS Taxonomies
        const jppfs = parsed.getJppfsCor();
        const shareholdersEquity = jppfs.ShareholdersEquity;
        const retainedEarnings = jppfs.RetainedEarnings;
        const shortTermLoans = jppfs.ShortTermLoansPayable;
        const longTermLoans = jppfs.LongTermLoansPayable;
        const capex = -(jppfs.PurchaseOfPropertyPlantAndEquipmentInvCF || jppfs.PurchaseOfPropertyPlantAndEquipmentAndIntangibleAssetsInvCF || 0);
        const dividendTotal = -(jppfs.CashDividendsPaidFinCF || 0);
        const buybacks = -(jppfs.PurchaseOfTreasuryStockFinCF || jppfs.PurchaseOfTreasuryStock || 0);

        // Calculated fields
        const netIncome = metrics.netIncome || 0;
        const totalAssets = metrics.totalAssets || 0;
        const netSales = metrics.netSales || 0;
        const ocf = metrics.operatingCashFlow || jppfs.NetCashProvidedByUsedInOperatingActivities || 0;
        const netAssets = metrics.netAssets || jppfs.NetAssets || 0;

        const roa = totalAssets > 0 ? (netIncome / totalAssets) * 100 : undefined;
        const ocfMargin = netSales > 0 ? (ocf / netSales) * 100 : undefined;
        const totalPayout = (dividendTotal + buybacks);
        const totalPayoutRatio = netIncome > 0 ? (totalPayout / netIncome) * 100 : undefined;
        const doe = netAssets > 0 ? (dividendTotal / netAssets) * 100 : undefined;

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

            // Additional expanded fields
            shareholders_equity: shareholdersEquity,
            retained_earnings: retainedEarnings,
            short_term_loans: shortTermLoans,
            long_term_loans: longTermLoans,
            capex,
            dividend_total: dividendTotal,
            buybacks,
            roa,
            ocf_margin: ocfMargin,
            total_payout_ratio: totalPayoutRatio,
            doe,

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
