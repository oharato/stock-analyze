import { Utils } from './utils.js';

/**
 * チャートモジュール
 * Lightweight Charts の制御とデータ処理を担当します。
 */
export const Chart = {
    chart: null,
    candlestickSeries: null,

    /**
     * チャートを初期化します。
     * @param {HTMLElement} container チャートを表示するDOM要素
     */
    init(container) {
        if (!container) return;

        // 既存のチャートがあれば破棄
        this.destroy();

        // チャートの作成
        this.chart = LightweightCharts.createChart(container, {
            layout: {
                background: { type: 'solid', color: '#111827' },
                textColor: '#D1D5DB',
            },
            grid: {
                vertLines: { color: '#374151' },
                horzLines: { color: '#374151' },
            },
            width: container.clientWidth,
            height: container.clientHeight,
        });

        // ろうそく足シリーズの追加
        this.candlestickSeries = this.chart.addSeries(LightweightCharts.CandlestickSeries, {
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350'
        });
    },

    /**
     * チャートデータを設定します。データの変換と重複排除も行います。
     * @param {object[]} rawData APIから取得した生の株価データ
     */
    setData(rawData) {
        if (!this.candlestickSeries) return;

        // データ順序の保証（古い順）
        // APIから降順(DESC)で取得した場合は反転する
        // ここでは生の配列を受け取るので、事前にreverseされているかは呼び出し元次第だが
        // 安全のため、タイムスタンプでソートし直すロジックを最後に通す

        const processedMap = new Map();

        rawData.forEach(d => {
            // 必須データのチェック
            if (!d.date || d.open == null || d.high == null || d.low == null || d.close == null) return;

            // 日付フォーマット変換
            const formattedDate = Utils.formatDate(d.date);

            // 日付による重複排除
            if (!processedMap.has(formattedDate)) {
                processedMap.set(formattedDate, {
                    time: formattedDate,
                    open: parseFloat(d.open),
                    high: parseFloat(d.high),
                    low: parseFloat(d.low),
                    close: parseFloat(d.close)
                });
            }
        });

        const chartData = Array.from(processedMap.values());

        if (chartData.length === 0) {
            console.warn('表示可能なチャートデータがありません');
            return;
        }

        // 時間順で昇順ソート（Lightweight Chartsの要件）
        chartData.sort((a, b) => (a.time > b.time) ? 1 : -1);

        // データセット
        this.candlestickSeries.setData(chartData);
        this.chart.timeScale().fitContent();
    },

    /**
     * チャートをリサイズします。
     * @param {number} width 
     * @param {number} height 
     */
    resize(width, height) {
        if (this.chart) {
            this.chart.resize(width, height);
        }
    },

    /**
     * チャートを破棄します。
     */
    destroy() {
        if (this.chart) {
            this.chart.remove();
            this.chart = null;
            this.candlestickSeries = null;
        }
    }
};
