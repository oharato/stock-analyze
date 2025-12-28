import Alpine from 'alpinejs';
import { Sidebar } from './components/sidebar';
import { Api } from './services/api';
import { Chart } from './services/chart';
import { Utils } from './utils/format';

/**
 * 共通の初期化処理
 * 各ページのエントリポイントから呼び出されます。
 */
export function initShared() {
    // グローバルにアクセスできるように設定
    (window as any).Alpine = Alpine;
    (window as any).Api = Api;
    (window as any).Chart = Chart;
    (window as any).Utils = Utils;

    // 共通コンポーネント登録
    Alpine.data('sidebar', Sidebar);
}

export { Alpine, Api, Chart, Utils };
