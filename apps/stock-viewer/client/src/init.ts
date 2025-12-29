import Alpine from 'alpinejs';
import { Sidebar } from './components/sidebar';
import { Api } from './services/api';
import { StockChart, ChartInstance } from './services/chart';
import { Utils } from './utils/format';

/**
 * 共通の初期化処理
 * 各ページのエントリポイントから呼び出されます。
 */
export function initShared() {
    // グローバルにアクセスできるように設定
    (window as any).Alpine = Alpine;
    (window as any).Api = Api;
    (window as any).StockChart = StockChart;
    (window as any).Chart = ChartInstance; // 後方互換性
    (window as any).Utils = Utils;

    // 共通コンポーネント登録
    Alpine.data('sidebar', Sidebar);

    // グローバルストアの初期化
    Alpine.store('ui', {
        sidebarOpen: false,
        toggleSidebar() {
            (this as any).sidebarOpen = !(this as any).sidebarOpen;
        },
        closeSidebar() {
            (this as any).sidebarOpen = false;
        }
    });
}

export { Alpine, Api, StockChart, ChartInstance as Chart, Utils };
