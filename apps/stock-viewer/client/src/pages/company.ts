import { initShared, Alpine, Api } from '../init';
import { StockChart } from '../services/chart';

/**
 * 会社詳細ページ用コンポーネント
 */
const CompanyPage = () => ({
    loading: true,
    code: '',
    details: null as any,
    fundamentalsColumns: [] as string[],

    charts: {
        daily: new StockChart(),
        weekly: new StockChart(),
        monthly: new StockChart()
    },

    async init() {
        const params = new URLSearchParams(window.location.search);
        this.code = params.get('code') || '';

        if (!this.code) {
            window.location.href = '/companies';
            return;
        }

        try {
            this.details = await Api.fetchCompanyDetails(this.code);
            this.loading = false;

            // チャートを順番に描画してメインスレッドの負荷を分散 (Violation対策)
            Alpine.nextTick(async () => {
                // 1. 日足 (最優先)
                const dailyData = await Api.fetchPriceData(this.code);
                this.charts.daily.init(document.getElementById('daily-chart')!);
                this.charts.daily.setData(dailyData);

                // 2. 週足 (少し遅らせる)
                setTimeout(async () => {
                    const weeklyData = await Api.fetchWeeklyPriceData(this.code);
                    this.charts.weekly.init(document.getElementById('weekly-chart')!);
                    this.charts.weekly.setData(weeklyData);
                }, 100);

                // 3. 月足 (さらに遅らせる)
                setTimeout(async () => {
                    const monthlyData = await Api.fetchMonthlyPriceData(this.code);
                    this.charts.monthly.init(document.getElementById('monthly-chart')!);
                    this.charts.monthly.setData(monthlyData);
                }, 200);
            });
        } catch (e) {
            console.error('Failed to load company details', e);
            this.loading = false;
        }
    }
});

initShared();
Alpine.data('companyPage', CompanyPage);
Alpine.start();
