export interface EdinetDataWithVectors {
    // Metadata
    doc_id?: string;
    filer_name?: string;
    edinet_code?: string;
    doc_description?: string;
    submit_date?: string;

    ticker: string;
    docId: string;  // Keep for backward compatibility
    date: string;
    year: number;

    // Qualitative - All 6 QualitativeInfo fields
    business_policy?: string;
    business_policy_vector?: number[];
    business_risks?: string;
    business_risks_vector?: number[];
    mda?: string; // financialAnalysis
    mda_vector?: number[];
    business_description?: string;
    business_description_vector?: number[];
    company_history?: string;
    company_history_vector?: number[];
    research_and_development?: string;
    research_and_development_vector?: number[];
    corporate_governance?: string;  // Not in QualitativeInfo, kept for compatibility
    corporate_governance_vector?: number[];

    // Quantitative - All 19 KeyMetrics fields
    net_sales?: number;
    operating_income?: number;
    ordinary_income?: number;
    net_income?: number;
    net_assets?: number;
    total_assets?: number;
    operating_cash_flow?: number;
    investing_cash_flow?: number;
    financing_cash_flow?: number;
    cash_and_equivalents?: number;
    earnings_per_share?: number;
    book_value_per_share?: number;
    equity_to_total_assets_ratio?: number;
    rate_of_return_on_equity?: number;
    price_earnings_ratio?: number;
    payout_ratio?: number;
    number_of_issued_shares?: number;
    dividend_paid_per_share?: number;

    // Shareholders
    major_shareholders?: any[];
}
