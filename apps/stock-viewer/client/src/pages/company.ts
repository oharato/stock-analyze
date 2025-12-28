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

            // チャートの初期化とデータセット
            Alpine.nextTick(async () => {
                // 日足
                const dailyData = await Api.fetchPriceData(this.code);
                this.charts.daily.init(document.getElementById('daily-chart')!);
                this.charts.daily.setData(dailyData);

                // 週足
                const weeklyData = await Api.fetchWeeklyPriceData(this.code);
                this.charts.weekly.init(document.getElementById('weekly-chart')!);
                this.charts.weekly.setData(weeklyData);

                // 月足
                const monthlyData = await Api.fetchMonthlyPriceData(this.code);
                this.charts.monthly.init(document.getElementById('monthly-chart')!);
                this.charts.monthly.setData(monthlyData);
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
