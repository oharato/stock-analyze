import { initShared, Alpine, Api, Chart } from '../init';
import { SelectedFilters } from '../types';

/**
 * 企業検索ページ用コンポーネント
 */
const CompaniesPage = () => ({
    loadingData: false,
    data: [] as any[],
    columns: [] as string[],
    page: 1,
    limit: 50,
    totalRecords: 0,
    totalPages: 0,
    showDetails: false,
    selectedRow: {} as any,
    filterQuery: '',
    filterOptions: { market: [], sector33: [], sector17: [], scale: [] } as any,
    selectedFilters: { market: [], sector33: [], sector17: [], scale: [] } as SelectedFilters,

    async init() {
        try {
            this.filterOptions = await Api.fetchFilterOptions();
            await this.applyFilter();
        } catch (e) {
            console.error('Failed to init companies page', e);
        }
    },

    async applyFilter() {
        this.loadingData = true;
        try {
            const result = await Api.searchCompanies(this.filterQuery, this.selectedFilters, this.page, this.limit);
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

    toggleFilter(type: keyof SelectedFilters, value: string) {
        const index = this.selectedFilters[type].indexOf(value);
        if (index === -1) this.selectedFilters[type].push(value);
        else this.selectedFilters[type].splice(index, 1);
        this.page = 1;
        this.applyFilter();
    },

    clearAllFilters() {
        this.filterQuery = '';
        this.selectedFilters = { market: [], sector33: [], sector17: [], scale: [] };
        this.page = 1;
        this.applyFilter();
    },

    prevPage() { if (this.page > 1) { this.page--; this.applyFilter(); } },
    nextPage() { if (this.page < this.totalPages) { this.page++; this.applyFilter(); } },

    async openDetails(row: any) {
        this.selectedRow = row;
        this.showDetails = true;
        setTimeout(async () => {
            const container = document.getElementById('chart-container');
            if (container) {
                Chart.init(container);
                const priceData = await Api.fetchPriceData(row.code);
                Chart.setData(priceData);
            }
        }, 0);
    },

    closeDetails() {
        this.showDetails = false;
        Chart.destroy();
    }
});

// コンポーネント登録と開始
initShared();
Alpine.data('companiesPage', CompaniesPage);
Alpine.start();
