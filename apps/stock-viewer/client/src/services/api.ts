import { TableDataResponse, SelectedFilters, PriceData, Company, EdinetData, FundamentalData, LargeShareholdingData } from '../types';

/**
 * API通信モジュール
 * サーバーとのデータ通信を担当します。
 */
export const Api = {
    /**
     * 利用可能なテーブル一覧を取得します。
     */
    async fetchTables(): Promise<string[]> {
        const res = await fetch('/api/tables');
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return await res.json();
    },

    /**
     * 指定されたテーブルのデータを取得します。
     */
    async fetchTableData(table: string, page: number = 1, limit: number = 50): Promise<TableDataResponse> {
        const res = await fetch(`/api/table/${table}?page=${page}&limit=${limit}`);
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return await res.json();
    },

    /**
     * 指定された銘柄コードの直近120日の株価データを取得します。
     */
    async fetchPriceData(code: string): Promise<PriceData[]> {
        const sql = `
            SELECT date, open, high, low, close, volume 
            FROM (
                SELECT date, open, high, low, close, volume, 
                        row_number() OVER (PARTITION BY date ORDER BY date) as rn
                FROM prices 
                WHERE code = ${code}
            ) 
            WHERE rn = 1
            ORDER BY date DESC 
            LIMIT 120
        `;
        return this.executeQuery<PriceData>(sql);
    },

    /**
     * 汎用的なSQLクエリを実行します。
     */
    async executeQuery<T = any>(sql: string): Promise<T[]> {
        const res = await fetch(`/api/query?sql=${encodeURIComponent(sql)}`);
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return await res.json();
    },

    /**
     * companiesテーブルを検索します。
     */
    async searchCompanies(query: string, filters: SelectedFilters, page: number = 1, limit: number = 50): Promise<TableDataResponse> {
        const offset = (page - 1) * limit;
        const escapedQuery = query.replace(/'/g, "''");

        const conditions: string[] = [];
        if (escapedQuery.trim()) {
            conditions.push(`(code LIKE '%${escapedQuery}%' OR name LIKE '%${escapedQuery}%')`);
        }

        const filterColumns: (keyof SelectedFilters)[] = ['market', 'sector33', 'sector17', 'scale'];
        for (const col of filterColumns) {
            if (filters[col] && filters[col].length > 0) {
                const values = filters[col].map(v => `'${v.replace(/'/g, "''")}'`).join(',');
                conditions.push(`${col} IN (${values})`);
            }
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const sql = `
            SELECT * FROM companies 
            ${whereClause}
            ORDER BY code
            LIMIT ${limit} OFFSET ${offset}
        `;
        const countSql = `
            SELECT COUNT(*) as count FROM companies 
            ${whereClause}
        `;

        const [data, countRes] = await Promise.all([
            this.executeQuery<Company>(sql),
            this.executeQuery<{ count: number }>(countSql)
        ]);

        const total = countRes[0]?.count || 0;
        const columns = data.length > 0 ? Object.keys(data[0]) : [];

        return {
            data,
            columns,
            total,
            totalPages: Math.ceil(total / limit)
        };
    },

    /**
     * companiesテーブルのフィルタオプションを取得します。
     */
    async fetchFilterOptions(): Promise<SelectedFilters> {
        const columns = ['market', 'sector33', 'sector17', 'scale'];
        const results = await Promise.all(
            columns.map(col => this.executeQuery<any>(`SELECT DISTINCT ${col} FROM companies WHERE ${col} IS NOT NULL AND ${col} != '' ORDER BY ${col}`))
        );

        return {
            market: results[0].map((r: any) => r.market),
            sector33: results[1].map((r: any) => r.sector33),
            sector17: results[2].map((r: any) => r.sector17),
            scale: results[3].map((r: any) => r.scale)
        };
    },

    /**
     * edinetテーブルをベクトル検索します。
     */
    async searchEdinet(query: string, target: string = 'business_risks', page: number = 1, limit: number = 50): Promise<TableDataResponse> {
        const res = await fetch(`/api/search/edinet?q=${encodeURIComponent(query)}&target=${target}&page=${page}&limit=${limit}`);
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return await res.json();
    },

    /**
     * 会社に関連するすべての情報を取得します。
     */
    async fetchCompanyDetails(code: string): Promise<{
        company: Company;
        edinet: EdinetData[];
        fundamentals: FundamentalData[];
        largeShareholdings: LargeShareholdingData[];
    }> {
        const [companyRes, edinet, fundamentals, largeShareholdings] = await Promise.all([
            this.executeQuery<Company>(`SELECT * FROM companies WHERE code = '${code}'`),
            this.executeQuery<EdinetData>(`SELECT * FROM edinet WHERE ticker = '${code}' ORDER BY date DESC`),
            this.executeQuery<FundamentalData>(`SELECT * FROM fundamentals WHERE code = '${code}' ORDER BY year DESC`),
            this.executeQuery<LargeShareholdingData>(`SELECT * FROM large_shareholdings WHERE ticker = '${code}' ORDER BY submit_date DESC`),
        ]);

        return {
            company: companyRes[0],
            edinet,
            fundamentals,
            largeShareholdings
        };
    },

    /**
     * 週足の株価データを取得します（直近2年分 = 104週）。
     */
    async fetchWeeklyPriceData(code: string): Promise<PriceData[]> {
        const sql = `
            SELECT 
                date_trunc('week', datef) as date,
                FIRST(open) as open,
                MAX(high) as high,
                MIN(low) as low,
                LAST(close) as close,
                SUM(volume) as volume
            FROM prices 
            WHERE code = ${code}
            GROUP BY 1
            ORDER BY 1 DESC
            LIMIT 104
        `;
        return this.executeQuery<PriceData>(sql);
    },

    /**
     * 月足の株価データを取得します（直近10年分 = 120ヶ月）。
     */
    async fetchMonthlyPriceData(code: string): Promise<PriceData[]> {
        const sql = `
            SELECT 
                date_trunc('month', datef) as date,
                FIRST(open) as open,
                MAX(high) as high,
                MIN(low) as low,
                LAST(close) as close,
                SUM(volume) as volume
            FROM prices 
            WHERE code = ${code}
            GROUP BY 1
            ORDER BY 1 DESC
            LIMIT 120
        `;
        return this.executeQuery<PriceData>(sql);
    }
};
