/**
 * 型定義
 */

// テーブルデータのレスポンス型
export interface TableDataResponse {
    data: Record<string, unknown>[];
    columns: string[];
    total: number;
    totalPages: number;
}

// 会社データ型
export interface Company {
    code: string;
    name: string;
    market?: string;
    sector33?: string;
    sector17?: string;
    scale?: string;
    [key: string]: unknown;
}

// EDINETデータ型
export interface EdinetData {
    doc_id: string;
    ticker?: string;
    filer_name: string;
    doc_description: string;
    submit_date: string;
    business_risks?: string;
    business_policy?: string;
    mda?: string;
    [key: string]: unknown;
}

// 財務データ型
export interface FundamentalData {
    code: string;
    name: string;
    year: number;
    quarter: number;
    sales?: number;
    ext_sales?: number;
    op_income?: number;
    net_income?: number;
    total_assets?: number;
    net_assets?: number;
    [key: string]: unknown;
}

// 大量保有データ型
export interface LargeShareholdingData {
    doc_id: string;
    ticker: string;
    filer_name: string;
    submit_date: string;
    holding_ratio: number;
    [key: string]: unknown;
}

// 株価データ型
export interface PriceData {
    date: string | number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

// チャートデータ型 (Lightweight Charts用)
export interface CandlestickData {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
}

// フィルタオプション型
export interface FilterOptions {
    market: string[];
    sector33: string[];
    sector17: string[];
    scale: string[];
}

// 選択されたフィルタ型
export interface SelectedFilters {
    market: string[];
    sector33: string[];
    sector17: string[];
    scale: string[];
}

// Alpine.jsアプリケーションステート
export interface AppState {
    tables: string[];
    currentTable: string | null;
    loadingTables: boolean;
    loadingData: boolean;
    data: (Company | EdinetData | FundamentalData | LargeShareholdingData | Record<string, unknown>)[];
    columns: string[];
    page: number;
    limit: number;
    totalRecords: number;
    totalPages: number;
    showDetails: boolean;
    selectedRow: any;
    filterQuery: string;
    filterOptions: FilterOptions;
    selectedFilters: SelectedFilters;
}
