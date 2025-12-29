import { Api } from '../services/api';

/**
 * サイドバーコンポーネント
 */
export const Sidebar = () => ({
    tables: [] as string[],
    loadingTables: false,

    async init() {
        this.loadingTables = true;
        try {
            const allTables = await Api.fetchTables();
            const allowedTables = ['companies', 'edinet', 'fundamentals', 'large_shareholdings', 'prices'];
            this.tables = allTables.filter(t => allowedTables.includes(t));
        } catch (e) {
            console.error('Failed to fetch tables', e);
        } finally {
            this.loadingTables = false;
        }
    },

    navigate(table: string) {
        if (table === 'companies') {
            window.location.href = '/companies.html';
        } else if (table === 'edinet') {
            window.location.href = '/edinet.html';
        } else if (table === 'fundamentals') {
            window.location.href = '/fundamentals.html';
        } else if (table === 'large_shareholdings') {
            window.location.href = '/large_shareholdings.html';
        } else {
            window.location.href = `/?table=${table}`;
        }
    }
});
