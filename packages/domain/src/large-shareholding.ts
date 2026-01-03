
export interface LargeShareholding {
    doc_id: string;
    submit_date: string;
    filer_name?: string;
    ticker: string;
    doc_description?: string;
    doc_type_code?: string;
    holding_purpose?: string;
    holding_ratio?: number;
    prev_holding_ratio?: number;
    total_shares_held?: number;
}
