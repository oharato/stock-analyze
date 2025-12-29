/**
 * ユーティリティモジュール
 * データのフォーマットなどを行います。
 */
export const Utils = {
    /**
     * 値を読みやすい形式にフォーマットします。
     */
    formatValue(val: unknown, key?: string): string {
        if (val === null || val === undefined) return '-';

        const noCommaKeys = ['ticker', 'year', 'code', '証券コード', '年度', '年', 'fiscal_year'];
        const isNoComma = key && noCommaKeys.includes(key.toLowerCase());

        // 数値の場合
        if (typeof val === 'number') {
            if (isNoComma) return String(val);
            return new Intl.NumberFormat('ja-JP').format(val);
        }

        // 文字列が数値のように見える場合
        if (typeof val === 'string' && val !== '' && !isNaN(Number(val)) && !val.includes('-')) {
            if (isNoComma) return val;
            const num = parseFloat(val);
            return new Intl.NumberFormat('ja-JP').format(num);
        }

        // 日付文字列（ISO 8601等）の簡易判定と整形
        if (typeof val === 'string' && val.length >= 10 && val.includes('-')) {
            const date = new Date(val);
            if (!isNaN(date.getTime())) {
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                return `${y}/${m}/${d}`;
            }
        }

        return String(val);
    }
};
