/**
 * ユーティリティモジュール
 * データ変換やフォーマットを行うヘルパー関数を提供します。
 */
export const Utils = {
    /**
     * テーブルセルの値を表示用にフォーマットします。
     * @param {any} val 値
     * @returns {string} フォーマットされた文字列
     */
    formatValue(val) {
        if (val === null || val === undefined) return '-';
        if (typeof val === 'object') return JSON.stringify(val);
        return val;
    },

    /**
     * 日付文字列または数値から YYYY-MM-DD 形式の日付文字列を生成します。
     * @param {string|number} dateVal 日付データ (YYYYMMDD形式またはタイムスタンプ)
     * @returns {string} YYYY-MM-DD 形式の文字列
     */
    formatDate(dateVal) {
        const dateStr = String(dateVal);

        if (dateStr.length === 8) {
            // YYYYMMDD 形式
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            return `${year}-${month}-${day}`;
        } else if (dateStr.length >= 10) {
            // Unixタイムスタンプ (ミリ秒または秒)
            const timestamp = parseInt(dateStr);
            const date = new Date(timestamp);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } else {
            // フォールバック: そのまま返す
            return dateStr;
        }
    }
};
