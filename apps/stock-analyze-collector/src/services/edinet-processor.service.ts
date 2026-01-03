import { EdinetXbrlParser, QualitativeInfo, KeyMetrics, CommonMetadata, ShareholderInfo } from 'edinet-ts';
import { LoggerService } from './logger.service.js';
import { EdinetCommonService } from './edinet-common.service.js';
import { VectorizationService } from './vectorization.service.js';
import { EdinetDataWithVectors } from '../types/edinet.js';

export class EdinetProcessorService {
    private parser: EdinetXbrlParser;

    constructor(
        private readonly logger: LoggerService,
        private readonly commonService: EdinetCommonService,
        private readonly vectorizationService: VectorizationService
    ) {
        this.parser = new EdinetXbrlParser();
    }

    /**
     * ダウンロード、パース、ベクトル化を行い、データオブジェクトを返す
     */
    async process(doc: any, docDate: string, ticker: string): Promise<any | null> {
        // XBRL取得 (キャッシュまたはAPI)
        const xbrlText = await this.commonService.fetchXbrl(doc.docID);
        if (!xbrlText) return null;

        const parsed = this.parser.parse(xbrlText);
        const commonMetadata = parsed.getCommonMetadata();
        let qualInfo = parsed.getQualitativeInfo();
        let metrics = parsed.getKeyMetrics();
        const shareholders = parsed.getMajorShareholders();

        // テキスト抽出に失敗した場合のフォールバック (四半期報/半期報告書でよくある)
        if (!qualInfo.businessRisks && !qualInfo.financialAnalysis) {
            this.logger.info('標準パースでテキストが不足しています。フォールバック正規表現パースを使用します...');
            const fallbackResult = this.parseFallback(xbrlText);
            qualInfo = fallbackResult.qualInfo;
            metrics = { ...metrics, ...fallbackResult.metrics };
        }

        const saveData = await this.buildSaveData(ticker, doc.docID, docDate, commonMetadata, qualInfo, metrics, shareholders, parsed);

        // Parquet形式に変換 (JSONフィールドを文字列化)
        return {
            ...saveData,
            major_shareholders: JSON.stringify(saveData.major_shareholders)
        };
    }

    private parseFallback(xml: string): { qualInfo: QualitativeInfo; metrics: Partial<KeyMetrics> } {
        // 共通サービスのユーティリティを使用
        const extractText = (tag: string) => this.commonService.extractText(xml, tag);
        const extractNumber = (tag: string) => this.commonService.extractNumber(xml, tag);

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
        // テキストフィールド
        const businessPolicy = qualInfo.businessPolicy || '';
        const businessRisks = qualInfo.businessRisks || '';
        const mda = qualInfo.financialAnalysis || '';
        const businessDescription = qualInfo.businessDescription || '';
        const companyHistory = qualInfo.companyHistory || '';
        const researchAndDevelopment = qualInfo.researchAndDevelopment || '';

        // ベクトル化
        const [
            businessPolicyVector,
            businessRisksVector,
            mdaVector,
            businessDescriptionVector,
            companyHistoryVector,
            rdVector
        ] = await Promise.all([
            this.vectorizationService.vectorize(businessPolicy),
            this.vectorizationService.vectorize(businessRisks),
            this.vectorizationService.vectorize(mda),
            this.vectorizationService.vectorize(businessDescription),
            this.vectorizationService.vectorize(companyHistory),
            this.vectorizationService.vectorize(researchAndDevelopment)
        ]);

        // JPPFSタクソノミーからの拡張フィールド
        const jppfs = parsed.getJppfsCor();
        const shareholdersEquity = jppfs.ShareholdersEquity;
        const retainedEarnings = jppfs.RetainedEarnings;
        const shortTermLoans = jppfs.ShortTermLoansPayable;
        const longTermLoans = jppfs.LongTermLoansPayable;
        const capex = -(jppfs.PurchaseOfPropertyPlantAndEquipmentInvCF || jppfs.PurchaseOfPropertyPlantAndEquipmentAndIntangibleAssetsInvCF || 0);
        const dividendTotal = -(jppfs.CashDividendsPaidFinCF || 0);
        const buybacks = -(jppfs.PurchaseOfTreasuryStockFinCF || jppfs.PurchaseOfTreasuryStock || 0);

        // 計算フィールド
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
            doc_id: commonMetadata.docID,
            filer_name: commonMetadata.filerName,
            edinet_code: commonMetadata.edinetCode,
            doc_description: commonMetadata.docDescription,
            submit_date: commonMetadata.submitDate,
            ticker,
            year: new Date(docDate).getFullYear(),
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
            corporate_governance: '',
            corporate_governance_vector: [],
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
            major_shareholders: shareholders
        };
    }
}
