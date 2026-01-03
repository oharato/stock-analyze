
export interface EdinetFinancial {
    doc_id: string;
    filer_name?: string;
    edinet_code?: string;
    doc_description?: string;
    submit_date?: string;
    ticker: string;
    year: number;

    // Qualitative
    business_policy?: string;
    business_policy_vector?: number[];
    business_risks?: string;
    business_risks_vector?: number[];
    mda?: string;
    mda_vector?: number[];
    business_description?: string;
    business_description_vector?: number[];
    company_history?: string;
    company_history_vector?: number[];
    research_and_development?: string;
    research_and_development_vector?: number[];
    corporate_governance?: string;
    corporate_governance_vector?: number[];

    // Quantitative
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

    // Expanded
    shareholders_equity?: number;
    retained_earnings?: number;
    short_term_loans?: number;
    long_term_loans?: number;
    capex?: number;
    dividend_total?: number;
    buybacks?: number;
    roa?: number;
    ocf_margin?: number;
    total_payout_ratio?: number;
    doe?: number;

    // JSON string
    major_shareholders?: string;

    // Extra
    date?: string; // Duplicate of submit_date sometimes
    docId?: string; // Duplicate of doc_id
}
