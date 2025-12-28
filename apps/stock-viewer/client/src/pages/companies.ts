import { initShared, Alpine, Api, StockChart, Chart, Utils } from '../init';
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
    chartMode: 'none',
    chartInstances: [] as any[],

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
        this.destroyCharts();
        try {
            const result = await Api.searchCompanies(this.filterQuery, this.selectedFilters, this.page, this.limit);
            this.data = result.data;
            this.columns = result.columns;
            this.totalRecords = result.total;
            this.totalPages = result.totalPages;

            if (this.chartMode !== 'none') {
                // DOMの更新を待ってからチャートを描画
                Alpine.nextTick(() => {
                    this.renderCharts();
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            this.loadingData = false;
        }
    },

    onChartModeChange() {
        this.page = 1;
        this.applyFilter();
    },

    async renderCharts() {
        for (const row of this.data) {
            const containerId = `chart-container-${row.code}`;
            const container = document.getElementById(containerId);
            if (!container) continue;

            const target = container.querySelector('.chart-container') as HTMLElement;
            if (!target) continue;

            const chart = new StockChart();
            chart.init(target);
            this.chartInstances.push(chart);

            try {
                let priceData: any[] = [];
                if (this.chartMode === 'daily') {
                    priceData = await Api.fetchPriceData(row.code);
                } else if (this.chartMode === 'weekly') {
                    priceData = await Api.fetchWeeklyPriceData(row.code);
                } else if (this.chartMode === 'monthly') {
                    priceData = await Api.fetchMonthlyPriceData(row.code);
                }
                chart.setData(priceData);
            } catch (e) {
                console.error(`Failed to fetch chart data for ${row.code}`, e);
            }
        }
    },

    destroyCharts() {
        this.chartInstances.forEach(c => c.destroy());
        this.chartInstances = [];
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
        this.chartMode = 'none';
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
