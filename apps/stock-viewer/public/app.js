import { Api } from './modules/api.js';
import { Chart } from './modules/chart.js';
import { Utils } from './modules/utils.js';

/**
 * Alpine.js アプリケーション定義
 * 画面のステート管理とイベントハンドリングを行います。
 * ビジネスロジックは各モジュールに委譲しています。
 */
const initApp = () => {
    Alpine.data('app', () => ({
        // ステート
        tables: [],           // テーブル一覧
        currentTable: null,   // 現在選択中のテーブル
        loadingTables: false, // テーブル一覧読み込み中フラグ
        loadingData: false,   // データ読み込み中フラグ
        data: [],             // テーブルデータ
        columns: [],          // テーブルカラム名
        page: 1,              // 現在のページ
        limit: 50,            // 1ページあたりの件数
        totalRecords: 0,      // 総レコード数
        totalPages: 0,        // 総ページ数
        showDetails: false,   // 詳細モーダル表示フラグ
        selectedRow: {},      // 選択行データ

        /**
         * 初期化処理
         */
        async init() {
            await this.fetchTables();

            // ウィンドウリサイズ時のチャートリサイズ処理
            window.addEventListener('resize', () => {
                const container = document.getElementById('chart-container');
                if (container) {
                    Chart.resize(container.clientWidth, container.clientHeight);
                }
            });
        },

        /**
         * テーブル一覧を取得します。
         */
        async fetchTables() {
            this.loadingTables = true;
            try {
                this.tables = await Api.fetchTables();
            } catch (e) {
                // エラー処理はモジュール内で行っているが、UIへの通知が必要ならここで行う
            } finally {
                this.loadingTables = false;
            }
        },

        /**
         * 指定されたテーブルのデータを読み込みます。
         * @param {string} table テーブル名
         * @param {number} page ページ番号
         */
        async loadTable(table, page = 1) {
            if (this.currentTable !== table) {
                this.page = 1;
                this.currentTable = table;
            } else {
                this.page = page;
            }

            this.loadingData = true;
            try {
                const result = await Api.fetchTableData(table, this.page, this.limit);
                this.data = result.data;
                this.columns = result.columns;
                this.totalRecords = result.total;
                this.totalPages = result.totalPages;
            } catch (e) {
                // エラー発生時のUI更新など
            } finally {
                this.loadingData = false;
            }
        },

        /**
         * 前のページへ移動します。
         */
        prevPage() {
            if (this.page > 1) {
                this.loadTable(this.currentTable, this.page - 1);
            }
        },

        /**
         * 次のページへ移動します。
         */
        nextPage() {
            if (this.page < this.totalPages) {
                this.loadTable(this.currentTable, this.page + 1);
            }
        },

        /**
         * 値をフォーマットします（テンプレートから利用）。
         */
        formatValue(val) {
            return Utils.formatValue(val);
        },

        /**
         * 詳細モーダルを開き、必要に応じてチャートを表示します。
         * @param {object} row 選択された行データ
         */
        async openDetails(row) {
            this.selectedRow = row;
            this.showDetails = true;

            // ネイティブダイアログを開く
            this.$nextTick(() => {
                const dialog = document.querySelector('dialog');
                if (dialog && !dialog.open) {
                    dialog.showModal();
                }
            });

            // チャートデータのロード（コードがある場合）
            if (this.isPriceData) {
                // UIが更新され、コンテナが表示されるのを待つ
                await new Promise(resolve => setTimeout(resolve, 500));

                this.$nextTick(async () => {
                    const container = document.getElementById('chart-container');

                    // コンテナチェック
                    if (container && container.clientWidth > 0) {
                        try {
                            const code = row.code; // code列を利用
                            const priceData = await Api.fetchPriceData(code);

                            // チャート初期化とデータセット
                            Chart.init(container);
                            Chart.setData(priceData);
                        } catch (e) {
                            console.error("チャート表示に失敗しました", e);
                        }
                    } else {
                        console.warn('チャートコンテナが見つからないか、サイズが0です');
                    }
                });
            } else {
                Chart.destroy();
            }
        },

        /**
         * 詳細モーダルを閉じます。
         */
        closeDetails() {
            this.showDetails = false;
            const dialog = document.querySelector('dialog');
            if (dialog && dialog.open) {
                dialog.close();
            }
            Chart.destroy();
        },

        /**
         * チャートを表示可能なデータかどうか判定します。
         */
        get isPriceData() {
            // code列がある、またはpricesテーブルを見ている場合にtrueとする条件
            return !!this.selectedRow.code;
        }
    }));
};

if (window.Alpine) {
    initApp();
} else {
    document.addEventListener('alpine:init', initApp);
}
