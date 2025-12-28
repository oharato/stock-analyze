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
    data: Record<string, unknown>[];
    columns: string[];
    page: number;
    limit: number;
    totalRecords: number;
    totalPages: number;
    showDetails: boolean;
    selectedRow: Record<string, unknown>;
    filterQuery: string;
    filterOptions: FilterOptions;
    selectedFilters: SelectedFilters;
}
