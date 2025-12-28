import { initShared, Alpine, Api } from '../init';

const BasePage = (tableName: string) => ({
    currentTable: tableName,
    loadingData: false,
    data: [] as any[],
    columns: [] as string[],
    page: 1,
    limit: 50,
    totalRecords: 0,
    totalPages: 0,
    showDetails: false,
    selectedRow: {} as any,

    async init() { await this.loadTable(this.currentTable); },
    async loadTable(table: string, page = 1) {
        this.currentTable = table; this.page = page; this.loadingData = true;
        try {
            const result = await Api.fetchTableData(table, this.page, this.limit);
            this.data = result.data; this.columns = result.columns; this.totalRecords = result.total; this.totalPages = result.totalPages;
        } catch (e) { console.error(e); } finally { this.loadingData = false; }
    },
    prevPage() { if (this.page > 1) this.loadTable(this.currentTable, this.page - 1); },
    nextPage() { if (this.page < this.totalPages) this.loadTable(this.currentTable, this.page + 1); },
    openDetails(row: any) { this.selectedRow = row; this.showDetails = true; },
    closeDetails() { this.showDetails = false; }
});

export const createPage = (tableName: string) => {
    initShared();
    Alpine.data('tablePage', () => BasePage(tableName));
    Alpine.start();
};
