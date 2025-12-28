import { initShared, Alpine, Api, Chart } from '../init';

/**
 * 汎用テーブルページ用コンポーネント
 */
const TablePage = () => ({
    currentTable: null as string | null,
    loadingData: false,
    data: [] as any[],
    columns: [] as string[],
    page: 1,
    limit: 50,
    totalRecords: 0,
    totalPages: 0,
    showDetails: false,
    selectedRow: {} as any,

    async init() {
        const params = new URLSearchParams(window.location.search);
        const table = params.get('table');
        if (table) {
            await this.loadTable(table);
        }
    },

    async loadTable(table: string, page = 1) {
        this.currentTable = table;
        this.page = page;
        this.loadingData = true;
        try {
            const result = await Api.fetchTableData(table, this.page, this.limit);
            this.data = result.data;
            this.columns = result.columns;
            this.totalRecords = result.total;
            this.totalPages = result.totalPages;
        } catch (e) {
            console.error(e);
        } finally {
            this.loadingData = false;
        }
    },

    prevPage() { if (this.page > 1) this.loadTable(this.currentTable!, this.page - 1); },
    nextPage() { if (this.page < this.totalPages) this.loadTable(this.currentTable!, this.page + 1); },

    async openDetails(row: any) {
        this.selectedRow = row;
        this.showDetails = true;

        if (this.isPriceData) {
            setTimeout(async () => {
                const container = document.getElementById('chart-container');
                if (container) {
                    Chart.init(container);
                    const priceData = await Api.fetchPriceData(row.code);
                    Chart.setData(priceData);
                }
            }, 0);
        }
    },

    closeDetails() {
        this.showDetails = false;
        Chart.destroy();
    },

    get isPriceData() { return !!this.selectedRow.code; }
});

// コンポーネント登録と開始
initShared();
Alpine.data('tablePage', TablePage);
Alpine.start();
