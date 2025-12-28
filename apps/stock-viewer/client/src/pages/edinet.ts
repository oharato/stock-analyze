import { initShared, Alpine, Api, Utils } from '../init';

const EdinetPage = () => ({
    currentTable: 'edinet',
    loadingData: false,
    data: [] as any[],
    columns: [] as string[],
    displayedColumns: [] as string[],
    page: 1,
    limit: 50,
    totalRecords: 0,
    totalPages: 0,
    showDetails: false,
    selectedRow: {} as any,
    vectorQuery: '',
    vectorTarget: 'business_risks',
    Utils, // Make Utils available in the template

    async init() {
        await this.loadData();
    },

    async loadData(page = 1) {
        this.page = page;
        this.loadingData = true;
        try {
            let result;
            if (this.vectorQuery.trim()) {
                result = await Api.searchEdinet(this.vectorQuery, this.vectorTarget, this.page, this.limit);
            } else {
                result = await Api.fetchTableData(this.currentTable, this.page, this.limit);
            }
            this.data = result.data;
            this.columns = result.columns;
            this.displayedColumns = this.columns.filter(c => !c.endsWith('_vector'));
            this.totalRecords = result.total;
            this.totalPages = result.totalPages;
        } catch (e) {
            console.error(e);
        } finally {
            this.loadingData = false;
        }
    },

    async applyVectorSearch() {
        this.page = 1;
        await this.loadData();
    },

    prevPage() {
        if (this.page > 1) this.loadData(this.page - 1);
    },

    nextPage() {
        if (this.page < this.totalPages) this.loadData(this.page + 1);
    },

    openDetails(row: any) {
        this.selectedRow = row;
        this.showDetails = true;
    },

    closeDetails() {
        this.showDetails = false;
    }
});

// コンポーネント登録と開始
initShared();
Alpine.data('tablePage', EdinetPage);
Alpine.start();
