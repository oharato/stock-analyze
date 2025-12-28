import Alpine from 'alpinejs';
import { Sidebar } from './components/sidebar';
import { Api } from './services/api';
import { Chart } from './services/chart';
import { Utils } from './utils/format';

// グローバルにアクセスできるように設定（Alpine.jsのディレクティブ用）
(window as any).Alpine = Alpine;
(window as any).Api = Api;
(window as any).Chart = Chart;
(window as any).Utils = Utils;

// コンポーネント登録
Alpine.data('sidebar', Sidebar);

// 各ページ固有の初期化が必要な場合はここで判定
document.addEventListener('alpine:init', () => {
    console.log('Alpine initialized');
});

Alpine.start();
