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

    async process(ticker: string, doc: any, xbrlData: any): Promise<EdinetDataWithVectors> {
        const getVal = (obj: any, key: string) => obj && obj[key] ? obj[key] : undefined;

        // Text Keys
        const businessRisksKey = Object.keys(xbrlData).find(k => k.includes('BusinessRisks'));
        const mdaKey = Object.keys(xbrlData).find(k => k.includes('ManagementAnalysis') || k.includes('OperatingResults'));
        const governanceKey = Object.keys(xbrlData).find(k => k.includes('CorporateGovernance'));
        const rdKey = Object.keys(xbrlData).find(k => k.includes('ResearchAndDevelopment'));

        const cleanText = (text: any) => {
            if (typeof text !== 'string') return '';
            return text.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
        };

        const cleanRisks = cleanText(getVal(xbrlData, businessRisksKey || ''));
        const cleanMda = cleanText(getVal(xbrlData, mdaKey || ''));
        const cleanGovernance = cleanText(getVal(xbrlData, governanceKey || ''));
        const cleanRd = cleanText(getVal(xbrlData, rdKey || ''));

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
            const n = Number(val);
            return isNaN(n) ? undefined : n;
        };

        const findNum = (keys: string[]): number | undefined => {
            for (const k of keys) {
                const foundKey = Object.keys(xbrlData).find(xk => xk.toLowerCase().includes(k.toLowerCase()));
                if (foundKey && (xbrlData as any)[foundKey] !== undefined) {
                    return toNum((xbrlData as any)[foundKey]);
                }
            }
            return undefined;
        };

        const netSales = toNum((xbrlData as any).netSales) ?? findNum(['NetSales', 'OperatingRevenue']);
        const operatingIncome = toNum((xbrlData as any).operatingIncome) ?? findNum(['OperatingIncome', 'OperatingProfit']);
        const ordinaryIncome = toNum((xbrlData as any).ordinaryIncome) ?? findNum(['OrdinaryIncome', 'OrdinaryProfit']);
        const netIncome = toNum((xbrlData as any).netIncome) ?? findNum(['NetIncome', 'ProfitLossAttributableToOwners']);
        const netAssets = toNum((xbrlData as any).netAssets) ?? findNum(['NetAssets', 'TotalNetAssets']);
        const totalAssets = toNum((xbrlData as any).totalAssets) ?? findNum(['TotalAssets']);
        const earningsPerShare = toNum((xbrlData as any).earningsPerShare) ?? findNum(['BasicEarningsLossPerShare']);
        const bookValuePerShare = toNum((xbrlData as any).bookValuePerShare) ?? findNum(['NetAssetsPerShare']);
        const equityToTotalAssetsRatio = toNum((xbrlData as any).equityToTotalAssetsRatio) ?? findNum(['EquityToAssetRatio']);
        const rateOfReturnOnEquity = toNum((xbrlData as any).rateOfReturnOnEquity) ?? findNum(['RateOfReturnOnEquity']);

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
