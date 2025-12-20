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
