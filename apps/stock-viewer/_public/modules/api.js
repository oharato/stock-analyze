/**
 * API通信モジュール
 * サーバーとのデータ通信を担当します。
 */
export const Api = {
    /**
     * 利用可能なテーブル一覧を取得します。
     * @returns {Promise<string[]>} テーブル名の配列
     */
    async fetchTables() {
        try {
            const res = await fetch('/api/tables');
            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            return await res.json();
        } catch (e) {
            console.error("テーブル一覧の取得に失敗しました", e);
            throw e;
        }
    },

    /**
     * 指定されたテーブルのデータを取得します。
     * @param {string} table テーブル名
     * @param {number} page ページ番号 (デフォルト: 1)
     * @param {number} limit 1ページあたりの件数 (デフォルト: 50)
     * @returns {Promise<object>} { data, columns, total, totalPages }
     */
    async fetchTableData(table, page = 1, limit = 50) {
        try {
            const res = await fetch(`/api/table/${table}?page=${page}&limit=${limit}`);
            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            return await res.json();
        } catch (e) {
            console.error("データの取得に失敗しました", e);
            throw e;
        }
    },

    /**
     * 指定された銘柄コードの全期間の株価データを取得します。
     * @param {string} code 銘柄コード
     * @returns {Promise<object[]>} 株価データの配列 (新しい順)
     */
    async fetchPriceData(code) {
        try {
            // 全期間の履歴を取得
            // 最新の日付から取得するため DESC でソート
            const sql = `SELECT date, open, high, low, close, volume FROM prices WHERE code = '${code}' ORDER BY date DESC`;
            const res = await fetch(`/api/query?sql=${encodeURIComponent(sql)}`);
            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            return await res.json();
        } catch (e) {
            console.error("株価データの取得に失敗しました", e);
            throw e;
        }
    },

    /**
     * companiesテーブルを検索します。
     * @param {string} query 検索クエリ（銘柄コードまたは会社名）
     * @param {object} filters 選択されたフィルタ { market: [], sector33: [], sector17: [], scale: [] }
     * @param {number} page ページ番号
     * @param {number} limit 1ページあたりの件数
     * @returns {Promise<object>} { data, columns, total, totalPages }
     */
    async searchCompanies(query, filters = {}, page = 1, limit = 50) {
        try {
            const offset = (page - 1) * limit;
            // SQLインジェクション対策: クエリをエスケープ
            const escapedQuery = query.replace(/'/g, "''");

            // WHERE条件を構築
            const conditions = [];

            // テキスト検索条件
            if (escapedQuery.trim()) {
                conditions.push(`(code LIKE '%${escapedQuery}%' OR name LIKE '%${escapedQuery}%')`);
            }

            // ドロップダウンフィルタ条件
            const filterColumns = ['market', 'sector33', 'sector17', 'scale'];
            for (const col of filterColumns) {
                if (filters[col] && filters[col].length > 0) {
                    const values = filters[col].map(v => `'${v.replace(/'/g, "''")}'`).join(',');
                    conditions.push(`${col} IN (${values})`);
                }
            }

            const whereClause = conditions.length > 0
                ? `WHERE ${conditions.join(' AND ')}`
                : '';

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

            const [dataRes, countRes] = await Promise.all([
                fetch(`/api/query?sql=${encodeURIComponent(sql)}`),
                fetch(`/api/query?sql=${encodeURIComponent(countSql)}`)
            ]);

            if (!dataRes.ok || !countRes.ok) throw new Error('API Error');

            const data = await dataRes.json();
            const countData = await countRes.json();
            const total = countData[0]?.count || 0;

            // カラム名を取得
            const columns = data.length > 0 ? Object.keys(data[0]) : [];

            return {
                data,
                columns,
                total,
                totalPages: Math.ceil(total / limit)
            };
        } catch (e) {
            console.error("会社検索に失敗しました", e);
            throw e;
        }
    },

    /**
     * companies テーブルのフィルタオプション（ユニーク値）を取得します。
     * @returns {Promise<object>} { market, sector33, sector17, scale }
     */
    async fetchFilterOptions() {
        try {
            const columns = ['market', 'sector33', 'sector17', 'scale'];
            const queries = columns.map(col =>
                `SELECT DISTINCT ${col} FROM companies WHERE ${col} IS NOT NULL AND ${col} != '' ORDER BY ${col}`
            );

            const responses = await Promise.all(
                queries.map(sql => fetch(`/api/query?sql=${encodeURIComponent(sql)}`))
            );

            const results = await Promise.all(responses.map(r => r.json()));

            return {
                market: results[0].map(r => r.market),
                sector33: results[1].map(r => r.sector33),
                sector17: results[2].map(r => r.sector17),
                scale: results[3].map(r => r.scale)
            };
        } catch (e) {
            console.error("フィルタオプションの取得に失敗しました", e);
            throw e;
        }
    }
};
