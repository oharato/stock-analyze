import { initShared, Alpine } from '../init';
import { StockChart } from '../services/chart';

/**
 * セクター別日足ローソク足チャートページ
 */
const CandlestickPage = () => ({
    sectors: [] as string[],
    selectedSector: '',
    companies: [] as any[],
    pricesMap: {} as Record<string, any[]>,
    loading: false,
    charts: {} as Record<string, StockChart>,
    _observer: null as IntersectionObserver | null,

    async init() {
        const params = new URLSearchParams(window.location.search);
        this.selectedSector = params.get('sector33') || '';

        try {
            const res = await fetch('/api/sectors');
            this.sectors = await res.json();
        } catch (e) {
            console.error('Failed to load sectors', e);
        }

        if (!this.selectedSector && this.sectors.length > 0) {
            this.selectedSector = this.sectors[0];
        }

        if (this.selectedSector) {
            await this.loadSector(this.selectedSector);
        }
    },

    async loadSector(sector: string) {
        this.loading = true;
        this._observer?.disconnect();
        this._observer = null;
        this.destroyAllCharts();
        this.companies = [];
        this.pricesMap = {};

        try {
            const res = await fetch(`/api/sector-charts?sector33=${encodeURIComponent(sector)}&days=700`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            this.companies = data.companies ?? [];
            this.pricesMap = data.prices ?? {};
        } catch (e) {
            console.error('Failed to load sector charts', e);
        } finally {
            this.loading = false;
        }

        // Wait for Alpine to render the DOM, then setup lazy chart init
        await Alpine.nextTick();
        this.setupLazyCharts();
    },

    setupLazyCharts() {
        if (!('IntersectionObserver' in window)) {
            // Fallback: initialize all charts immediately
            for (const company of this.companies) {
                this.initChart(company.code);
            }
            return;
        }

        this._observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const code = (entry.target as HTMLElement).dataset.code;
                    if (code) {
                        this.initChart(code);
                        this._observer?.unobserve(entry.target);
                    }
                }
            }
        }, { rootMargin: '200px', threshold: 0 });

        for (const company of this.companies) {
            const el = document.getElementById(`chart-${company.code}`);
            if (el) this._observer.observe(el);
        }
    },

    initChart(code: string) {
        if (this.charts[code]) return;

        const el = document.getElementById(`chart-${code}`);
        if (!el) return;

        const rawData = this.pricesMap[code];
        if (!rawData || rawData.length === 0) return;

        const chart = new StockChart();
        chart.init(el);
        chart.setData(rawData);
        this.charts[code] = chart;
    },

    destroyAllCharts() {
        for (const chart of Object.values(this.charts)) {
            chart.destroy();
        }
        this.charts = {};
    },

    async onSectorChange() {
        const params = new URLSearchParams(window.location.search);
        params.set('sector33', this.selectedSector);
        window.history.replaceState({}, '', `?${params.toString()}`);
        await this.loadSector(this.selectedSector);
    },
});

initShared();
Alpine.data('candlestickPage', CandlestickPage);
Alpine.start();
