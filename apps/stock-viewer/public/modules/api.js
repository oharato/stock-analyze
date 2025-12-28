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
    }
};
