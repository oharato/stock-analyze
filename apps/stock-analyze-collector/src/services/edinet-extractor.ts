import { LoggerService } from './logger.service.js';

export interface EdinetDataWithVectors {
    ticker: string;
    docId: string;
    date: string;
    year: number;
    // Qualitative
    business_risks?: string;
    business_risks_vector?: number[];
    mda?: string; // Management Analysis
    mda_vector?: number[];
    corporate_governance?: string;
    corporate_governance_vector?: number[];
    research_and_development?: string;
    research_and_development_vector?: number[];

    // Quantitative (Key Metrics)
    net_sales?: number;
    operating_income?: number;
    ordinary_income?: number;
    net_income?: number;
    net_assets?: number;
    total_assets?: number;
    earnings_per_share?: number;
    book_value_per_share?: number;
    equity_to_total_assets_ratio?: number;
    rate_of_return_on_equity?: number;

    major_shareholders?: any[];
}

export class EdinetExtractor {
    private logger: LoggerService;
    private extractor: any;

    constructor(logger: LoggerService, extractor: any) {
        this.logger = logger;
        this.extractor = extractor;
    }

    async process(ticker: string, doc: any, xbrlData: any, xbrlText?: string): Promise<EdinetDataWithVectors> {
        const getVal = (obj: any, key: string) => obj && obj[key] ? obj[key] : undefined;

        // Helper to find value in dataMap if available
        const getFromMap = (keyPart: string) => {
            if (!xbrlData || !xbrlData.dataMap) return undefined;
            const keys = Object.keys(xbrlData.dataMap);
            const foundKey = keys.find(k => k.toLowerCase().includes(keyPart.toLowerCase()));
            if (!foundKey) return undefined;
            const item = xbrlData.dataMap[foundKey];
            // item might be { value: "...", ... } or just "..."
            return (item && typeof item === 'object' && item.value) ? item.value : item;
        };

        // Fallback Regex Extraction (if parser failed or key missing)
        const extractByRegex = (tagPart: string, contextRef: string = 'CurrentYearDuration') => {
            if (!xbrlText) return undefined;
            // Look for <(prefix):TagName ... contextRef="CurrentYearDuration" ... >Value</...>
            // TagName should match tagPart (case independent?)
            // A simplified regex: <[^:]+:[^>]*tagPart[^>]*contextRef="contextRef"[^>]*>([^<]+)<
            const regex = new RegExp(`<[^:]+:[^>]*${tagPart}[^>]*contextRef="${contextRef}"[^>]*>([^<]+)<`, 'i');
            const match = xbrlText.match(regex);
            return match ? match[1] : undefined;
        };

        // Text Keys
        let businessRisks = getFromMap('BusinessRisks');
        let mda = getFromMap('ManagementAnalysis') || getFromMap('OperatingResults');
        let governance = getFromMap('CorporateGovernance');
        let rd = getFromMap('ResearchAndDevelopment');

        // Text Regex Fallback (optional)

        const cleanText = (text: any) => {
            if (!text || typeof text !== 'string') return '';
            return text.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
        };

        const cleanRisks = cleanText(businessRisks);
        const cleanMda = cleanText(mda);
        const cleanGovernance = cleanText(governance);
        const cleanRd = cleanText(rd);

        this.logger.info(`Extracted Risks: ${cleanRisks.length}, MDA: ${cleanMda.length}, Gov: ${cleanGovernance.length}, R&D: ${cleanRd.length} chars`);

        // Vectorization
        const vectorize = async (text: string) => {
            if (!text) return [];
            try {
                const output = await this.extractor(text, { pooling: 'mean', normalize: true });
                return Array.from(output.data) as number[];
            } catch (e) {
                this.logger.error(`Vectorization failed: ${e}`);
                return [];
            }
        };

        const businessRisksVector = await vectorize(cleanRisks);
        const mdaVector = await vectorize(cleanMda);
        const governanceVector = await vectorize(cleanGovernance);
        const rdVector = await vectorize(cleanRd);

        // Quantitative Extraction (Key Metrics)
        const toNum = (val: any) => {
            if (val === undefined || val === null || val === '') return undefined;
            if (typeof val === 'string') {
                val = val.replace(/,/g, ''); // Remove commas
            }
            const n = Number(val);
            return isNaN(n) ? undefined : n;
        };

        const findNum = (keys: string[]): number | undefined => {
            // 1. Try xbrlData (flat or Map)
            for (const k of keys) {
                // Try flat property first (if parser worked that way)
                if ((xbrlData as any)[k] !== undefined) return toNum((xbrlData as any)[k]);

                // Try dataMap
                const mapVal = getFromMap(k);
                if (mapVal !== undefined) return toNum(mapVal);
            }

            // 2. Try Regex Fallback if xbrlText provided
            if (xbrlText) {
                for (const k of keys) {
                    const regexVal = extractByRegex(k, 'CurrentYearDuration');
                    if (regexVal) return toNum(regexVal);

                    // Try NonConsolidated if Consolidated missing?
                    const regexValNonCon = extractByRegex(k, 'CurrentYearDuration_NonConsolidatedMember');
                    if (regexValNonCon) return toNum(regexValNonCon);
                }
            }

            return undefined;
        };

        const netSales = findNum(['NetSales', 'OperatingRevenue']);
        const operatingIncome = findNum(['OperatingIncome', 'OperatingProfit']);
        const ordinaryIncome = findNum(['OrdinaryIncome', 'OrdinaryProfit']);
        const netIncome = findNum(['NetIncome', 'ProfitLossAttributableToOwners']);
        const netAssets = findNum(['NetAssets', 'TotalNetAssets']);
        const totalAssets = findNum(['TotalAssets']);
        const earningsPerShare = findNum(['BasicEarningsLossPerShare']);
        const bookValuePerShare = findNum(['NetAssetsPerShare']);
        const equityToTotalAssetsRatio = findNum(['EquityToAssetRatio']);
        const rateOfReturnOnEquity = findNum(['RateOfReturnOnEquity']);

        return {
            ticker,
            docId: doc.docID,
            date: doc.date,
            year: new Date(doc.date).getFullYear(),

            // Qualitative
            business_risks: cleanRisks,
            business_risks_vector: businessRisksVector,
            mda: cleanMda,
            mda_vector: mdaVector,
            corporate_governance: cleanGovernance,
            corporate_governance_vector: governanceVector,
            research_and_development: cleanRd,
            research_and_development_vector: rdVector,

            // Quantitative
            net_sales: netSales,
            operating_income: operatingIncome,
            ordinary_income: ordinaryIncome,
            net_income: netIncome,
            net_assets: netAssets,
            total_assets: totalAssets,
            earnings_per_share: earningsPerShare,
            book_value_per_share: bookValuePerShare,
            equity_to_total_assets_ratio: equityToTotalAssetsRatio,
            rate_of_return_on_equity: rateOfReturnOnEquity
        };
    }
}
